//! The player is a second webview inside the main window, switched like a browser tab.
//! It sits under the site's titlebar so the header never changes, and the site underneath is
//! never hidden or reloaded, so calls keep running. The site's theme is mirrored into it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

use crate::music::MusicService;

pub const LABEL: &str = "music";
/// Matches `--electron-titlebar-height` on the site and the offline shell.
const TITLEBAR_HEIGHT: f64 = 32.0;
const THEME_FILE: &str = "theme.json";
const WALLPAPER_FILE: &str = "wallpaper.bin";

static THEME: Mutex<Option<serde_json::Value>> = Mutex::new(None);

fn player_bounds<R: Runtime>(window: &tauri::Window<R>) -> Result<tauri::Rect, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    Ok(tauri::Rect {
        position: tauri::LogicalPosition::new(0.0, TITLEBAR_HEIGHT).into(),
        size: tauri::LogicalSize::new(size.width, (size.height - TITLEBAR_HEIGHT).max(0.0)).into(),
    })
}

/// Keeps the player glued under the titlebar; called on main-window resize / DPI change.
pub fn relayout<R: Runtime>(app: &AppHandle<R>) {
    let (Some(window), Some(player)) = (app.get_window("main"), app.get_webview(LABEL)) else {
        return;
    };
    if let Ok(bounds) = player_bounds(&window) {
        let _ = player.set_bounds(bounds);
    }
}

fn emit_visibility<R: Runtime>(app: &AppHandle<R>, visible: bool) {
    let _ = app.emit_to("main", "music-visibility", visible);
}

/// `Webview` has no visibility getter, so it is tracked here.
static VISIBLE: AtomicBool = AtomicBool::new(false);

fn set_visible<R: Runtime>(app: &AppHandle<R>, player: &Webview<R>, visible: bool) -> Result<(), String> {
    if visible {
        relayout(app);
        player.show().map_err(|e| e.to_string())?;
        let _ = player.set_focus();
    } else {
        player.hide().map_err(|e| e.to_string())?;
        if let Some(site) = app.get_webview("main") {
            let _ = site.set_focus();
        }
    }
    VISIBLE.store(visible, Ordering::Relaxed);
    emit_visibility(app, visible);
    Ok(())
}

/// `visible: None` toggles.
#[tauri::command]
pub async fn music_show(app: AppHandle, visible: Option<bool>) -> Result<bool, String> {
    let window = app
        .get_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    if let Some(player) = app.get_webview(LABEL) {
        let target = visible.unwrap_or(!VISIBLE.load(Ordering::Relaxed));
        set_visible(&app, &player, target)?;
        return Ok(target);
    }
    if visible == Some(false) {
        return Ok(false);
    }
    let bounds = player_bounds(&window)?;
    let builder = tauri::webview::WebviewBuilder::new(LABEL, crate::asset_url("music.html")?)
        .background_color(tauri::window::Color(0x1e, 0x1f, 0x22, 0xff));
    let player = window
        .add_child(builder, bounds.position, bounds.size)
        .map_err(|e| format!("Failed to open player: {e}"))?;
    let _ = player.set_focus();
    VISIBLE.store(true, Ordering::Relaxed);
    emit_visibility(&app, true);
    Ok(true)
}

fn theme_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let service = app.try_state::<Arc<MusicService>>()?;
    service.storage_dir().map(|dir| dir.join(THEME_FILE))
}

/// The site pushes its resolved CSS variables; the player applies them live and on startup.
#[tauri::command]
pub fn music_set_theme(app: AppHandle, theme: serde_json::Value) -> Result<(), String> {
    {
        let mut current = THEME.lock().map_err(|e| e.to_string())?;
        if current.as_ref() == Some(&theme) {
            return Ok(());
        }
        *current = Some(theme.clone());
    }
    if let Some(path) = theme_path(&app) {
        let _ = std::fs::write(path, theme.to_string());
    }
    let _ = app.emit_to(LABEL, "music-theme", theme);
    Ok(())
}

fn wallpaper_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    let service = app.try_state::<Arc<MusicService>>()?;
    service.storage_dir().map(|dir| dir.join(WALLPAPER_FILE))
}

/// The site's frosted-glass wallpaper as raw image bytes; an empty body removes it.
#[tauri::command]
pub fn music_set_wallpaper(app: AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw image bytes".into());
    };
    let path = wallpaper_path(&app).ok_or_else(|| "storage unavailable".to_string())?;
    if std::fs::read(&path).unwrap_or_default() == *bytes {
        return Ok(());
    }
    if bytes.is_empty() {
        let _ = std::fs::remove_file(&path);
    } else {
        std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    }
    let _ = app.emit_to(LABEL, "music-wallpaper", ());
    Ok(())
}

#[tauri::command]
pub fn music_get_wallpaper(app: AppHandle) -> tauri::ipc::Response {
    let bytes = wallpaper_path(&app)
        .and_then(|path| std::fs::read(path).ok())
        .unwrap_or_default();
    tauri::ipc::Response::new(bytes)
}

#[tauri::command]
pub fn music_get_theme(app: AppHandle) -> Option<serde_json::Value> {
    let mut current = THEME.lock().ok()?;
    if current.is_none() {
        let path = theme_path(&app)?;
        *current = serde_json::from_slice(&std::fs::read(path).ok()?).ok();
    }
    current.clone()
}
