//! The public Deezer API (no key), the catalog before Apple took over (see `apple.rs`): it now
//! only serves tracks, artist / album pages and radios saved while it was the catalog. From
//! Russia Deezer hides tracks it has no streaming rights for from `artist/top` and
//! `album/{id}/tracks`, but not from `album/{id}`, which is why pages are built from full albums.
//!
//! Deezer tracks get ids like `dz-528330441`, artist radios `dzartist-27`. Errors come as HTTP 200
//! with `{"error": {...}}`; codes 4 and 700 mean "quota / busy, retry shortly".

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;

use crate::music::{AlbumCard, AlbumPage, ArtistCard, ArtistPage, MusicTrack};

const BASE_URL: &str = "https://api.deezer.com";
/// A mobile User-Agent gets a truncated, differently ranked search.
const USER_AGENT: &str = "Whithin/1.0";
const TRACK_PREFIX: &str = "dz-";
const ARTIST_RADIO_PREFIX: &str = "dzartist-";
const QUOTA_RETRIES: u32 = 3;
const MAX_ARTIST_ALBUMS: usize = 60;
const ALBUM_FETCH_PARALLELISM: usize = 6;

/// Title, artist and duration: what's needed to find the track on YouTube.
#[derive(Clone, Debug)]
pub struct TrackMeta {
    pub title: String,
    pub artist: String,
    pub duration: u32,
}

pub struct Deezer {
    http: reqwest::Client,
    meta: std::sync::Mutex<HashMap<u64, TrackMeta>>,
}

pub fn track_id(id: &str) -> Option<u64> {
    id.strip_prefix(TRACK_PREFIX)?.parse().ok()
}

pub fn artist_radio_id(id: &str) -> Option<u64> {
    id.strip_prefix(ARTIST_RADIO_PREFIX)?.parse().ok()
}

/// Deezer artist / album ids are plain numbers; YouTube ones never are.
pub fn is_catalog_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 20 && id.bytes().all(|b| b.is_ascii_digit())
}

impl Deezer {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .user_agent(USER_AGENT)
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(15))
                .build()
                .expect("deezer http client"),
            meta: std::sync::Mutex::new(HashMap::new()),
        }
    }

    async fn get(&self, path: impl Into<String>, query: Vec<(&'static str, String)>) -> Result<Value, String> {
        fetch(&self.http, path.into(), query).await
    }

    fn items(data: &Value) -> impl Iterator<Item = &Value> {
        data["data"].as_array().into_iter().flatten()
    }

    fn track(&self, d: &Value, album_cover: Option<&str>) -> Option<MusicTrack> {
        // `readable` is Deezer's own streaming rights for the caller's country (false for most
        // tracks behind a VPN); the audio comes from YouTube, so it is ignored.
        let id = d["id"].as_u64()?;
        let title = d["title"].as_str().filter(|s| !s.is_empty()).or_else(|| d["title_short"].as_str())?.to_string();
        let artist = d["artist"]["name"].as_str().unwrap_or_default().to_string();
        let duration = d["duration"].as_u64().unwrap_or(0) as u32;
        self.meta
            .lock()
            .unwrap()
            .insert(id, TrackMeta { title: title.clone(), artist: artist.clone(), duration });
        Some(MusicTrack {
            video_id: format!("{TRACK_PREFIX}{id}"),
            title,
            artist,
            duration_seconds: duration,
            thumbnail_url: d["album"]["cover_xl"]
                .as_str()
                .or_else(|| d["album"]["cover_big"].as_str())
                .or(album_cover)
                .map(str::to_string),
            artist_id: d["artist"]["id"].as_u64().map(|id| id.to_string()),
            source: None,
        })
    }

    fn tracks(&self, data: &Value, album_cover: Option<&str>) -> Vec<MusicTrack> {
        Self::items(data).filter_map(|d| self.track(d, album_cover)).collect()
    }

    fn artist(d: &Value) -> Option<ArtistCard> {
        Some(ArtistCard {
            id: d["id"].as_u64()?.to_string(),
            name: d["name"].as_str().unwrap_or_default().to_string(),
            image_url: picture(d),
            subscribers: d["nb_fan"].as_u64(),
        })
    }

    fn artists(data: &Value) -> Vec<ArtistCard> {
        Self::items(data).filter_map(Self::artist).collect()
    }

    fn album(d: &Value, artist: Option<&str>) -> Option<AlbumCard> {
        Some(AlbumCard {
            id: d["id"].as_u64()?.to_string(),
            name: d["title"].as_str().unwrap_or_default().to_string(),
            cover_url: d["cover_xl"].as_str().or_else(|| d["cover_big"].as_str()).map(str::to_string),
            artist: d["artist"]["name"].as_str().or(artist).unwrap_or_default().to_string(),
            year: year(d),
            kind: album_kind(d["record_type"].as_str()),
        })
    }

    /// Title, artist and duration of a track, from the lists already shown or the API.
    pub async fn track_meta(&self, id: u64) -> Result<TrackMeta, String> {
        if let Some(meta) = self.meta.lock().unwrap().get(&id) {
            return Ok(meta.clone());
        }
        let data = self.get(format!("track/{id}"), vec![]).await?;
        self.track(&data, None).ok_or_else(|| "unavailable:deleted".to_string())?;
        self.meta.lock().unwrap().get(&id).cloned().ok_or_else(|| "unavailable:deleted".to_string())
    }

    pub async fn artist_page(&self, id: &str) -> Result<ArtistPage, String> {
        let (artist, top, albums, related) = tokio::join!(
            self.get(format!("artist/{id}"), vec![]),
            self.get(format!("artist/{id}/top"), vec![("limit", "50".to_string())]),
            self.get(format!("artist/{id}/albums"), vec![("limit", "100".to_string())]),
            self.get(format!("artist/{id}/related"), vec![("limit", "20".to_string())]),
        );
        let artist = artist?;
        let name = artist["name"].as_str().unwrap_or_default().to_string();
        let mut album_cards: Vec<AlbumCard> = albums
            .as_ref()
            .map(|data| Self::items(data).filter_map(|d| Self::album(d, Some(&name))).collect())
            .unwrap_or_default();
        dedupe_albums(&mut album_cards);
        let album_ids: Vec<u64> = albums
            .as_ref()
            .map(|data| Self::items(data).filter_map(|d| d["id"].as_u64()).take(MAX_ARTIST_ALBUMS).collect())
            .unwrap_or_default();
        let tracks = self.discography(top.ok(), self.full_albums(album_ids).await);
        Ok(ArtistPage {
            id: id.to_string(),
            name,
            image_url: picture(&artist),
            description: None,
            subscribers: artist["nb_fan"].as_u64(),
            tracks,
            albums: album_cards,
            similar: related.map(|data| Self::artists(&data)).unwrap_or_default(),
            radio_id: Some(format!("{ARTIST_RADIO_PREFIX}{id}")),
        })
    }

    /// Every track of the artist, most popular first. From Russia `artist/top` lists only the few
    /// tracks Deezer may stream there while full albums are served, so the list is assembled from
    /// the discography; singles repeating an album track collapse into one.
    fn discography(&self, top: Option<Value>, albums: Vec<Value>) -> Vec<MusicTrack> {
        let mut ranked: Vec<(u64, MusicTrack)> = Vec::new();
        if let Some(top) = &top {
            ranked.extend(Self::items(top).filter_map(|d| Some((d["rank"].as_u64().unwrap_or(0), self.track(d, None)?))));
        }
        for album in &albums {
            let cover = album["cover_xl"].as_str().or_else(|| album["cover_big"].as_str());
            ranked.extend(
                album["tracks"]["data"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|d| Some((d["rank"].as_u64().unwrap_or(0), self.track(d, cover)?))),
            );
        }
        ranked.sort_by(|a, b| b.0.cmp(&a.0));
        let mut seen_ids = HashSet::new();
        let mut seen_titles = HashSet::new();
        ranked
            .into_iter()
            .map(|(_, track)| track)
            .filter(|t| seen_ids.insert(t.video_id.clone()))
            .filter(|t| seen_titles.insert(t.title.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect::<String>()))
            .collect()
    }

    /// Full `album/{id}` objects, fetched a few at a time (Deezer allows 50 requests per 5 s).
    async fn full_albums(&self, ids: Vec<u64>) -> Vec<Value> {
        let gate = Arc::new(tokio::sync::Semaphore::new(ALBUM_FETCH_PARALLELISM));
        let mut jobs = tokio::task::JoinSet::new();
        for (index, id) in ids.into_iter().enumerate() {
            let (http, gate) = (self.http.clone(), gate.clone());
            jobs.spawn(async move {
                let _permit = gate.acquire_owned().await.ok()?;
                fetch(&http, format!("album/{id}"), vec![]).await.ok().map(|album| (index, album))
            });
        }
        let mut albums = Vec::new();
        while let Some(done) = jobs.join_next().await {
            if let Ok(Some(album)) = done {
                albums.push(album);
            }
        }
        albums.sort_by_key(|(index, _)| *index);
        albums.into_iter().map(|(_, album)| album).collect()
    }

    /// `album/{id}` itself: from Russia `album/{id}/tracks` drops what Deezer may not stream there.
    pub async fn album_page(&self, id: &str) -> Result<AlbumPage, String> {
        let album = self.get(format!("album/{id}"), vec![]).await?;
        let cover = album["cover_xl"].as_str().or_else(|| album["cover_big"].as_str()).map(str::to_string);
        let artist = album["artist"]["name"].as_str().unwrap_or_default().to_string();
        let tracks = album["tracks"]["data"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|d| self.track(d, cover.as_deref()))
            .collect();
        Ok(AlbumPage {
            id: id.to_string(),
            name: album["title"].as_str().unwrap_or_default().to_string(),
            cover_url: cover,
            artist,
            artist_id: album["artist"]["id"].as_u64().map(|id| id.to_string()),
            year: year(&album),
            kind: album_kind(album["record_type"].as_str()),
            tracks,
        })
    }

    /// Mix of the artist and similar ones; a track seed uses its artist's radio with the track first.
    pub async fn radio(&self, seed: &str) -> Result<Vec<MusicTrack>, String> {
        let (artist, first) = if let Some(artist) = artist_radio_id(seed) {
            (artist, None)
        } else if let Some(track) = track_id(seed) {
            let data = self.get(format!("track/{track}"), vec![]).await?;
            let artist = data["artist"]["id"].as_u64().ok_or_else(|| "unavailable:deleted".to_string())?;
            (artist, self.track(&data, None))
        } else {
            return Err("error:bad id".to_string());
        };
        let data = self.get(format!("artist/{artist}/radio"), vec![("limit", "50".to_string())]).await?;
        let mut tracks = self.tracks(&data, None);
        if let Some(first) = first {
            tracks.retain(|t| t.video_id != first.video_id);
            tracks.insert(0, first);
        }
        Ok(tracks)
    }

}

/// Deezer reports errors inside a 200 response; 4 and 700 are its rate limit and pass after a wait.
async fn fetch(http: &reqwest::Client, path: String, query: Vec<(&'static str, String)>) -> Result<Value, String> {
    let url = format!("{BASE_URL}/{path}");
    for attempt in 0..=QUOTA_RETRIES {
        let response = http
            .get(&url)
            .query(&query)
            .send()
            .await
            .map_err(|e| format!("network:{e}"))?;
        if !response.status().is_success() {
            return Err(format!("network:deezer HTTP {}", response.status().as_u16()));
        }
        let data: Value = response.json().await.map_err(|e| format!("error:deezer: {e}"))?;
        let Some(error) = data.get("error") else { return Ok(data) };
        match error["code"].as_u64() {
            Some(800) => return Err("unavailable:deleted".to_string()),
            Some(4 | 700) if attempt < QUOTA_RETRIES => {
                tokio::time::sleep(Duration::from_millis(1500 * (attempt as u64 + 1))).await;
            }
            _ => return Err(format!("error:deezer {}", error["message"].as_str().unwrap_or("error"))),
        }
    }
    Err("error:deezer quota".to_string())
}

/// Artists without a photo still get a picture URL, with an empty hash: `.../images/artist//1000x1000-...`.
fn picture(d: &Value) -> Option<String> {
    d["picture_xl"]
        .as_str()
        .or_else(|| d["picture_big"].as_str())
        .filter(|url| !url.contains("/artist//"))
        .map(str::to_string)
}

fn year(d: &Value) -> Option<u16> {
    d["release_date"].as_str()?.get(..4)?.parse().ok().filter(|y| *y > 0)
}

fn album_kind(record_type: Option<&str>) -> String {
    match record_type {
        Some("single") => "single",
        Some("ep") => "ep",
        _ => "album",
    }
    .to_string()
}

/// Clean / explicit twins of a release share title, type and year; the list stays newest first.
fn dedupe_albums(albums: &mut Vec<AlbumCard>) {
    let mut seen = std::collections::HashSet::new();
    albums.sort_by(|a, b| b.year.cmp(&a.year));
    albums.retain(|a| seen.insert((a.name.to_lowercase(), a.kind.clone(), a.year)));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids() {
        assert_eq!(track_id("dz-528330441"), Some(528330441));
        assert_eq!(track_id("7wtfhZwyrcc"), None);
        assert_eq!(artist_radio_id("dzartist-27"), Some(27));
        assert!(is_catalog_id("27"));
        assert!(!is_catalog_id("UC0C-w0YjGpqDXGB8IHb662A"));
        assert!(!is_catalog_id("MPREb_abc"));
    }

}
