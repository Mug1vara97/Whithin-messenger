//! Always-on-top mini player window plus music controls in the tray menu. Both drive the
//! player webview through the same `music-remote` / `music-now` events as the titlebar player.

use std::sync::{Mutex, OnceLock};

use tauri::menu::MenuItem;
use tauri::{AppHandle, Emitter, EventTarget, Listener, Manager, WebviewWindowBuilder, Wry};

pub const LABEL: &str = "mini-player";
const WIDTH: f64 = 360.0;
const HEIGHT: f64 = 96.0;
const MARGIN: f64 = 16.0;

pub struct TrayMusicItems {
    pub toggle_play: MenuItem<Wry>,
    pub now: MenuItem<Wry>,
}

static TRAY_ITEMS: OnceLock<TrayMusicItems> = OnceLock::new();
static LAST_TOOLTIP: Mutex<String> = Mutex::new(String::new());

/// Sends a playback command to the player webview (a no-op until the player has been opened).
pub fn remote(app: &AppHandle, action: &str) {
    let _ = app.emit_to(
        EventTarget::webview(crate::music_window::LABEL),
        "music-remote",
        serde_json::json!({ "action": action }),
    );
}

fn create(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    let mut builder = WebviewWindowBuilder::new(app, LABEL, crate::asset_url("mini-player.html")?)
        .title("Whithin — мини-плеер")
        .inner_size(WIDTH, HEIGHT)
        .min_inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(true)
        .focused(false)
        .background_color(
            crate::music_window::theme_boot_color(app)
                .unwrap_or(tauri::window::Color(0x1e, 0x1f, 0x22, 0xff)),
        );
    if let Some((x, y, w, h)) = crate::desktop_shell::primary_work_area(app) {
        builder = builder.position(x + w - WIDTH - MARGIN, y + h - HEIGHT - MARGIN);
    }
    builder.build().map_err(|e| format!("Failed to open mini player: {e}"))
}

/// `visible: None` toggles. Returns the resulting visibility.
pub fn set_visible(app: &AppHandle, visible: Option<bool>) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window(LABEL) {
        let target = visible.unwrap_or(!window.is_visible().unwrap_or(false));
        if target {
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_always_on_top(true);
        } else {
            window.hide().map_err(|e| e.to_string())?;
        }
        return Ok(target);
    }
    if visible == Some(false) {
        return Ok(false);
    }
    create(app)?;
    remote(app, "sync");
    Ok(true)
}

#[tauri::command]
pub fn mini_player_show(app: AppHandle, visible: Option<bool>) -> Result<bool, String> {
    set_visible(&app, visible)
}

/// Brings the main window back with the full player open.
#[tauri::command]
pub async fn mini_player_open_full(app: AppHandle) -> Result<(), String> {
    crate::desktop_parity::show_main_window(&app);
    crate::music_window::music_show(app, Some(true)).await.map(|_| ())
}

pub fn register_tray_items(items: TrayMusicItems) {
    let _ = TRAY_ITEMS.set(items);
}

/// Mirrors the current track into the tray tooltip and music menu items.
pub fn watch_now_playing(app: &AppHandle) {
    let handle = app.clone();
    app.listen_any("music-now", move |event| {
        let Ok(now) = serde_json::from_str::<serde_json::Value>(event.payload()) else {
            return;
        };
        let playing = now["playing"].as_bool().unwrap_or(false);
        let track = now["track"].as_object();
        let label = track.map(|t| {
            format!(
                "{} — {}",
                t.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                t.get("artist").and_then(|v| v.as_str()).unwrap_or("")
            )
        });

        if let Some(items) = TRAY_ITEMS.get() {
            let _ = items.toggle_play.set_text(if playing { "Пауза" } else { "Слушать" });
            let _ = items.toggle_play.set_enabled(track.is_some());
            let mut now_text = label.clone().unwrap_or_else(|| "Ничего не играет".into());
            if now_text.chars().count() > 48 {
                now_text = now_text.chars().take(47).collect::<String>() + "…";
            }
            let _ = items.now.set_text(now_text);
        }

        let tooltip = match &label {
            Some(label) => format!("Whithin\n{} {label}", if playing { "▶" } else { "⏸" }),
            None => "Whithin".into(),
        };
        let Ok(mut last) = LAST_TOOLTIP.lock() else { return };
        if *last == tooltip {
            return;
        }
        *last = tooltip.clone();
        if let Some(tray) = handle.tray_by_id(crate::desktop_shell::TRAY_ID) {
            let _ = tray.set_tooltip(Some(tooltip.chars().take(127).collect::<String>()));
        }
    });
}
