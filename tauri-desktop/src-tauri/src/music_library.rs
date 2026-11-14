//! «Моя музыка» for the desktop player. It talks to the Whithin API with its own session
//! (independent of the web client's tokens) and keeps an offline copy, so the player keeps
//! working when the server or the site is unreachable.

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::music::MusicService;

const SESSION_FILE: &str = "session.json";
const LIBRARY_FILE: &str = "library.json";
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrack {
    pub video_id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub duration_seconds: u32,
    #[serde(default)]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub added_at: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PendingOp {
    add: bool,
    track: LibraryTrack,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct LocalLibrary {
    tracks: Vec<LibraryTrack>,
    pending: Vec<PendingOp>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PlayerSession {
    access_token: String,
    refresh_token: String,
    user_id: String,
    username: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LibraryState {
    pub tracks: Vec<LibraryTrack>,
    pub signed_in: bool,
    pub username: Option<String>,
    pub online: bool,
    pub pending: usize,
}

enum ApiError {
    Offline,
    Unauthorized,
    Status(u16),
}

pub struct MusicLibrary {
    dir: OnceLock<PathBuf>,
    http: reqwest::Client,
    lock: Mutex<()>,
}

impl MusicLibrary {
    pub fn new() -> Self {
        Self {
            dir: OnceLock::new(),
            http: reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(15))
                .build()
                .expect("library http client"),
            lock: Mutex::new(()),
        }
    }

    pub fn set_storage_dir(&self, dir: PathBuf) {
        let _ = self.dir.set(dir);
    }

    fn read_file<T: DeserializeOwned>(&self, name: &str) -> Option<T> {
        let bytes = std::fs::read(self.dir.get()?.join(name)).ok()?;
        serde_json::from_slice(&bytes).ok()
    }

    fn write_file<T: Serialize>(&self, name: &str, value: &T) {
        let Some(dir) = self.dir.get() else { return };
        let Ok(bytes) = serde_json::to_vec(value) else { return };
        let tmp = dir.join(format!("{name}.tmp"));
        if std::fs::write(&tmp, bytes).is_ok() {
            let _ = std::fs::rename(&tmp, dir.join(name));
        }
    }

    fn session(&self) -> Option<PlayerSession> {
        self.read_file(SESSION_FILE)
    }

    fn save_session(&self, session: Option<&PlayerSession>) {
        match session {
            Some(s) => self.write_file(SESSION_FILE, s),
            None => {
                if let Some(dir) = self.dir.get() {
                    let _ = std::fs::remove_file(dir.join(SESSION_FILE));
                }
            }
        }
    }

    fn local(&self) -> LocalLibrary {
        self.read_file(LIBRARY_FILE).unwrap_or_default()
    }

    fn state(&self, library: &LocalLibrary, online: bool) -> LibraryState {
        let session = self.session();
        LibraryState {
            tracks: library.tracks.clone(),
            signed_in: session.is_some(),
            username: session.map(|s| s.username),
            online,
            pending: library.pending.len(),
        }
    }

    async fn send(
        &self,
        method: reqwest::Method,
        path: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> Result<(u16, Vec<u8>), ApiError> {
        let mut request = self.http.request(method, format!("{}{path}", api_base()));
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.header("Content-Type", "application/json").body(body.to_string());
        }
        let response = request.send().await.map_err(|_| ApiError::Offline)?;
        let status = response.status().as_u16();
        let bytes = response.bytes().await.map_err(|_| ApiError::Offline)?;
        Ok((status, bytes.to_vec()))
    }

    /// Authenticated call; on 401 rotates the player's own refresh token once and retries.
    async fn call(
        &self,
        session: &mut PlayerSession,
        method: reqwest::Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Vec<u8>, ApiError> {
        let (mut status, mut bytes) =
            self.send(method.clone(), path, Some(&session.access_token), body.clone()).await?;
        if status == 401 {
            self.refresh(session).await?;
            (status, bytes) = self.send(method, path, Some(&session.access_token), body).await?;
        }
        match status {
            200..=299 => Ok(bytes),
            401 => Err(ApiError::Unauthorized),
            other => Err(ApiError::Status(other)),
        }
    }

    async fn refresh(&self, session: &mut PlayerSession) -> Result<(), ApiError> {
        let body = json!({ "refreshToken": session.refresh_token });
        let (status, bytes) = self.send(reqwest::Method::POST, "/api/auth/refresh", None, Some(body)).await?;
        match status {
            200..=299 => {
                let value: Value = serde_json::from_slice(&bytes).map_err(|_| ApiError::Status(status))?;
                let (Some(access), Some(refresh)) = (value["token"].as_str(), value["refreshToken"].as_str()) else {
                    return Err(ApiError::Status(status));
                };
                session.access_token = access.to_string();
                session.refresh_token = refresh.to_string();
                self.save_session(Some(session));
                Ok(())
            }
            400 | 401 => Err(ApiError::Unauthorized),
            other => Err(ApiError::Status(other)),
        }
    }

    /// Called by the web client bridge with the site's access token: creates the player's own
    /// session the first time, or a new one when a different account signs in on the site.
    /// Returns `Some(created)` once the player holds a session for the site's account, `None`
    /// when that could not be done yet (offline, server error) so the bridge retries later.
    pub async fn adopt_site_token(&self, site_token: &str) -> Option<bool> {
        {
            let _guard = self.lock.lock().await;
            let site_user = match self.send(reqwest::Method::GET, "/api/auth/status", Some(site_token), None).await {
                Ok((200, bytes)) => serde_json::from_slice::<Value>(&bytes)
                    .ok()
                    .filter(|v| v["isAuthenticated"].as_bool() == Some(true))
                    .and_then(|v| v["user"]["id"].as_str().map(str::to_lowercase)),
                _ => None,
            };
            let site_user = site_user?;
            let current = self.session();
            if current.as_ref().is_some_and(|s| s.user_id == site_user) {
                return Some(false);
            }
            let Ok((200, bytes)) =
                self.send(reqwest::Method::POST, "/api/auth/device-session", Some(site_token), None).await
            else {
                return None;
            };
            let value = serde_json::from_slice::<Value>(&bytes).ok()?;
            let (Some(access), Some(refresh)) = (value["token"].as_str(), value["refreshToken"].as_str()) else {
                return None;
            };
            let session = PlayerSession {
                access_token: access.to_string(),
                refresh_token: refresh.to_string(),
                user_id: site_user,
                username: value["user"]["username"].as_str().unwrap_or_default().to_string(),
            };
            if current.is_some() {
                // Another account: the old offline copy and its unsynced changes belong to it.
                self.write_file(LIBRARY_FILE, &LocalLibrary::default());
            }
            self.save_session(Some(&session));
        }
        self.sync().await;
        Some(true)
    }

    /// Offline copy only, no network.
    pub async fn local_state(&self) -> LibraryState {
        let _guard = self.lock.lock().await;
        self.state(&self.local(), false)
    }

    /// Pushes offline changes, then refreshes the copy from the server when it is reachable.
    pub async fn sync(&self) -> LibraryState {
        let _guard = self.lock.lock().await;
        let mut library = self.local();
        let Some(mut session) = self.session() else {
            return self.state(&library, false);
        };

        let mut online = true;
        while let Some(op) = library.pending.first().cloned() {
            let id = op.track.video_id.clone();
            let result = if op.add {
                let body = json!({
                    "videoId": id,
                    "title": op.track.title,
                    "artist": op.track.artist,
                    "durationSeconds": op.track.duration_seconds,
                    "thumbnailUrl": op.track.thumbnail_url,
                });
                self.call(&mut session, reqwest::Method::POST, "/api/music/library", Some(body)).await
            } else {
                self.call(&mut session, reqwest::Method::DELETE, &format!("/api/music/library/{id}"), None).await
            };
            match result {
                // 4xx means the server already has (or lacks) the track — nothing left to sync.
                Ok(_) | Err(ApiError::Status(400..=499)) => {
                    library.pending.remove(0);
                }
                Err(ApiError::Unauthorized) => {
                    self.save_session(None);
                    online = false;
                    break;
                }
                Err(_) => {
                    online = false;
                    break;
                }
            }
        }

        if online {
            match self.call(&mut session, reqwest::Method::GET, "/api/music/library", None).await {
                Ok(bytes) => {
                    if let Ok(tracks) = serde_json::from_slice::<Vec<LibraryTrack>>(&bytes) {
                        library.tracks = tracks;
                        for op in &library.pending {
                            apply(&mut library.tracks, op);
                        }
                    }
                }
                Err(ApiError::Unauthorized) => {
                    self.save_session(None);
                    online = false;
                }
                Err(_) => online = false,
            }
        }

        self.write_file(LIBRARY_FILE, &library);
        self.state(&library, online)
    }

    /// Adds or removes locally right away, then tries to sync.
    pub async fn toggle(&self, track: LibraryTrack) -> LibraryState {
        {
            let _guard = self.lock.lock().await;
            let mut library = self.local();
            let add = !library.tracks.iter().any(|t| t.video_id == track.video_id);
            let op = PendingOp { add, track };
            apply(&mut library.tracks, &op);
            library.pending.retain(|p| p.track.video_id != op.track.video_id);
            library.pending.push(op);
            self.write_file(LIBRARY_FILE, &library);
        }
        self.sync().await
    }
}

fn apply(tracks: &mut Vec<LibraryTrack>, op: &PendingOp) {
    tracks.retain(|t| t.video_id != op.track.video_id);
    if op.add {
        tracks.insert(0, op.track.clone());
    }
}

fn api_base() -> String {
    std::env::var("WHITHIN_API_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| "https://whithin.ru".to_string())
        .trim_end_matches('/')
        .to_string()
}

/// Syncs soon after start and then periodically, so the refresh token keeps rotating and the
/// player stays signed in even if it is rarely opened.
pub fn start_keepalive(service: Arc<MusicService>) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(5)).await;
        loop {
            service.library.sync().await;
            tokio::time::sleep(KEEPALIVE_INTERVAL).await;
        }
    });
}

#[tauri::command]
pub async fn music_auth_from_site(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<MusicService>>,
    access_token: String,
) -> Result<bool, String> {
    let adopted = state.library.adopt_site_token(&access_token).await;
    if adopted == Some(true) {
        let _ = app.emit_to(crate::music_window::LABEL, "music-library-changed", ());
    }
    Ok(adopted.is_some())
}

#[tauri::command]
pub async fn music_library_local(state: tauri::State<'_, Arc<MusicService>>) -> Result<LibraryState, String> {
    Ok(state.library.local_state().await)
}

#[tauri::command]
pub async fn music_library_sync(state: tauri::State<'_, Arc<MusicService>>) -> Result<LibraryState, String> {
    Ok(state.library.sync().await)
}

#[tauri::command]
pub async fn music_library_toggle(
    state: tauri::State<'_, Arc<MusicService>>,
    track: LibraryTrack,
) -> Result<LibraryState, String> {
    Ok(state.library.toggle(track).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str) -> LibraryTrack {
        LibraryTrack {
            video_id: id.to_string(),
            title: id.to_string(),
            artist: String::new(),
            duration_seconds: 0,
            thumbnail_url: None,
            added_at: None,
        }
    }

    #[test]
    fn toggle_without_session_stays_local_and_pending() {
        tauri::async_runtime::block_on(async {
            let dir = std::env::temp_dir().join(format!("whithin-music-lib-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            let library = MusicLibrary::new();
            library.set_storage_dir(dir.clone());

            library.toggle(track("aaaaaaaaaaa")).await;
            let state = library.toggle(track("bbbbbbbbbbb")).await;
            assert!(!state.signed_in);
            assert_eq!(state.pending, 2);
            let ids: Vec<_> = state.tracks.iter().map(|t| t.video_id.as_str()).collect();
            assert_eq!(ids, ["bbbbbbbbbbb", "aaaaaaaaaaa"]);

            let state = library.toggle(track("aaaaaaaaaaa")).await;
            assert_eq!(state.tracks.len(), 1);
            assert_eq!(state.pending, 2, "re-toggling replaces the pending op, not appends");
            let _ = std::fs::remove_dir_all(&dir);
        });
    }
}
