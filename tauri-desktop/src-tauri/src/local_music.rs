//! Songs the user drops into `Music\Whithin` on this computer: listed in "My music" and played
//! from the file. They stay on this computer (other devices can't stream them).

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use lofty::prelude::*;

use crate::music::MusicTrack;

const PREFIX: &str = "lf-";
const FOLDER_NAME: &str = "Whithin";
const EXTENSIONS: &[&str] = &["mp3", "m4a", "mp4", "aac", "flac", "ogg", "wav"];
pub const SOURCE: &str = "Файл";

pub fn track_id(id: &str) -> Option<&str> {
    id.strip_prefix(PREFIX)
}

struct Entry {
    path: PathBuf,
    modified: Option<SystemTime>,
    track: MusicTrack,
}

#[derive(Default)]
pub struct LocalMusic {
    files: Mutex<HashMap<String, Entry>>,
}

impl LocalMusic {
    /// `%USERPROFILE%\Music\Whithin`, created on first use.
    pub fn folder(&self) -> Result<PathBuf, String> {
        let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).ok_or("no home folder")?;
        let dir = PathBuf::from(home).join("Music").join(FOLDER_NAME);
        std::fs::create_dir_all(&dir).map_err(|e| format!("error:create {}: {e}", dir.display()))?;
        Ok(dir)
    }

    /// Every audio file in the folder (subfolders too). Title, artist, length and cover come from
    /// the file's tags; untagged files fall back to "Artist - Title" file names. Tags are re-read
    /// only for files changed since the last scan.
    pub fn scan(&self) -> Result<Vec<MusicTrack>, String> {
        let root = self.folder()?;
        let mut paths = Vec::new();
        collect(&root, &mut paths);
        let mut previous = std::mem::take(&mut *self.files.lock().unwrap());
        let mut files = HashMap::new();
        for path in paths {
            let relative = path.strip_prefix(&root).unwrap_or(&path).to_string_lossy().to_lowercase();
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            relative.hash(&mut hasher);
            let id = format!("{PREFIX}{:016x}", hasher.finish());
            let modified = std::fs::metadata(&path).and_then(|m| m.modified()).ok();
            let entry = match previous.remove(&id) {
                Some(entry) if entry.path == path && entry.modified == modified && modified.is_some() => entry,
                _ => Entry { track: read_track(&id, &path), path, modified },
            };
            files.insert(id, entry);
        }
        let mut tracks: Vec<MusicTrack> = files.values().map(|e| e.track.clone()).collect();
        tracks.sort_by(|a, b| a.artist.to_lowercase().cmp(&b.artist.to_lowercase()).then(a.title.to_lowercase().cmp(&b.title.to_lowercase())));
        *self.files.lock().unwrap() = files;
        Ok(tracks)
    }

    pub fn path(&self, id: &str) -> Result<PathBuf, String> {
        if let Some(entry) = self.files.lock().unwrap().get(id) {
            return Ok(entry.path.clone());
        }
        self.scan()?;
        self.files
            .lock()
            .unwrap()
            .get(id)
            .map(|e| e.path.clone())
            .ok_or_else(|| "unavailable:file removed".to_string())
    }

    /// The picture embedded in the file's tags (front cover preferred): bytes and mime type.
    pub fn cover(&self, id: &str) -> Option<(Vec<u8>, String)> {
        let path = self.path(id).ok()?;
        let file = lofty::read_from_path(&path).ok()?;
        let pictures: Vec<&lofty::picture::Picture> = file.tags().iter().flat_map(|t| t.pictures()).collect();
        let picture = pictures
            .iter()
            .find(|p| p.pic_type() == lofty::picture::PictureType::CoverFront)
            .or_else(|| pictures.first())?;
        let mime = picture.mime_type().map(|m| m.as_str().to_string()).unwrap_or_else(|| "image/jpeg".to_string());
        Some((picture.data().to_vec(), mime))
    }
}

fn read_track(id: &str, path: &Path) -> MusicTrack {
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let (mut artist, mut title) = match stem.split_once(" - ") {
        Some((artist, title)) => (artist.trim().to_string(), title.trim().to_string()),
        None => (String::new(), stem.trim().to_string()),
    };
    let mut duration_seconds = 0;
    let mut thumbnail_url = None;
    if let Ok(file) = lofty::read_from_path(path) {
        duration_seconds = file.properties().duration().as_secs() as u32;
        if let Some(tag) = file.primary_tag().or_else(|| file.first_tag()) {
            if let Some(t) = tag.title().map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) {
                title = t;
            }
            if let Some(a) = tag.artist().map(|a| a.trim().to_string()).filter(|a| !a.is_empty()) {
                artist = a;
            }
        }
        if file.tags().iter().any(|t| !t.pictures().is_empty()) {
            thumbnail_url = Some(crate::music::cover_url(id));
        }
    }
    MusicTrack {
        video_id: id.to_string(),
        title,
        artist,
        duration_seconds,
        thumbnail_url,
        artist_id: None,
        source: Some(SOURCE.to_string()),
    }
}

pub fn mime(path: &Path) -> &'static str {
    match path.extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref() {
        Some("mp3") => "audio/mpeg",
        Some("flac") => "audio/flac",
        Some("ogg") => "audio/ogg",
        Some("wav") => "audio/wav",
        Some("aac") => "audio/aac",
        _ => "audio/mp4",
    }
}

fn collect(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, out);
        } else if path
            .extension()
            .is_some_and(|e| EXTENSIONS.contains(&e.to_string_lossy().to_lowercase().as_str()))
        {
            out.push(path);
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalState {
    folder: String,
    tracks: Vec<MusicTrack>,
}

#[tauri::command]
pub async fn music_local_tracks(state: tauri::State<'_, std::sync::Arc<crate::music::MusicService>>) -> Result<LocalState, String> {
    let local = &state.local;
    Ok(LocalState { folder: local.folder()?.display().to_string(), tracks: local.scan()? })
}

#[tauri::command]
pub async fn music_downloads(state: tauri::State<'_, std::sync::Arc<crate::music::MusicService>>) -> Result<Vec<String>, String> {
    Ok(state.downloaded_ids())
}

#[tauri::command]
pub async fn music_download(state: tauri::State<'_, std::sync::Arc<crate::music::MusicService>>, track_id: String) -> Result<(), String> {
    state.download(&track_id).await
}

#[tauri::command]
pub async fn music_download_delete(state: tauri::State<'_, std::sync::Arc<crate::music::MusicService>>, track_id: String) -> Result<(), String> {
    state.delete_download(&track_id)
}

#[tauri::command]
pub async fn music_local_open(state: tauri::State<'_, std::sync::Arc<crate::music::MusicService>>) -> Result<(), String> {
    let folder = state.local.folder()?;
    std::process::Command::new("explorer").arg(&folder).spawn().map_err(|e| format!("error:explorer: {e}"))?;
    Ok(())
}
