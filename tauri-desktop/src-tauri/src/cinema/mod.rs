//! «Кино»: a third tab beside the site and the music player, opened the same way (a child webview under
//! the titlebar). Anime comes from AniLibria, films and series from HDRezka; video only ever plays in the
//! app's own player, fed through the `whithin-cinema` proxy scheme.

pub mod anilibria;
pub mod proxy;
pub mod rezka;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager};

pub const LABEL: &str = "cinema";

static VISIBLE: AtomicBool = AtomicBool::new(false);

fn emit_visibility(app: &AppHandle, visible: bool) {
    let _ = app.emit_to("main", "cinema-visibility", visible);
    // A hidden child webview keeps playing; the tab pauses its video on this.
    let _ = app.emit_to(LABEL, "cinema-visibility", visible);
}

/// In video fullscreen the tab covers the titlebar too.
static FULLSCREEN: AtomicBool = AtomicBool::new(false);

fn bounds(window: &tauri::Window) -> Result<tauri::Rect, String> {
    if !FULLSCREEN.load(Ordering::Relaxed) {
        return crate::music_window::panel_bounds(window);
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    Ok(tauri::Rect {
        position: tauri::LogicalPosition::new(0.0, 0.0).into(),
        size: tauri::LogicalSize::new(size.width, size.height).into(),
    })
}

/// Called on main-window resize / DPI change, like the music player's relayout.
pub fn relayout(app: &AppHandle) {
    let (Some(window), Some(view)) = (app.get_window("main"), app.get_webview(LABEL)) else {
        return;
    };
    if let Ok(bounds) = bounds(&window) {
        let _ = view.set_bounds(bounds);
    }
}

/// Hides the tab without focusing the site (the caller is switching to another panel).
pub(crate) fn hide(app: &AppHandle) {
    if !VISIBLE.swap(false, Ordering::Relaxed) {
        return;
    }
    if FULLSCREEN.swap(false, Ordering::Relaxed) {
        if let Some(window) = app.get_window("main") {
            let _ = window.set_fullscreen(false);
        }
    }
    if let Some(view) = app.get_webview(LABEL) {
        let _ = view.hide();
    }
    emit_visibility(app, false);
}

/// `visible: None` toggles.
#[tauri::command]
pub async fn cinema_show(app: AppHandle, visible: Option<bool>) -> Result<bool, String> {
    let target = visible.unwrap_or(!VISIBLE.load(Ordering::Relaxed));
    if !target {
        hide(&app);
        if let Some(site) = app.get_webview("main") {
            let _ = site.set_focus();
        }
        return Ok(false);
    }
    crate::music_window::hide(&app);
    let window = app.get_window("main").ok_or_else(|| "main window missing".to_string())?;
    let view = match app.get_webview(LABEL) {
        Some(view) => {
            relayout(&app);
            view.show().map_err(|e| e.to_string())?;
            view
        }
        None => {
            let bounds = bounds(&window)?;
            let builder = tauri::webview::WebviewBuilder::new(LABEL, crate::asset_url("cinema.html")?)
                .background_color(
                    crate::music_window::theme_boot_color(&app).unwrap_or(tauri::window::Color(0x1e, 0x1f, 0x22, 0xff)),
                );
            window
                .add_child(builder, bounds.position, bounds.size)
                .map_err(|e| format!("Не удалось открыть «Кино»: {e}"))?
        }
    };
    let _ = view.set_focus();
    VISIBLE.store(true, Ordering::Relaxed);
    emit_visibility(&app, true);
    Ok(true)
}

/// Fullscreen for the video player: the whole main window goes fullscreen and the tab fills it.
#[tauri::command]
pub fn cinema_fullscreen(app: AppHandle, on: bool) -> Result<(), String> {
    let window = app.get_window("main").ok_or_else(|| "main window missing".to_string())?;
    FULLSCREEN.store(on, Ordering::Relaxed);
    window.set_fullscreen(on).map_err(|e| e.to_string())?;
    relayout(&app);
    Ok(())
}
