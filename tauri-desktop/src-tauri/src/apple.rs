//! Artist search, artist and album pages from the iTunes Search API (Russian store): from Russia it has the full
//! discography with clean covers, unlike Deezer. Track search and the home feed stay on YouTube
//! Music, and so does the audio of Apple tracks (`MusicService::youtube_id`).
//!
//! Ids: artists and albums `ap:<id>`, tracks `it-<id>`; `name:<artist>` opens the Apple artist of
//! that name (YouTube results link artists this way). Apple allows about 20 API requests per
//! minute per address: answers are cached on disk, and after a 403/429 Apple is left alone for a
//! minute so pages come from YouTube Music instead. Artist photos are not in the API; they come
//! from the `og:image` of the artist's music.apple.com page.

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime};

use serde_json::Value;

use crate::deezer::TrackMeta;
use crate::music::{AlbumCard, AlbumPage, ArtistCard, ArtistPage, MusicTrack};

const API_URL: &str = "https://itunes.apple.com";
const PAGE_URL: &str = "https://music.apple.com/ru/artist";
const COUNTRY: &str = "ru";
pub const ID_PREFIX: &str = "ap:";
pub const ARTIST_NAME_PREFIX: &str = "name:";
const TRACK_PREFIX: &str = "it-";
const BLOCKED_FOR: Duration = Duration::from_secs(60);
const ARTIST_TTL: Duration = Duration::from_secs(24 * 3600);
const ALBUM_TTL: Duration = Duration::from_secs(7 * 24 * 3600);
/// `og:image` sits in the first few KB of an artist page that weighs half a megabyte.
const PAGE_HEAD_BYTES: usize = 32 * 1024;
const PHOTO_TIMEOUT: Duration = Duration::from_secs(4);
const SEARCH_ARTISTS: u32 = 8;
const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

pub fn track_id(id: &str) -> Option<u64> {
    id.strip_prefix(TRACK_PREFIX)?.parse().ok()
}

pub fn catalog_id(id: &str) -> Option<u64> {
    id.strip_prefix(ID_PREFIX)?.parse().ok()
}

pub struct Apple {
    http: reqwest::Client,
    cache_dir: OnceLock<PathBuf>,
    memory: Mutex<HashMap<String, Value>>,
    blocked_until: Mutex<Option<Instant>>,
    meta: Mutex<HashMap<u64, TrackMeta>>,
}

impl Apple {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(15))
                .build()
                .expect("apple http client"),
            cache_dir: OnceLock::new(),
            memory: Mutex::new(HashMap::new()),
            blocked_until: Mutex::new(None),
            meta: Mutex::new(HashMap::new()),
        }
    }

    pub fn set_cache_dir(&self, dir: PathBuf) {
        let dir = dir.join("apple-cache");
        let _ = std::fs::create_dir_all(&dir);
        let _ = self.cache_dir.set(dir);
    }

    fn cache_file(&self, key: &str) -> Option<PathBuf> {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        key.hash(&mut hasher);
        Some(self.cache_dir.get()?.join(format!("{:016x}.json", hasher.finish())))
    }

    fn cached(&self, key: &str, ttl: Duration) -> Option<Value> {
        if let Some(value) = self.memory.lock().unwrap().get(key) {
            return Some(value.clone());
        }
        let path = self.cache_file(key)?;
        let age = SystemTime::now().duration_since(std::fs::metadata(&path).ok()?.modified().ok()?).ok()?;
        if age > ttl {
            return None;
        }
        let value: Value = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
        self.memory.lock().unwrap().insert(key.to_string(), value.clone());
        Some(value)
    }

    fn store(&self, key: &str, value: &Value) {
        self.memory.lock().unwrap().insert(key.to_string(), value.clone());
        if let Some(path) = self.cache_file(key) {
            let _ = std::fs::write(path, value.to_string());
        }
    }

    async fn api(&self, path: &str, query: Vec<(&'static str, String)>, ttl: Duration) -> Result<Value, String> {
        let key = format!("{path}?{query:?}");
        if let Some(value) = self.cached(&key, ttl) {
            return Ok(value);
        }
        if self.blocked_until.lock().unwrap().is_some_and(|until| Instant::now() < until) {
            return Err("network:apple rate limit".to_string());
        }
        let response = self
            .http
            .get(format!("{API_URL}/{path}"))
            .query(&query)
            .query(&[("country", COUNTRY)])
            .send()
            .await
            .map_err(|e| format!("network:{e}"))?;
        let status = response.status().as_u16();
        if status == 403 || status == 429 {
            *self.blocked_until.lock().unwrap() = Some(Instant::now() + BLOCKED_FOR);
            return Err("network:apple rate limit".to_string());
        }
        if !response.status().is_success() {
            return Err(format!("network:apple HTTP {status}"));
        }
        let value: Value = response.json().await.map_err(|e| format!("error:apple: {e}"))?;
        self.store(&key, &value);
        Ok(value)
    }

    async fn lookup(&self, id: u64, entity: &str, limit: u32, ttl: Duration) -> Result<Vec<Value>, String> {
        let data = self
            .api("lookup", vec![("id", id.to_string()), ("entity", entity.to_string()), ("limit", limit.to_string())], ttl)
            .await?;
        Ok(data["results"].as_array().cloned().unwrap_or_default())
    }

    /// The Apple artist best matching `name`: exact name first, then Apple's own ranking.
    pub async fn find_artist(&self, name: &str) -> Result<u64, String> {
        let data = self
            .api(
                "search",
                vec![("term", name.to_string()), ("entity", "musicArtist".to_string()), ("limit", "10".to_string())],
                ARTIST_TTL,
            )
            .await?;
        let found = data["results"].as_array().cloned().unwrap_or_default();
        let wanted = comparable(name);
        found
            .iter()
            .find(|a| a["artistName"].as_str().is_some_and(|n| comparable(n) == wanted))
            .or(found.first())
            .and_then(|a| a["artistId"].as_u64())
            .ok_or_else(|| "unavailable:artist not found".to_string())
    }

    pub async fn artist_page(&self, id: u64) -> Result<ArtistPage, String> {
        let (songs, albums, photo) = tokio::join!(
            self.lookup(id, "song", 100, ARTIST_TTL),
            self.lookup(id, "album", 200, ARTIST_TTL),
            self.photo(id),
        );
        let songs = songs?;
        let name = songs
            .iter()
            .find(|d| d["wrapperType"] == "artist")
            .and_then(|d| d["artistName"].as_str())
            .unwrap_or_default()
            .to_string();
        let mut seen = std::collections::HashSet::new();
        let tracks = songs
            .iter()
            .filter_map(|d| self.track(d))
            .filter(|t| seen.insert(comparable(&t.title)))
            .collect();
        let mut albums: Vec<(String, AlbumCard)> = albums
            .unwrap_or_default()
            .iter()
            .filter(|d| d["wrapperType"] == "collection")
            .filter_map(|d| Some((d["releaseDate"].as_str().unwrap_or_default().to_string(), album_card(d)?)))
            .collect();
        albums.sort_by(|a, b| b.0.cmp(&a.0));
        let mut seen = std::collections::HashSet::new();
        Ok(ArtistPage {
            id: format!("{ID_PREFIX}{id}"),
            name,
            image_url: photo,
            description: None,
            subscribers: None,
            tracks,
            albums: albums
                .into_iter()
                .map(|(_, album)| album)
                .filter(|a| seen.insert((comparable(&a.name), a.kind.clone())))
                .collect(),
            similar: vec![],
            radio_id: None,
        })
    }

    pub async fn album_page(&self, id: u64) -> Result<AlbumPage, String> {
        let results = self.lookup(id, "song", 200, ALBUM_TTL).await?;
        let album = results
            .iter()
            .find(|d| d["wrapperType"] == "collection")
            .ok_or_else(|| "unavailable:deleted".to_string())?;
        let card = album_card(album).ok_or_else(|| "unavailable:deleted".to_string())?;
        let mut songs: Vec<&Value> = results.iter().filter(|d| d["wrapperType"] == "track").collect();
        songs.sort_by_key(|d| (d["discNumber"].as_u64().unwrap_or(1), d["trackNumber"].as_u64().unwrap_or(0)));
        Ok(AlbumPage {
            id: card.id,
            name: card.name,
            cover_url: card.cover_url,
            artist: card.artist,
            artist_id: album["artistId"].as_u64().map(|id| format!("{ID_PREFIX}{id}")),
            year: card.year,
            kind: card.kind,
            tracks: songs.into_iter().filter_map(|d| self.track(d)).collect(),
        })
    }

    /// Title, artist and duration of a track, from the pages already shown or the API.
    pub async fn track_meta(&self, id: u64) -> Result<TrackMeta, String> {
        if let Some(meta) = self.meta.lock().unwrap().get(&id) {
            return Ok(meta.clone());
        }
        let data = self.api("lookup", vec![("id", id.to_string())], ALBUM_TTL).await?;
        data["results"]
            .as_array()
            .into_iter()
            .flatten()
            .find_map(|d| self.track(d))
            .ok_or_else(|| "unavailable:deleted".to_string())?;
        self.meta.lock().unwrap().get(&id).cloned().ok_or_else(|| "unavailable:deleted".to_string())
    }

    /// Artists for a search query, in Apple's ranking, with photos (one API request).
    pub async fn search_artists(&self, query: &str) -> Result<Vec<ArtistCard>, String> {
        let data = self
            .api(
                "search",
                vec![("term", query.to_string()), ("entity", "musicArtist".to_string()), ("limit", SEARCH_ARTISTS.to_string())],
                ARTIST_TTL,
            )
            .await?;
        let found: Vec<(u64, String)> = data["results"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|a| Some((a["artistId"].as_u64()?, a["artistName"].as_str()?.to_string())))
            .collect();
        let photos = self.photos(found.iter().map(|(id, _)| *id).collect()).await;
        Ok(found
            .into_iter()
            .map(|(id, name)| ArtistCard {
                id: format!("{ID_PREFIX}{id}"),
                name,
                image_url: photos.get(&id).cloned().flatten(),
                subscribers: None,
            })
            .collect())
    }

    /// Artist photo from the `og:image` of the music.apple.com page (the API has none).
    async fn photo(&self, id: u64) -> Option<String> {
        self.photos(vec![id]).await.remove(&id).flatten()
    }

    /// Photos of several artists, fetched in parallel; a slow page just leaves its artist without one.
    async fn photos(&self, ids: Vec<u64>) -> HashMap<u64, Option<String>> {
        let mut photos = HashMap::new();
        let mut pending = tokio::task::JoinSet::new();
        for id in ids {
            match self.cached(&format!("photo:{id}"), ALBUM_TTL) {
                Some(value) => {
                    photos.insert(id, value.as_str().map(str::to_string));
                }
                None => {
                    let http = self.http.clone();
                    pending.spawn(async move {
                        (id, tokio::time::timeout(PHOTO_TIMEOUT, fetch_photo(http, id)).await.ok().flatten())
                    });
                }
            }
        }
        while let Some(Ok((id, url))) = pending.join_next().await {
            if let Some(url) = url {
                self.store(&format!("photo:{id}"), &url.clone().map(Value::String).unwrap_or(Value::Null));
                photos.insert(id, url);
            }
        }
        photos
    }

    fn track(&self, d: &Value) -> Option<MusicTrack> {
        if d["wrapperType"] != "track" || d["kind"] != "song" {
            return None;
        }
        let id = d["trackId"].as_u64()?;
        let title = d["trackName"].as_str()?.to_string();
        let artist = d["artistName"].as_str().unwrap_or_default().to_string();
        let duration = (d["trackTimeMillis"].as_u64().unwrap_or(0) / 1000) as u32;
        self.meta
            .lock()
            .unwrap()
            .insert(id, TrackMeta { title: title.clone(), artist: artist.clone(), duration });
        Some(MusicTrack {
            video_id: format!("{TRACK_PREFIX}{id}"),
            title,
            artist,
            duration_seconds: duration,
            thumbnail_url: artwork(d),
            artist_id: d["artistId"].as_u64().map(|id| format!("{ID_PREFIX}{id}")),
            source: None,
        })
    }
}

fn album_card(d: &Value) -> Option<AlbumCard> {
    let id = d["collectionId"].as_u64()?;
    let full = d["collectionName"].as_str().unwrap_or_default();
    let (name, kind) = if let Some(name) = full.strip_suffix(" - Single") {
        (name, "single")
    } else if let Some(name) = full.strip_suffix(" - EP") {
        (name, "ep")
    } else if d["trackCount"].as_u64().unwrap_or(0) <= 3 {
        (full, "single")
    } else {
        (full, "album")
    };
    Some(AlbumCard {
        id: format!("{ID_PREFIX}{id}"),
        name: name.to_string(),
        cover_url: artwork(d),
        artist: d["artistName"].as_str().unwrap_or_default().to_string(),
        year: d["releaseDate"].as_str().and_then(|date| date.get(..4)).and_then(|year| year.parse().ok()),
        kind: kind.to_string(),
    })
}

/// `artworkUrl100` is a 100×100 rendition; the same URL serves any size.
fn artwork(d: &Value) -> Option<String> {
    d["artworkUrl100"].as_str().map(|url| url.replace("100x100bb", "600x600bb"))
}

/// The artist's photo URL, `Some(None)` when the page has none; `None` when the page didn't load.
async fn fetch_photo(http: reqwest::Client, id: u64) -> Option<Option<String>> {
    let mut response = http
        .get(format!("{PAGE_URL}/{id}"))
        .header("User-Agent", BROWSER_USER_AGENT)
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let mut head = Vec::new();
    while head.len() < PAGE_HEAD_BYTES {
        match response.chunk().await {
            Ok(Some(chunk)) => head.extend_from_slice(&chunk),
            Ok(None) => break,
            Err(_) => return None,
        }
    }
    Some(og_image(&String::from_utf8_lossy(&head)).map(square_artwork))
}

fn og_image(html: &str) -> Option<String> {
    let at = html.find("property=\"og:image\"")?;
    let tag_start = html[..at].rfind('<')?;
    let tag = &html[tag_start..at + html[at..].find('>')?];
    let content = tag.split("content=\"").nth(1)?;
    Some(content[..content.find('"')?].to_string())
}

/// `…/1200x630cw.png` (a wide social card) → `…/600x600cc.jpg`, a centered square.
fn square_artwork(url: String) -> String {
    match url.rfind('/') {
        Some(slash) => format!("{}/600x600cc.jpg", &url[..slash]),
        None => url,
    }
}

fn comparable(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids() {
        assert_eq!(track_id("it-1440833098"), Some(1440833098));
        assert_eq!(track_id("dz-1"), None);
        assert_eq!(catalog_id("ap:943459711"), Some(943459711));
        assert_eq!(catalog_id("943459711"), None);
    }

    #[test]
    fn artist_photo_from_page() {
        let html = r#"<meta name="x"><meta property="og:image" content="https://is1-ssl.mzstatic.com/image/thumb/A/v4/f.png/1200x630cw.png">"#;
        assert_eq!(
            og_image(html).map(square_artwork).as_deref(),
            Some("https://is1-ssl.mzstatic.com/image/thumb/A/v4/f.png/600x600cc.jpg")
        );
    }
}
