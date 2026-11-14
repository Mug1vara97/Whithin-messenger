//! Music for the desktop client: track search, the home feed and all audio come from YouTube
//! Music; artist and album pages from Apple (`apple.rs`), with YouTube Music as their fallback.
//! Track search also looks at plain YouTube videos and SoundCloud (`soundcloud.rs`) for songs
//! YouTube Music lacks.
//! Deezer (`deezer.rs`) only serves `dz-…` tracks and pages saved while it was the catalog.
//!
//! YouTube traffic goes through `yt_net` (the Whithin server tunnel, or local DPI tricks).
//!
//! Audio reaches the webview through the `whithin-music` URI scheme, served in ranged
//! chunks (YouTube throttles large single requests), so `<audio>` can seek freely.

use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use rustypipe::client::RustyPipe;
use rustypipe::error::{Error as RpError, ExtractionError};
use rustypipe::model::paginator::Paginator;
use rustypipe::model::{AlbumItem, AlbumType, ArtistItem, AudioFormat, Thumbnail, TrackItem, VideoItem};
use rustypipe::param::search_filter::{ItemType, SearchFilter};
use rustypipe::param::{Country, Language, StreamFilter};
use serde::Serialize;
use tokio::sync::Mutex;

use crate::apple::{self, Apple};
use crate::deezer::{self, Deezer};
use crate::music_library::MusicLibrary;
use crate::soundcloud::{self, SoundCloud};

pub const SCHEME: &str = "whithin-music";
/// Stream URL of audio already on disk (SoundCloud tracks); the audio host reads it directly.
pub const LOCAL_FILE_PREFIX: &str = "file:///";

const URL_SAFETY_MARGIN: Duration = Duration::from_secs(5 * 60);
const CHUNK_SIZE: u64 = 1024 * 1024;
const CHUNK_ATTEMPTS: u32 = 4;
/// visionOS YouTube app identity, as in NewPipeExtractor's ClientsConstants.
const VISIONOS_VERSION: &str = "1.04";
const VISIONOS_DEVICE: &str = "RealityDevice17,1";
const VISIONOS_OS: &str = "26.6.0.23O770";
const VISIONOS_USER_AGENT: &str =
    "com.google.visionos.youtube/1.04(RealityDevice17,1; U; CPU visionOS 26_6_0 like Mac OS X; US)";
const MAX_PAGERS: usize = 32;
const EXTRA_RESULTS: usize = 8;
const EXTRA_SEARCH_TIMEOUT: Duration = Duration::from_secs(6);
const VIDEO_MIN_SECONDS: u32 = 60;
const VIDEO_MAX_SECONDS: u32 = 15 * 60;
const UPSTREAM_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0";

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrack {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub duration_seconds: u32,
    pub thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_id: Option<String>,
    /// Shown next to search hits that are not YouTube Music songs ("YouTube", "SoundCloud").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ArtistCard {
    pub id: String,
    pub name: String,
    pub image_url: Option<String>,
    pub subscribers: Option<u64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlbumCard {
    pub id: String,
    pub name: String,
    pub cover_url: Option<String>,
    pub artist: String,
    pub year: Option<u16>,
    pub kind: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ArtistPage {
    pub id: String,
    pub name: String,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub subscribers: Option<u64>,
    pub tracks: Vec<MusicTrack>,
    pub albums: Vec<AlbumCard>,
    pub similar: Vec<ArtistCard>,
    pub radio_id: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlbumPage {
    pub id: String,
    pub name: String,
    pub cover_url: Option<String>,
    pub artist: String,
    pub artist_id: Option<String>,
    pub year: Option<u16>,
    pub kind: String,
    pub tracks: Vec<MusicTrack>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HomeFeed {
    pub top_tracks: Vec<MusicTrack>,
    pub trending: Vec<MusicTrack>,
    pub artists: Vec<ArtistCard>,
    pub new_albums: Vec<AlbumCard>,
}

pub struct PlaybackStream {
    pub url: String,
    pub user_agent: String,
    pub size: u64,
    pub mime: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchPage {
    pub search_id: String,
    pub tracks: Vec<MusicTrack>,
    pub has_more: bool,
}

#[derive(Clone)]
struct ResolvedAudio {
    url: String,
    /// googlevideo cuts the stream after the first chunk unless this matches the client
    /// (iOS / TV …) the URL was issued to.
    user_agent: String,
    size: u64,
    mime: String,
    expires: Instant,
}

pub struct MusicService {
    storage_dir: OnceLock<PathBuf>,
    client: OnceLock<RustyPipe>,
    http: reqwest::Client,
    pagers: Mutex<HashMap<String, Paginator<TrackItem>>>,
    pager_order: Mutex<VecDeque<String>>,
    resolved: Mutex<HashMap<String, ResolvedAudio>>,
    home: Mutex<Option<(Instant, HomeFeed)>>,
    pub library: MusicLibrary,
    next_search_id: std::sync::atomic::AtomicU64,
    /// Only for `dz-…` tracks, numeric artist / album ids and `dzartist-…` radios saved earlier.
    deezer: Deezer,
    apple: Apple,
    soundcloud: SoundCloud,
    pub local: crate::local_music::LocalMusic,
    /// Catalog track id (`it-…`, `dz-…`) → YouTube video id with its audio, kept in `youtube-matches.json`.
    youtube_ids: Mutex<Option<HashMap<String, String>>>,
}

impl MusicService {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            storage_dir: OnceLock::new(),
            client: OnceLock::new(),
            http: youtube_client_builder()
                .user_agent(UPSTREAM_USER_AGENT)
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(30))
                .build()
                .expect("music http client"),
            pagers: Mutex::new(HashMap::new()),
            pager_order: Mutex::new(VecDeque::new()),
            resolved: Mutex::new(HashMap::new()),
            home: Mutex::new(None),
            library: MusicLibrary::new(),
            next_search_id: std::sync::atomic::AtomicU64::new(1),
            deezer: Deezer::new(),
            apple: Apple::new(),
            soundcloud: SoundCloud::new(),
            local: Default::default(),
            youtube_ids: Mutex::new(None),
        })
    }

    /// RustyPipe keeps client versions and the deobfuscation script here.
    pub fn set_storage_dir(&self, dir: PathBuf) {
        let _ = std::fs::create_dir_all(&dir);
        self.library.set_storage_dir(dir.clone());
        self.apple.set_cache_dir(dir.clone());
        self.soundcloud.set_storage_dir(dir.clone());
        let _ = self.storage_dir.set(dir);
    }

    pub fn storage_dir(&self) -> Option<&PathBuf> {
        self.storage_dir.get()
    }

    fn rp(&self) -> Result<&RustyPipe, String> {
        if let Some(rp) = self.client.get() {
            return Ok(rp);
        }
        let mut builder = RustyPipe::builder()
            .lang(Language::Ru)
            .country(Country::Ru)
            .timeout(Duration::from_secs(20))
            .no_botguard();
        if let Some(dir) = self.storage_dir.get() {
            builder = builder.storage_dir(dir.clone());
        }
        let rp = builder
            .build_with_client(youtube_client_builder())
            .map_err(|e| format!("init: {e}"))?;
        Ok(self.client.get_or_init(|| rp))
    }

    /// Turns a RustyPipe error into a UI error code.
    fn classify(err: RpError) -> String {
        match err {
            RpError::Extraction(ExtractionError::Unavailable { reason, .. }) => format!("unavailable:{reason}"),
            RpError::Extraction(ExtractionError::NotFound { .. }) => "unavailable:deleted".to_string(),
            RpError::Http(msg) => format!("network:{msg}"),
            other => format!("error:{other}"),
        }
    }

    fn new_search_id(&self) -> String {
        format!("s{}", self.next_search_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed))
    }

    pub async fn search(&self, query: &str) -> Result<SearchPage, String> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(SearchPage { search_id: String::new(), tracks: vec![], has_more: false });
        }
        let rp = self.rp()?;
        let songs_query = rp.query();
        let (songs, extras) = tokio::join!(songs_query.music_search_tracks(query), self.extra_search(query));
        let result = match songs {
            Ok(r) => r,
            Err(e) => return Err(Self::classify(e)),
        };
        let search_id = self.new_search_id();
        let songs = result.items.items.iter().filter_map(to_track).collect();
        let page = SearchPage {
            search_id: search_id.clone(),
            tracks: merge_results(query, songs, extras),
            has_more: result.items.ctoken.is_some(),
        };
        self.remember_pager(search_id, result.items).await;
        Ok(page)
    }

    /// Plain YouTube videos and SoundCloud: songs missing from YouTube Music (labels pulled from
    /// the Russian catalog, self-released artists) are often there.
    async fn extra_search(&self, query: &str) -> Vec<MusicTrack> {
        let videos = async {
            let filter = SearchFilter::new().item_type(ItemType::Video);
            let found = self.rp()?.query().search_filter::<VideoItem, _>(query, &filter).await.map_err(Self::classify)?;
            Ok::<_, String>(found.items.items.iter().filter_map(video_to_track).take(EXTRA_RESULTS).collect::<Vec<_>>())
        };
        let soundcloud = self.soundcloud.search(query, EXTRA_RESULTS);
        let (videos, soundcloud) = tokio::join!(
            tokio::time::timeout(EXTRA_SEARCH_TIMEOUT, videos),
            tokio::time::timeout(EXTRA_SEARCH_TIMEOUT, soundcloud)
        );
        let mut tracks = Vec::new();
        for (source, result) in [("YouTube videos", videos), ("SoundCloud", soundcloud)] {
            match result {
                Ok(Ok(found)) => tracks.extend(found),
                Ok(Err(e)) => crate::yt_net::log(&format!("[music] {source} search failed: {e}")),
                Err(_) => crate::yt_net::log(&format!("[music] {source} search timed out")),
            }
        }
        tracks
    }

    pub async fn search_more(&self, search_id: &str) -> Result<SearchPage, String> {
        let pager = self.pagers.lock().await.get(search_id).cloned();
        let Some(pager) = pager else {
            return Ok(SearchPage { search_id: search_id.to_string(), tracks: vec![], has_more: false });
        };
        let rp = self.rp()?;
        let next = match pager.next(rp.query()).await {
            Ok(n) => n,
            Err(e) => return Err(Self::classify(e)),
        };
        let Some(next) = next else {
            return Ok(SearchPage { search_id: search_id.to_string(), tracks: vec![], has_more: false });
        };
        let page = SearchPage {
            search_id: search_id.to_string(),
            tracks: next.items.iter().filter_map(to_track).collect(),
            has_more: next.ctoken.is_some(),
        };
        self.pagers.lock().await.insert(search_id.to_string(), next);
        Ok(page)
    }

    /// Apple's artists (they open Apple pages); YouTube Music's when Apple fails or finds nobody.
    pub async fn search_artists(&self, query: &str) -> Result<Vec<ArtistCard>, String> {
        if query.trim().is_empty() {
            return Ok(vec![]);
        }
        match self.apple.search_artists(query.trim()).await {
            Ok(artists) if !artists.is_empty() => return Ok(artists),
            Ok(_) => {}
            Err(e) => crate::yt_net::log(&format!("[music] apple artist search failed ({e}), using YouTube")),
        }
        let result = self.rp()?.query().music_search_artists(query.trim()).await.map_err(Self::classify)?;
        Ok(result.items.items.iter().map(to_artist).collect())
    }

    /// Artist pages are Apple's: `ap:<id>`, or `name:<artist>` from YouTube results. YouTube Music
    /// serves them when Apple fails (rate limit, unknown artist) and for channel ids saved earlier;
    /// numeric ids are Deezer's, also from earlier.
    pub async fn artist(&self, artist_id: &str) -> Result<ArtistPage, String> {
        if let Some(id) = apple::catalog_id(artist_id) {
            return self.apple.artist_page(id).await;
        }
        if let Some(name) = artist_id.strip_prefix(apple::ARTIST_NAME_PREFIX) {
            let apple = match self.apple.find_artist(name).await {
                Ok(id) => self.apple.artist_page(id).await,
                Err(e) => Err(e),
            };
            return match apple {
                Ok(page) => Ok(page),
                Err(e) => {
                    crate::yt_net::log(&format!("[music] apple artist failed ({e}), using YouTube"));
                    let found = self.rp()?.query().music_search_artists(name).await.map_err(Self::classify)?;
                    let wanted = comparable(name);
                    let artist = found
                        .items
                        .items
                        .iter()
                        .find(|a| comparable(&a.name) == wanted)
                        .or(found.items.items.first())
                        .ok_or_else(|| "unavailable:artist not found".to_string())?;
                    self.youtube_artist(&artist.id).await
                }
            };
        }
        if deezer::is_catalog_id(artist_id) {
            return self.deezer.artist_page(artist_id).await;
        }
        self.youtube_artist(artist_id).await
    }

    async fn youtube_artist(&self, artist_id: &str) -> Result<ArtistPage, String> {
        let artist = self.rp()?.query().music_artist(artist_id, false).await.map_err(Self::classify)?;
        let image_url = artist
            .header_image
            .iter()
            .max_by_key(|t| t.width * t.height)
            .map(|t| t.url.clone());
        Ok(ArtistPage {
            id: artist.id.clone(),
            name: artist.name.clone(),
            image_url,
            description: artist.description.clone(),
            subscribers: artist.subscriber_count,
            tracks: artist.tracks.iter().filter_map(to_track).collect(),
            albums: artist.albums.iter().map(to_album).collect(),
            similar: artist.similar_artists.iter().map(to_artist).collect(),
            radio_id: artist.radio_id.clone(),
        })
    }

    pub async fn album(&self, album_id: &str) -> Result<AlbumPage, String> {
        if let Some(id) = apple::catalog_id(album_id) {
            return self.apple.album_page(id).await;
        }
        if deezer::is_catalog_id(album_id) {
            return self.deezer.album_page(album_id).await;
        }
        let album = self.rp()?.query().music_album(album_id).await.map_err(Self::classify)?;
        let cover_url = best_thumbnail(&album.cover);
        let tracks = album
            .tracks
            .iter()
            .filter_map(to_track)
            .map(|mut t| {
                if t.thumbnail_url.is_none() {
                    t.thumbnail_url = cover_url.clone();
                }
                t
            })
            .collect();
        Ok(AlbumPage {
            id: album.id.clone(),
            name: album.name.clone(),
            cover_url,
            artist: album.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
            artist_id: album.artist_id.clone(),
            year: album.year,
            kind: album_kind(album.album_type),
            tracks,
        })
    }

    /// Endless-mix tracks: seeded by a track (video id) or an artist radio id. Apple and Deezer
    /// tracks seed the YouTube Music radio of their matched video.
    pub async fn radio(&self, seed: &str) -> Result<Vec<MusicTrack>, String> {
        if deezer::artist_radio_id(seed).is_some() {
            return self.deezer.radio(seed).await;
        }
        if apple::track_id(seed).is_some() || deezer::track_id(seed).is_some() {
            let video_id = self.youtube_id(seed).await?;
            let pager = self.rp()?.query().music_radio_track(&video_id).await.map_err(Self::classify)?;
            return Ok(pager.items.iter().filter_map(to_track).collect());
        }
        let query = self.rp()?.query();
        let pager = if is_video_id(seed) { query.music_radio_track(seed).await } else { query.music_radio(seed).await }
            .map_err(Self::classify)?;
        Ok(pager.items.iter().filter_map(to_track).collect())
    }

    pub async fn home(&self) -> Result<HomeFeed, String> {
        if let Some((at, feed)) = self.home.lock().await.as_ref() {
            if at.elapsed() < Duration::from_secs(30 * 60) {
                return Ok(feed.clone());
            }
        }
        let feed = self.home_youtube().await?;
        *self.home.lock().await = Some((Instant::now(), feed.clone()));
        Ok(feed)
    }

    async fn home_youtube(&self) -> Result<HomeFeed, String> {
        let query = self.rp()?.query();
        let charts = query.music_charts(Some(Country::Ru)).await;
        let albums = query.music_new_albums().await;
        if let (Err(e), Err(_)) = (&charts, &albums) {
            return Err(format!("network:{e}"));
        }
        let mut feed = HomeFeed { top_tracks: vec![], trending: vec![], artists: vec![], new_albums: vec![] };
        if let Ok(charts) = charts {
            feed.top_tracks = charts.top_tracks.iter().filter_map(to_track).collect();
            feed.trending = charts.trending_tracks.iter().filter_map(to_track).collect();
            feed.artists = charts.artists.iter().map(to_artist).collect();
        }
        if let Ok(albums) = albums {
            feed.new_albums = albums.iter().map(to_album).collect();
        }
        Ok(feed)
    }

    fn youtube_ids_file(&self) -> Option<PathBuf> {
        // v2: matches made before strict matching may be other songs.
        self.storage_dir.get().map(|dir| dir.join("youtube-matches-v2.json"))
    }

    /// YouTube video with the audio of a track: the id itself for YouTube tracks; for Deezer and
    /// Apple ones the best YouTube Music search hit by title, artist and duration, remembered.
    async fn youtube_id(&self, id: &str) -> Result<String, String> {
        if deezer::track_id(id).is_none() && apple::track_id(id).is_none() {
            return if is_video_id(id) { Ok(id.to_string()) } else { Err("error:bad id".to_string()) };
        }
        {
            let mut ids = self.youtube_ids.lock().await;
            let ids = ids.get_or_insert_with(|| {
                self.youtube_ids_file()
                    .and_then(|path| std::fs::read(path).ok())
                    .and_then(|bytes| serde_json::from_slice(&bytes).ok())
                    .unwrap_or_default()
            });
            if let Some(video_id) = ids.get(id) {
                return Ok(video_id.clone());
            }
        }
        let meta = match (deezer::track_id(id), apple::track_id(id)) {
            (Some(deezer_id), _) => self.deezer.track_meta(deezer_id).await?,
            (_, Some(apple_id)) => self.apple.track_meta(apple_id).await?,
            _ => unreachable!("checked above"),
        };
        let bare_title = meta.title.split(['(', '[']).next().unwrap_or(&meta.title).trim();
        let query = format!(
            "{} {} {}",
            meta.artist.split([',', '&']).next().unwrap_or(&meta.artist).trim(),
            bare_title,
            versions(&comparable(&meta.title)).join(" ")
        );
        let result = self.rp()?.query().music_search_tracks(query.trim()).await.map_err(Self::classify)?;
        let songs: Vec<MusicTrack> = result.items.items.iter().filter_map(to_track).collect();
        let video_id = match best_youtube_match(&songs, &meta) {
            Some(id) => id,
            None => {
                let filter = SearchFilter::new().item_type(ItemType::Video);
                let videos = self.rp()?.query().search_filter::<VideoItem, _>(query.trim(), &filter).await.map_err(Self::classify)?;
                let videos: Vec<MusicTrack> = videos.items.items.iter().filter_map(video_to_track).collect();
                best_youtube_match(&videos, &meta).ok_or_else(|| "unavailable:not found on YouTube".to_string())?
            }
        };
        let mut ids = self.youtube_ids.lock().await;
        let ids = ids.get_or_insert_with(HashMap::new);
        ids.insert(id.to_string(), video_id.clone());
        if let (Some(path), Ok(json)) = (self.youtube_ids_file(), serde_json::to_vec(&*ids)) {
            let _ = std::fs::write(path, json);
        }
        Ok(video_id)
    }

    async fn remember_pager(&self, id: String, pager: Paginator<TrackItem>) {
        let mut order = self.pager_order.lock().await;
        let mut pagers = self.pagers.lock().await;
        order.push_back(id.clone());
        pagers.insert(id, pager);
        while order.len() > MAX_PAGERS {
            if let Some(old) = order.pop_front() {
                pagers.remove(&old);
            }
        }
    }

    /// Stream URL of a track being played; only fetched again once it is about to expire,
    /// otherwise every audio chunk would cost a player API call.
    async fn current_stream(&self, video_id: &str) -> Result<ResolvedAudio, String> {
        if let Some(audio) = self.cached(video_id).await {
            return Ok(audio);
        }
        self.resolve(video_id).await
    }

    async fn resolve(&self, video_id: &str) -> Result<ResolvedAudio, String> {
        let audio = match self.resolve_visionos(video_id).await {
            Ok(audio) => audio,
            Err(e) => {
                eprintln!("[music] {video_id}: visionOS player failed ({e}), falling back to RustyPipe");
                self.resolve_rustypipe(video_id).await?
            }
        };
        let mut resolved = self.resolved.lock().await;
        resolved.retain(|_, a| a.expires > Instant::now());
        resolved.insert(video_id.to_string(), audio.clone());
        Ok(audio)
    }

    /// Same client NewPipe uses: its URLs carry no `n` parameter, so they need no player-JS
    /// deobfuscation (iOS/web URLs without it are cut off with 403 after the first megabyte).
    async fn resolve_visionos(&self, video_id: &str) -> Result<ResolvedAudio, String> {
        let visitor = self
            .rp()?
            .query()
            .get_visitor_data(false)
            .await
            .map_err(|e| format!("visitor data: {e}"))?;
        let cpn = random_token(16);
        let body = serde_json::json!({
            "context": { "client": {
                "clientName": "VISIONOS",
                "clientVersion": VISIONOS_VERSION,
                "clientScreen": "WATCH",
                "platform": "MOBILE",
                "deviceMake": "Apple",
                "deviceModel": VISIONOS_DEVICE,
                "osName": "visionOS",
                "osVersion": VISIONOS_OS,
                "hl": "en",
                "gl": "US",
                "visitorData": visitor,
            }},
            "videoId": video_id,
            "cpn": cpn,
            "contentCheckOk": true,
            "racyCheckOk": true,
        });
        let response: serde_json::Value = self
            .http
            .post(format!(
                "https://youtubei.googleapis.com/youtubei/v1/player?prettyPrint=false&t={}&id={video_id}",
                random_token(12)
            ))
            .header("User-Agent", VISIONOS_USER_AGENT)
            .header("X-Goog-Api-Format-Version", "2")
            .header("X-Goog-Visitor-Id", visitor.as_str())
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network:{e}"))?
            .json()
            .await
            .map_err(|e| format!("error:bad player response: {e}"))?;

        let status = response["playabilityStatus"]["status"].as_str().unwrap_or("");
        if status != "OK" {
            let reason = response["playabilityStatus"]["reason"].as_str().unwrap_or(status);
            return Err(format!("unavailable:{reason}"));
        }
        let data = &response["streamingData"];
        let audio_formats = || {
            data["adaptiveFormats"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|f| f["mimeType"].as_str().is_some_and(|m| m.starts_with("audio/")) && f["url"].is_string())
        };
        // The audio host decodes AAC only (no Opus decoder in pure Rust).
        let format = audio_formats()
            .filter(|f| f["mimeType"].as_str().is_some_and(|m| m.starts_with("audio/mp4")))
            .max_by_key(|f| f["bitrate"].as_u64().unwrap_or(0))
            .or_else(|| audio_formats().max_by_key(|f| f["bitrate"].as_u64().unwrap_or(0)))
            .ok_or_else(|| "unavailable:no audio stream".to_string())?;
        let lifetime = data["expiresInSeconds"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok())
            .map(Duration::from_secs)
            .unwrap_or(Duration::from_secs(6 * 3600))
            .saturating_sub(URL_SAFETY_MARGIN);
        Ok(ResolvedAudio {
            url: format!("{}&cpn={cpn}", format["url"].as_str().unwrap_or_default()),
            user_agent: VISIONOS_USER_AGENT.to_string(),
            size: format["contentLength"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0),
            mime: format["mimeType"]
                .as_str()
                .and_then(|m| m.split(';').next())
                .unwrap_or("audio/webm")
                .trim()
                .to_string(),
            expires: Instant::now() + lifetime.max(Duration::from_secs(60)),
        })
    }

    async fn resolve_rustypipe(&self, video_id: &str) -> Result<ResolvedAudio, String> {
        let rp = self.rp()?;
        let player = match rp.query().player(video_id).await {
            Ok(p) => p,
            Err(e) => return Err(Self::classify(e)),
        };
        let m4a = StreamFilter::new().audio_formats([AudioFormat::M4a]);
        let stream = player
            .select_audio_stream(&m4a)
            .or_else(|| player.select_audio_stream(&StreamFilter::new()))
            .ok_or_else(|| "unavailable:no audio stream".to_string())?;
        let lifetime = Duration::from_secs(player.expires_in_seconds as u64).saturating_sub(URL_SAFETY_MARGIN);
        Ok(ResolvedAudio {
            url: stream.url.clone(),
            user_agent: rp.query().user_agent(player.client_type).into_owned(),
            size: stream.size,
            mime: stream.mime.split(';').next().unwrap_or("audio/mp4").trim().to_string(),
            expires: Instant::now() + lifetime.max(Duration::from_secs(60)),
        })
    }

    async fn cached(&self, video_id: &str) -> Option<ResolvedAudio> {
        let resolved = self.resolved.lock().await;
        resolved.get(video_id).filter(|a| a.expires > Instant::now()).cloned()
    }

    async fn forget(&self, video_id: &str) {
        self.resolved.lock().await.remove(video_id);
    }

    fn downloads_dir(&self) -> Result<PathBuf, String> {
        let dir = self.storage_dir.get().ok_or("error:no storage")?.join("downloads");
        std::fs::create_dir_all(&dir).map_err(|e| format!("error:{e}"))?;
        Ok(dir)
    }

    /// The saved copy of an account track, if it was downloaded on this computer.
    pub fn downloaded(&self, track_id: &str) -> Option<PathBuf> {
        if !track_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
            return None;
        }
        let path = self.downloads_dir().ok()?.join(format!("{track_id}.m4a"));
        path.is_file().then_some(path)
    }

    pub fn downloaded_ids(&self) -> Vec<String> {
        let Ok(dir) = self.downloads_dir() else { return Vec::new() };
        std::fs::read_dir(dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|e| e.file_name().to_str()?.strip_suffix(".m4a").map(str::to_string))
            .collect()
    }

    pub fn delete_download(&self, track_id: &str) -> Result<(), String> {
        match self.downloaded(track_id) {
            Some(path) => std::fs::remove_file(path).map_err(|e| format!("error:{e}")),
            None => Ok(()),
        }
    }

    /// Saves an account track's audio on this computer, so it plays without the network.
    pub async fn download(&self, track_id: &str) -> Result<(), String> {
        if self.downloaded(track_id).is_some() {
            return Ok(());
        }
        if crate::local_music::track_id(track_id).is_some() {
            return Err("error:already a file".to_string());
        }
        let target = self.downloads_dir()?.join(format!("{track_id}.m4a"));
        let partial = target.with_extension("part");
        if soundcloud::track_id(track_id).is_some() {
            let source = self.soundcloud.audio_file(track_id).await?;
            std::fs::copy(source, &partial).map_err(|e| format!("error:{e}"))?;
            return std::fs::rename(&partial, &target).map_err(|e| format!("error:{e}"));
        }
        let video_id = self.youtube_id(track_id).await?;
        let mut file = Vec::new();
        let mut attempts = 0;
        loop {
            let audio = self.current_stream(&video_id).await?;
            if audio.mime != "audio/mp4" {
                return Err("unavailable:no AAC stream to save".to_string());
            }
            let start = file.len() as u64;
            if audio.size > 0 && start >= audio.size {
                break;
            }
            let end = if audio.size > 0 { (start + CHUNK_SIZE - 1).min(audio.size - 1) } else { start + CHUNK_SIZE - 1 };
            let response = self
                .http
                .get(&audio.url)
                .header("User-Agent", audio.user_agent.as_str())
                .header("Range", format!("bytes={start}-{end}"))
                .send()
                .await;
            let chunk = match response {
                Ok(r) if r.status().is_success() => r.bytes().await.map_err(|e| format!("network:{e}")),
                Ok(r) => {
                    if matches!(r.status().as_u16(), 403 | 410) {
                        self.forget(&video_id).await;
                    }
                    Err(format!("upstream:{}", r.status().as_u16()))
                }
                Err(e) => Err(format!("network:{e}")),
            };
            match chunk {
                Ok(bytes) if !bytes.is_empty() => {
                    attempts = 0;
                    file.extend_from_slice(&bytes);
                    if audio.size == 0 && (bytes.len() as u64) < CHUNK_SIZE {
                        break;
                    }
                }
                Ok(_) if audio.size == 0 => break,
                other => {
                    attempts += 1;
                    if attempts >= CHUNK_ATTEMPTS * 2 {
                        return Err(other.err().unwrap_or_else(|| "upstream:empty".to_string()));
                    }
                    tokio::time::sleep(Duration::from_millis(300 * attempts as u64)).await;
                }
            }
        }
        std::fs::write(&partial, &file).map_err(|e| format!("error:{e}"))?;
        std::fs::rename(&partial, &target).map_err(|e| format!("error:{e}"))
    }

    /// Stream handed to the audio host; `fresh` drops a URL that googlevideo rejected.
    pub async fn stream_for_playback(&self, track_id: &str, fresh: bool) -> Result<PlaybackStream, String> {
        if let Some(path) = self.downloaded(track_id) {
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            return Ok(PlaybackStream {
                url: format!("{}{}", LOCAL_FILE_PREFIX, path.display()),
                user_agent: String::new(),
                size,
                mime: "audio/mp4".to_string(),
            });
        }
        if crate::local_music::track_id(track_id).is_some() {
            let path = self.local.path(track_id)?;
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            return Ok(PlaybackStream {
                url: format!("{}{}", LOCAL_FILE_PREFIX, path.display()),
                user_agent: String::new(),
                size,
                mime: crate::local_music::mime(&path).to_string(),
            });
        }
        if soundcloud::track_id(track_id).is_some() {
            let path = self.soundcloud.audio_file(track_id).await?;
            let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            return Ok(PlaybackStream {
                url: format!("{}{}", LOCAL_FILE_PREFIX, path.display()),
                user_agent: String::new(),
                size,
                mime: "audio/mp4".to_string(),
            });
        }
        let video_id = self.youtube_id(track_id).await?;
        if fresh {
            self.forget(&video_id).await;
        }
        let audio = self.current_stream(&video_id).await?;
        Ok(PlaybackStream { url: audio.url, user_agent: audio.user_agent, size: audio.size, mime: audio.mime })
    }

    /// Resolves the stream up front so the UI learns about unavailable tracks before playback.
    pub async fn prepare(&self, track_id: &str) -> Result<String, String> {
        if self.downloaded(track_id).is_some() {
            return Ok(stream_url(track_id));
        }
        if crate::local_music::track_id(track_id).is_some() {
            self.local.path(track_id)?;
            return Ok(stream_url(track_id));
        }
        if soundcloud::track_id(track_id).is_some() {
            self.soundcloud.audio_file(track_id).await?;
            return Ok(stream_url(track_id));
        }
        let video_id = self.youtube_id(track_id).await?;
        self.resolve(&video_id).await?;
        Ok(stream_url(track_id))
    }

    /// Cover art fetched through the bypass proxy (`/img?u=<url>`, YouTube image hosts only).
    async fn serve_image(&self, query: &str) -> tauri::http::Response<Vec<u8>> {
        let Some(target) = url::form_urlencoded::parse(query.as_bytes())
            .find(|(k, _)| k == "u")
            .map(|(_, v)| v.into_owned())
        else {
            return plain(400, "missing url");
        };
        let allowed = url::Url::parse(&target).ok().is_some_and(|u| {
            u.scheme() == "https"
                && u.host_str().is_some_and(|h| {
                    ["ytimg.com", "ggpht.com", "googleusercontent.com"]
                        .iter()
                        .any(|d| h == *d || h.ends_with(&format!(".{d}")))
                })
        });
        if !allowed {
            return plain(403, "host not allowed");
        }
        let response = match self.http.get(&target).send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(r) => return plain(r.status().as_u16(), "upstream error"),
            Err(e) => return plain(502, &format!("network:{e}")),
        };
        let mime = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();
        match response.bytes().await {
            Ok(body) => tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", mime)
                .header("Cache-Control", "public, max-age=604800")
                .header("Access-Control-Allow-Origin", "*")
                .body(body.to_vec())
                .unwrap(),
            Err(e) => plain(502, &format!("network:{e}")),
        }
    }

    async fn serve_soundcloud(&self, track_id: &str, request: &tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
        let (path, mime) = if let Some(p) = self.downloaded(track_id) {
            (Ok(p), "audio/mp4")
        } else if crate::local_music::track_id(track_id).is_some() {
            match self.local.path(track_id) {
                Ok(p) => {
                    let mime = crate::local_music::mime(&p);
                    (Ok(p), mime)
                }
                Err(e) => (Err(e), "audio/mp4"),
            }
        } else {
            (self.soundcloud.audio_file(track_id).await, "audio/mp4")
        };
        let bytes = match path.and_then(|p| std::fs::read(p).map_err(|e| e.to_string())) {
            Ok(b) if !b.is_empty() => b,
            Ok(_) => return plain(404, "empty"),
            Err(e) => return plain(404, &e),
        };
        let total = bytes.len() as u64;
        let start = request
            .headers()
            .get("range")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_range_start)
            .unwrap_or(0);
        if start >= total {
            return tauri::http::Response::builder()
                .status(416)
                .header("Content-Range", format!("bytes */{total}"))
                .body(Vec::new())
                .unwrap();
        }
        let end = (start + CHUNK_SIZE).min(total);
        tauri::http::Response::builder()
            .status(206)
            .header("Content-Type", mime)
            .header("Accept-Ranges", "bytes")
            .header("Content-Range", format!("bytes {start}-{}/{total}", end - 1))
            .header("Content-Length", (end - start).to_string())
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-store")
            .body(bytes[start as usize..end as usize].to_vec())
            .unwrap()
    }

    /// Serves one ranged chunk of the audio file to the webview's media stack.
    pub async fn serve(&self, request: tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
        let path = request.uri().path().trim_start_matches('/');
        if path == "img" {
            return self.serve_image(request.uri().query().unwrap_or_default()).await;
        }
        if let Some(track_id) = path.strip_prefix("cover/") {
            return match self.local.cover(track_id) {
                Some((bytes, mime)) => tauri::http::Response::builder()
                    .status(200)
                    .header("Content-Type", mime)
                    .header("Cache-Control", "public, max-age=86400")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(bytes)
                    .unwrap(),
                None => plain(404, "no cover"),
            };
        }
        let Some(track_id) = path.strip_prefix("audio/") else {
            return plain(404, "not found");
        };
        if soundcloud::track_id(track_id).is_some()
            || crate::local_music::track_id(track_id).is_some()
            || self.downloaded(track_id).is_some()
        {
            return self.serve_soundcloud(track_id, &request).await;
        }
        let video_id = match self.youtube_id(track_id).await {
            Ok(id) => id,
            Err(e) => return plain(404, &e),
        };
        let video_id = video_id.as_str();
        let start = request
            .headers()
            .get("range")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_range_start)
            .unwrap_or(0);

        let mut last_error = String::from("upstream:failed");
        for attempt in 0..CHUNK_ATTEMPTS {
            if attempt > 0 {
                tokio::time::sleep(Duration::from_millis(300 * attempt as u64)).await;
            }
            let audio = match self.current_stream(video_id).await {
                Ok(a) => a,
                Err(e) => {
                    eprintln!("[music] {video_id} @{start}: resolve failed: {e}");
                    last_error = e;
                    continue;
                }
            };
            if audio.size > 0 && start >= audio.size {
                return tauri::http::Response::builder()
                    .status(416)
                    .header("Content-Range", format!("bytes */{}", audio.size))
                    .body(Vec::new())
                    .unwrap();
            }
            let end = if audio.size > 0 { (start + CHUNK_SIZE - 1).min(audio.size - 1) } else { start + CHUNK_SIZE - 1 };
            let upstream = self
                .http
                .get(&audio.url)
                .header("User-Agent", audio.user_agent.as_str())
                .header("Range", format!("bytes={start}-{end}"))
                .send()
                .await;
            let response = match upstream {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[music] {video_id} @{start}: request failed: {e}");
                    last_error = format!("network:{e}");
                    continue;
                }
            };
            let status = response.status().as_u16();
            if !(200..300).contains(&status) {
                eprintln!("[music] {video_id} @{start}: upstream {status}");
                last_error = format!("upstream:{status}");
                if status == 403 || status == 410 {
                    // Signed URL expired or got revoked: resolve a fresh one.
                    self.forget(video_id).await;
                }
                continue;
            }
            let total = response
                .headers()
                .get("content-range")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.rsplit('/').next())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(audio.size);
            let body = match response.bytes().await {
                Ok(b) if !b.is_empty() => b.to_vec(),
                Ok(_) => {
                    eprintln!("[music] {video_id} @{start}: empty body");
                    last_error = "upstream:empty".to_string();
                    continue;
                }
                Err(e) => {
                    eprintln!("[music] {video_id} @{start}: body failed: {e}");
                    last_error = format!("network:{e}");
                    continue;
                }
            };
            let last = start + body.len() as u64 - 1;
            return tauri::http::Response::builder()
                .status(206)
                .header("Content-Type", audio.mime.as_str())
                .header("Accept-Ranges", "bytes")
                .header("Content-Range", format!("bytes {start}-{last}/{total}"))
                .header("Content-Length", body.len().to_string())
                .header("Access-Control-Allow-Origin", "*")
                .header("Cache-Control", "no-store")
                .body(body)
                .unwrap();
        }
        plain(502, &last_error)
    }
}

/// `--yt-net-selftest` part two: search → stream URL → first megabyte of audio.
pub fn selftest_playback() -> bool {
    let service = MusicService::new();
    tauri::async_runtime::block_on(async move {
        let started = Instant::now();
        let track = match service.search("Imagine Dragons Believer").await {
            Ok(page) => match page.tracks.into_iter().next() {
                Some(track) => track,
                None => {
                    println!("search: no tracks");
                    return false;
                }
            },
            Err(e) => {
                println!("search: {e}");
                return false;
            }
        };
        println!("search: {} ({}) in {:?}", track.title, track.video_id, started.elapsed());
        let started = Instant::now();
        let stream = match service.stream_for_playback(&track.video_id, false).await {
            Ok(s) => s,
            Err(e) => {
                println!("stream url: {e}");
                return false;
            }
        };
        let parsed = url::Url::parse(&stream.url).ok();
        let host = parsed.as_ref().and_then(|u| u.host_str().map(str::to_string));
        let ip = parsed.as_ref().and_then(|u| u.query_pairs().find(|(k, _)| k == "ip").map(|(_, v)| v.into_owned()));
        println!("stream url: {host:?} for ip {ip:?}, {} bytes in {:?}", stream.size, started.elapsed());
        let mut builder = ureq::AgentBuilder::new().timeout(Duration::from_secs(30));
        if let Some(proxy) = crate::yt_net::ureq_proxy() {
            builder = builder.proxy(proxy);
        }
        let agent = builder.build();
        let mut urls = vec![stream.url.clone()];
        urls.extend(
            crate::yt_net::alternate_hosts(&stream.url)
                .iter()
                .filter_map(|h| crate::yt_net::with_host(&stream.url, h)),
        );
        for url in urls {
            let host = url::Url::parse(&url).ok().and_then(|u| u.host_str().map(str::to_string));
            let started = Instant::now();
            let result = agent
                .get(&url)
                .set("User-Agent", &stream.user_agent)
                .set("Range", "bytes=0-1048575")
                .call()
                .map_err(|e| e.to_string())
                .and_then(|r| {
                    let mut body = Vec::new();
                    std::io::Read::read_to_end(&mut r.into_reader(), &mut body).map(|_| body.len()).map_err(|e| e.to_string())
                });
            match result {
                Ok(n) => {
                    println!("audio {host:?}: {n} bytes in {:?}", started.elapsed());
                    return true;
                }
                Err(e) => println!("audio {host:?}: {e} after {:?}", started.elapsed()),
            }
        }
        false
    })
}

/// HTTP client whose YouTube connections go through the DPI-bypass proxy.
fn youtube_client_builder() -> reqwest::ClientBuilder {
    let builder = reqwest::Client::builder();
    match crate::yt_net::reqwest_proxy() {
        Some(proxy) => builder.proxy(proxy),
        None => builder,
    }
}

/// `<audio src>` for a track; Windows maps custom schemes to http://<scheme>.localhost.
pub fn stream_url(video_id: &str) -> String {
    if cfg!(windows) {
        format!("http://{SCHEME}.localhost/audio/{video_id}")
    } else {
        format!("{SCHEME}://localhost/audio/{video_id}")
    }
}

/// `<img src>` for the picture embedded in a local file.
pub fn cover_url(track_id: &str) -> String {
    if cfg!(windows) {
        format!("http://{SCHEME}.localhost/cover/{track_id}")
    } else {
        format!("{SCHEME}://localhost/cover/{track_id}")
    }
}

fn to_track(item: &TrackItem) -> Option<MusicTrack> {
    if !is_video_id(&item.id) {
        return None;
    }
    let artist = item.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", ");
    Some(MusicTrack {
        video_id: item.id.clone(),
        title: item.name.clone(),
        artist,
        duration_seconds: item.duration.unwrap_or(0),
        thumbnail_url: best_thumbnail(&item.cover),
        artist_id: item.artists.first().map(|a| format!("{}{}", apple::ARTIST_NAME_PREFIX, a.name)),
        source: None,
    })
}

/// A plain YouTube video that looks like a song, named after its title ("Artist - Title").
fn video_to_track(item: &VideoItem) -> Option<MusicTrack> {
    let seconds = item.duration?;
    if !is_video_id(&item.id) || item.is_live || item.is_short || !(VIDEO_MIN_SECONDS..=VIDEO_MAX_SECONDS).contains(&seconds) {
        return None;
    }
    let channel = item.channel.as_ref().map(|c| c.name.as_str()).unwrap_or_default();
    let (artist, title) = split_song_name(&item.name, channel);
    Some(MusicTrack {
        video_id: item.id.clone(),
        title,
        artist: artist.clone(),
        duration_seconds: seconds,
        thumbnail_url: Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", item.id)),
        artist_id: Some(format!("{}{artist}", apple::ARTIST_NAME_PREFIX)),
        source: Some("YouTube".to_string()),
    })
}

/// Words in brackets that only describe the upload: "(Official Video)", "[Клип]".
const VIDEO_NOISE: &[&str] = &[
    "official", "video", "videoclip", "clip", "клип", "клипа", "audio", "lyric", "lyrics", "текст", "премьера", "hd",
    "hq", "4k", "mv", "visualizer", "аудио", "видео", "music", "mood", "copyright", "ncs", "release", "улучшенное",
    "звучание", "full", "полная", "amv", "subs", "album", "альбом",
];

/// " HD", " No.94", " (2020)" left at the end of an upload's name.
fn strip_trailing_noise(s: &str) -> String {
    let mut s = s.trim().to_string();
    loop {
        let lower = s.to_lowercase();
        let last = lower.rsplit(' ').next().unwrap_or_default().trim_matches(['(', ')']);
        let is_year = last.len() == 4 && (last.starts_with("19") || last.starts_with("20")) && last.bytes().all(|b| b.is_ascii_digit());
        let is_number = last.strip_prefix("no.").or_else(|| last.strip_prefix("no")).is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()));
        let noise = matches!(last, "hd" | "hq" | "4k") || is_year || is_number;
        match s.rfind(' ') {
            Some(at) if noise => s = s[..at].trim_end().to_string(),
            _ => return s,
        }
    }
}

/// Someone else's take on the song, or someone talking about it.
const NOT_THE_SONG: &[&str] = &[
    "tribute", "made famous", "originally performed", "in the style of", "karaoke", "instrumental", "cover", "кавер",
    "минус", "nightcore", "slowed", "sped up", "8d audio", "lullaby", "piano version", "reaction", "реакция", "разбор",
    "обзор", "interview", "интервью", "tutorial", "урок", "type beat", "full album", "альбом целиком", "стрим",
    "podcast", "подкаст", "trailer", "трейлер",
];

/// Artist and title out of an upload's name: "Artist - Title (Official Video)", or the uploader
/// and the bare name.
pub(crate) fn split_song_name(name: &str, uploader: &str) -> (String, String) {
    let mut cleaned = String::new();
    let mut rest = name;
    while let Some(open) = rest.find(['(', '[']) {
        let close_char = if rest[open..].starts_with('(') { ')' } else { ']' };
        let Some(len) = rest[open..].find(close_char) else { break };
        let inside = &rest[open + 1..open + len];
        let noise = comparable(inside).split(' ').any(|w| VIDEO_NOISE.contains(&w));
        cleaned.push_str(if noise { rest[..open].trim_end() } else { &rest[..open + len + 1] });
        rest = &rest[open + len + 1..];
    }
    cleaned.push_str(rest);
    let cleaned: String = cleaned
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || c.is_ascii_punctuation() || "«»“”’—–…".contains(*c))
        .collect();
    let cleaned = strip_trailing_noise(cleaned.split(" | ").next().unwrap_or_default());
    let channel = uploader.trim_end_matches(" - Topic").trim_end_matches("VEVO").trim();
    let unquote = |s: &str| s.trim().trim_matches(['«', '»', '"', '“', '”']).trim().to_string();
    let dash = [" - ", " – ", " — "].iter().filter_map(|d| cleaned.find(d).map(|i| (i, d.len()))).min();
    let (artist, title) = match dash {
        Some((at, len)) if at > 0 => (cleaned[..at].trim().to_string(), unquote(&cleaned[at + len..])),
        _ => (channel.to_string(), unquote(&cleaned)),
    };
    (
        if artist.is_empty() { channel.to_string() } else { artist },
        if title.is_empty() { name.to_string() } else { title },
    )
}

/// YouTube Music songs with every word of the query first, then other sources' hits that have
/// them (unless YouTube Music has the same song), then the remaining songs.
fn merge_results(query: &str, songs: Vec<MusicTrack>, extras: Vec<MusicTrack>) -> Vec<MusicTrack> {
    let wanted = comparable(query);
    let words: Vec<&str> = wanted.split(' ').filter(|w| !w.is_empty()).collect();
    let covers = |t: &MusicTrack| {
        let name = comparable(&format!("{} {}", t.artist, t.title));
        !words.is_empty() && words.iter().all(|w| name.contains(w))
    };
    let key = |t: &MusicTrack| {
        let artist = t.artist.split([',', '&']).next().unwrap_or_default();
        let title = t.title.split(['(', '[']).next().unwrap_or_default();
        format!("{}|{}", comparable(artist), comparable(title))
    };
    let mut seen: std::collections::HashSet<String> = songs.iter().map(key).collect();
    let found: Vec<MusicTrack> = extras
        .into_iter()
        .filter(|t| {
            let name = comparable(&format!("{} {}", t.artist, t.title));
            covers(t) && !NOT_THE_SONG.iter().any(|w| name.contains(w) && !wanted.contains(w))
        })
        .filter(|t| seen.insert(key(t)))
        .collect();
    let (strong, weak): (Vec<_>, Vec<_>) = songs.into_iter().partition(|t| covers(t));
    strong.into_iter().chain(found).chain(weak).collect()
}

/// Opens as the Apple artist of that name (see `MusicService::artist`).
fn to_artist(item: &ArtistItem) -> ArtistCard {
    ArtistCard {
        id: format!("{}{}", apple::ARTIST_NAME_PREFIX, item.name),
        name: item.name.clone(),
        image_url: best_thumbnail(&item.avatar),
        subscribers: item.subscriber_count,
    }
}

fn to_album(item: &AlbumItem) -> AlbumCard {
    AlbumCard {
        id: item.id.clone(),
        name: item.name.clone(),
        cover_url: best_thumbnail(&item.cover),
        artist: item.artists.iter().map(|a| a.name.as_str()).collect::<Vec<_>>().join(", "),
        year: item.year,
        kind: album_kind(item.album_type),
    }
}

fn album_kind(kind: AlbumType) -> String {
    match kind {
        AlbumType::Single => "single",
        AlbumType::Ep => "ep",
        _ => "album",
    }
    .to_string()
}

fn best_thumbnail(thumbnails: &[Thumbnail]) -> Option<String> {
    thumbnails.iter().max_by_key(|t| t.width * t.height).map(|t| hi_res_thumbnail(&t.url))
}

/// YouTube Music covers come as tiny "=w60-h60…" variants; googleusercontent serves any size.
fn hi_res_thumbnail(url: &str) -> String {
    if let Some(pos) = url.rfind("=w") {
        if url[pos..].contains("-h") {
            return format!("{}=w544-h544", &url[..pos]);
        }
    }
    url.to_string()
}

/// The hit that is the same recording as a catalog (Apple, Deezer) track: same title and artist,
/// no cover or remix the track isn't, and nearly the same length. None rather than another song.
fn best_youtube_match(hits: &[MusicTrack], meta: &deezer::TrackMeta) -> Option<String> {
    const MAX_GAP: u32 = 20;
    let wanted_full = comparable(&meta.title);
    let wanted_versions = versions(&wanted_full);
    let title = comparable(meta.title.split(['(', '[']).next().unwrap_or(&meta.title));
    let artists: Vec<String> = meta
        .artist
        .split([',', '&', '/'])
        .flat_map(|a| a.split(" feat"))
        .map(comparable)
        .filter(|a| a.len() >= 2)
        .collect();
    if title.is_empty() || artists.is_empty() {
        return None;
    }
    hits.iter()
        .filter(|hit| is_video_id(&hit.video_id))
        .take(10)
        .filter_map(|hit| {
            let full = comparable(&hit.title);
            let name = comparable(hit.title.split(['(', '[']).next().unwrap_or(&hit.title));
            let credit = comparable(&hit.artist);
            let other_recording = NOT_THE_SONG.iter().chain(["remix", "slow"].iter()).any(|w| {
                (full.contains(w) || credit.contains(w)) && !wanted_full.contains(w)
            }) || wanted_versions.iter().any(|w| !full.contains(w) && !credit.contains(w));
            let title_ok = !name.is_empty() && (name == title || name.contains(&title) || title.contains(&name));
            let artist_ok = artists
                .iter()
                .any(|a| (!credit.is_empty() && (credit.contains(a) || a.contains(&credit))) || full.contains(a.as_str()));
            let gap = match (hit.duration_seconds, meta.duration) {
                (0, _) | (_, 0) => 0,
                (d, m) => d.abs_diff(m),
            };
            (!other_recording && title_ok && artist_ok && gap <= MAX_GAP).then(|| (gap + if name == title { 0 } else { 5 }, hit.video_id.clone()))
        })
        .min_by_key(|(score, _)| *score)
        .map(|(_, id)| id)
}

/// Which version of a song a (comparable) title names: a remix isn't the original and vice versa.
fn versions(title: &str) -> Vec<&'static str> {
    const VERSIONS: &[&str] = &["remix", "ремикс", "slowed", "sped up", "speed up", "reverb", "acoustic", "live", "instrumental", "nightcore"];
    let padded = format!(" {title} ");
    VERSIONS.iter().copied().filter(|w| padded.contains(&format!(" {w} "))).collect()
}

/// Lowercase letters and digits separated by single spaces.
pub(crate) fn comparable(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_video_id(id: &str) -> bool {
    id.len() == 11 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Random `[A-Za-z0-9-_]` string for YouTube's `cpn` / `t` request nonces.
pub(crate) fn random_token(len: usize) -> String {
    use std::hash::{BuildHasher, Hasher};
    const ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
    let mut hasher = std::collections::hash_map::RandomState::new().build_hasher();
    hasher.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos());
    let mut state = hasher.finish() | 1;
    (0..len)
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            ALPHABET[(state % ALPHABET.len() as u64) as usize] as char
        })
        .collect()
}

fn parse_range_start(value: &str) -> Option<u64> {
    value.trim().strip_prefix("bytes=")?.split('-').next()?.trim().parse().ok()
}

fn plain(status: u16, message: &str) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Access-Control-Allow-Origin", "*")
        .body(message.as_bytes().to_vec())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Live network check: `cargo test music_live -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn music_live() {
        tauri::async_runtime::block_on(async {
            let service = MusicService::new();
            service.set_storage_dir(std::env::temp_dir().join("whithin-music-test"));
            let started = Instant::now();
            let page = service.search("ЛСП Коктейль").await.expect("search");
            println!("search: {} tracks in {:?}, more={}", page.tracks.len(), started.elapsed(), page.has_more);
            for t in page.tracks.iter().take(5) {
                println!("  {} | {} | {}s | {:?}", t.title, t.artist, t.duration_seconds, t.thumbnail_url);
            }
            let more = service.search_more(&page.search_id).await.expect("more");
            println!("more: {} tracks", more.tracks.len());

            let id = &page.tracks[0].video_id;
            let started = Instant::now();
            println!("prepare: {:?} in {:?}", service.prepare(id).await, started.elapsed());
            for offset in [0u64, CHUNK_SIZE, 2 * CHUNK_SIZE] {
                let request = tauri::http::Request::builder()
                    .uri(format!("http://whithin-music.localhost/audio/{id}"))
                    .header("Range", format!("bytes={offset}-"))
                    .body(Vec::new())
                    .unwrap();
                let started = Instant::now();
                let response = service.serve(request).await;
                println!(
                    "chunk @{offset}: status={} range={:?} type={:?} bytes={} in {:?}",
                    response.status(),
                    response.headers().get("content-range"),
                    response.headers().get("content-type"),
                    response.body().len(),
                    started.elapsed()
                );
                assert_eq!(response.status(), 206);
            }
        });
    }
}

#[tauri::command]
pub async fn music_search(
    state: tauri::State<'_, Arc<MusicService>>,
    query: String,
) -> Result<SearchPage, String> {
    state.search(&query).await
}

#[tauri::command]
pub async fn music_search_more(
    state: tauri::State<'_, Arc<MusicService>>,
    search_id: String,
) -> Result<SearchPage, String> {
    state.search_more(&search_id).await
}

#[tauri::command]
pub async fn music_search_artists(
    state: tauri::State<'_, Arc<MusicService>>,
    query: String,
) -> Result<Vec<ArtistCard>, String> {
    state.search_artists(&query).await
}

#[tauri::command]
pub async fn music_artist(state: tauri::State<'_, Arc<MusicService>>, artist_id: String) -> Result<ArtistPage, String> {
    state.artist(&artist_id).await
}

#[tauri::command]
pub async fn music_album(state: tauri::State<'_, Arc<MusicService>>, album_id: String) -> Result<AlbumPage, String> {
    state.album(&album_id).await
}

#[tauri::command]
pub async fn music_radio(state: tauri::State<'_, Arc<MusicService>>, seed: String) -> Result<Vec<MusicTrack>, String> {
    state.radio(&seed).await
}

#[tauri::command]
pub async fn music_home(state: tauri::State<'_, Arc<MusicService>>) -> Result<HomeFeed, String> {
    state.home().await
}

#[tauri::command]
pub async fn music_prepare(
    state: tauri::State<'_, Arc<MusicService>>,
    video_id: String,
) -> Result<String, String> {
    state.prepare(&video_id).await
}
