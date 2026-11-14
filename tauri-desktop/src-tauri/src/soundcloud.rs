//! SoundCloud tracks (`sc-<id>`) for songs YouTube Music does not carry. Their audio is HLS made
//! of fMP4 pieces; it is fetched whole into a file under the storage dir, which the audio host
//! plays (symphonia reads fragmented MP4).
//!
//! The API key is the public `client_id` of the SoundCloud web app, scraped from its scripts.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::Value;
use tokio::sync::Mutex;

use crate::music::{split_song_name, MusicTrack};

const API_URL: &str = "https://api-v2.soundcloud.com";
const SITE_URL: &str = "https://soundcloud.com";
const TRACK_PREFIX: &str = "sc-";
const MIN_SECONDS: u64 = 60;
const MAX_SECONDS: u64 = 15 * 60;
const KEPT_FILES: usize = 20;
const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

pub fn track_id(id: &str) -> Option<u64> {
    id.strip_prefix(TRACK_PREFIX)?.parse().ok()
}

pub struct SoundCloud {
    http: reqwest::Client,
    client_id: Mutex<Option<String>>,
    dir: OnceLock<PathBuf>,
    /// One download at a time: the same track asked for twice is fetched once.
    downloading: Mutex<()>,
}

impl SoundCloud {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .user_agent(BROWSER_USER_AGENT)
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(20))
                .build()
                .expect("soundcloud http client"),
            client_id: Mutex::new(None),
            dir: OnceLock::new(),
            downloading: Mutex::new(()),
        }
    }

    pub fn set_storage_dir(&self, dir: PathBuf) {
        let dir = dir.join("soundcloud");
        let _ = std::fs::create_dir_all(&dir);
        let _ = self.dir.set(dir);
    }

    /// Full tracks only: previews, DRM-protected and stream-less ones are left out.
    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<MusicTrack>, String> {
        let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
        let found = self.api(&format!("{API_URL}/search/tracks?q={encoded}&limit={}", limit * 2)).await?;
        Ok(found["collection"].as_array().into_iter().flatten().filter_map(to_track).take(limit).collect())
    }

    /// The track's audio as a local file, downloaded on first use.
    pub async fn audio_file(&self, id: &str) -> Result<PathBuf, String> {
        let number = track_id(id).ok_or_else(|| "error:bad id".to_string())?;
        let dir = self.dir.get().ok_or_else(|| "error:no storage dir".to_string())?;
        let target = dir.join(format!("{number}.mp4"));
        let _guard = self.downloading.lock().await;
        if std::fs::metadata(&target).is_ok_and(|m| m.len() > 0) {
            return Ok(target);
        }
        let track = self.api(&format!("{API_URL}/tracks/{number}")).await?;
        let transcoding = playable_transcoding(&track).ok_or_else(|| "unavailable:no SoundCloud stream".to_string())?;
        let mut stream_url = transcoding["url"].as_str().unwrap_or_default().to_string();
        if let Some(auth) = track["track_authorization"].as_str() {
            stream_url.push_str(&format!("?track_authorization={auth}"));
        }
        let stream = self.api(&stream_url).await?;
        let playlist_url = stream["url"].as_str().ok_or_else(|| "unavailable:no SoundCloud playlist".to_string())?;
        let playlist = self.get(playlist_url).await?;
        let playlist = String::from_utf8_lossy(&playlist);
        let init = playlist
            .lines()
            .find_map(|l| l.trim().strip_prefix("#EXT-X-MAP:"))
            .and_then(|l| l.split("URI=\"").nth(1))
            .and_then(|l| l.split('"').next())
            .map(str::to_string);
        let urls: Vec<String> = init
            .into_iter()
            .chain(playlist.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')).map(str::to_string))
            .collect();
        if urls.len() < 2 {
            return Err("unavailable:empty SoundCloud playlist".to_string());
        }
        let mut pieces = tokio::task::JoinSet::new();
        for (index, url) in urls.into_iter().enumerate() {
            let http = self.http.clone();
            pieces.spawn(async move { (index, fetch(&http, &url).await) });
        }
        let mut parts = Vec::new();
        while let Some(joined) = pieces.join_next().await {
            let (index, bytes) = joined.map_err(|e| format!("error:{e}"))?;
            parts.push((index, bytes?));
        }
        parts.sort_by_key(|(index, _)| *index);
        let partial = dir.join(format!("{number}.mp4.part"));
        std::fs::write(&partial, parts.into_iter().flat_map(|(_, bytes)| bytes).collect::<Vec<u8>>())
            .and_then(|_| std::fs::rename(&partial, &target))
            .map_err(|e| format!("error:save SoundCloud audio: {e}"))?;
        trim_cache(dir);
        Ok(target)
    }

    /// GET with the client id; a rejected id is scraped again once.
    async fn api(&self, url: &str) -> Result<Value, String> {
        for attempt in 0..2 {
            let client_id = self.client_id(attempt > 0).await?;
            let separator = if url.contains('?') { "&" } else { "?" };
            let response = self
                .http
                .get(format!("{url}{separator}client_id={client_id}"))
                .send()
                .await
                .map_err(|e| format!("network:{e}"))?;
            match response.status().as_u16() {
                401 | 403 if attempt == 0 => continue,
                status if !(200..300).contains(&status) => return Err(format!("upstream:{status}")),
                _ => return response.json().await.map_err(|e| format!("error:bad SoundCloud answer: {e}")),
            }
        }
        Err("upstream:client id rejected".to_string())
    }

    async fn client_id(&self, refresh: bool) -> Result<String, String> {
        let mut cached = self.client_id.lock().await;
        if let (false, Some(id)) = (refresh, cached.as_ref()) {
            return Ok(id.clone());
        }
        let page = String::from_utf8_lossy(&self.get(SITE_URL).await?).into_owned();
        let scripts: Vec<&str> = page
            .split("src=\"")
            .skip(1)
            .filter_map(|s| s.split('"').next())
            .filter(|s| s.starts_with("https://a-v2.sndcdn.com/assets/") && s.ends_with(".js"))
            .collect();
        for script in scripts.iter().rev() {
            let Ok(body) = self.get(script).await else { continue };
            let body = String::from_utf8_lossy(&body);
            if let Some(id) = body
                .split("client_id:\"")
                .skip(1)
                .filter_map(|s| s.get(..32))
                .find(|s| s.bytes().all(|b| b.is_ascii_alphanumeric()))
            {
                *cached = Some(id.to_string());
                return Ok(id.to_string());
            }
        }
        Err("error:no SoundCloud client id".to_string())
    }

    async fn get(&self, url: &str) -> Result<Vec<u8>, String> {
        fetch(&self.http, url).await
    }
}

async fn fetch(http: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    let response = http.get(url).send().await.map_err(|e| format!("network:{e}"))?;
    if !response.status().is_success() {
        return Err(format!("upstream:{}", response.status().as_u16()));
    }
    response.bytes().await.map(|b| b.to_vec()).map_err(|e| format!("network:{e}"))
}

fn to_track(json: &Value) -> Option<MusicTrack> {
    let id = json["id"].as_u64()?;
    if matches!(json["policy"].as_str(), Some("SNIP" | "BLOCK")) {
        return None;
    }
    let seconds = json["full_duration"].as_u64().or_else(|| json["duration"].as_u64())? / 1000;
    if !(MIN_SECONDS..=MAX_SECONDS).contains(&seconds) || playable_transcoding(json).is_none() {
        return None;
    }
    let username = json["user"]["username"].as_str().unwrap_or_default();
    let publisher = json["publisher_metadata"]["artist"].as_str().filter(|s| !s.trim().is_empty());
    let (artist, title) = split_song_name(json["title"].as_str().unwrap_or_default(), publisher.unwrap_or(username));
    // Anyone can upload anything under any name; only the artist's own uploads are trusted.
    if !by_artist(&artist, username) {
        return None;
    }
    let artwork = json["artwork_url"]
        .as_str()
        .or_else(|| json["user"]["avatar_url"].as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.replace("-large.", "-t500x500."));
    Some(MusicTrack {
        video_id: format!("{TRACK_PREFIX}{id}"),
        title,
        artist: artist.clone(),
        duration_seconds: seconds as u32,
        thumbnail_url: artwork,
        artist_id: Some(format!("{}{artist}", crate::apple::ARTIST_NAME_PREFIX)),
        source: Some("SoundCloud".to_string()),
    })
}

/// True when `artist` (or one of its artists) is the uploading account.
fn by_artist(artist: &str, account: &str) -> bool {
    let squash = |s: &str| crate::music::comparable(s).replace(' ', "");
    let owner = squash(account);
    !owner.is_empty()
        && std::iter::once(artist)
            .chain(artist.split([',', '&', '/']))
            .map(squash)
            .any(|a| !a.is_empty() && (a.contains(&owner) || owner.contains(&a)))
}

/// Unencrypted AAC HLS; the snipped ones are 30 s previews.
fn playable_transcoding(track: &Value) -> Option<&Value> {
    track["media"]["transcodings"].as_array()?.iter().find(|t| {
        t["format"]["protocol"].as_str() == Some("hls")
            && t["format"]["mime_type"].as_str().is_some_and(|m| m.starts_with("audio/mp4"))
            && !t["snipped"].as_bool().unwrap_or(false)
    })
}

fn trim_cache(dir: &PathBuf) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut files: Vec<_> = entries
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "mp4"))
        .filter_map(|e| Some((e.metadata().ok()?.modified().ok()?, e.path())))
        .collect();
    files.sort_by(|a, b| b.0.cmp(&a.0));
    for (_, path) in files.into_iter().skip(KEPT_FILES) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids() {
        assert_eq!(track_id("sc-329972315"), Some(329972315));
        assert_eq!(track_id("dz-1"), None);
        assert_eq!(track_id("dQw4w9WgXcQ"), None);
    }
}
