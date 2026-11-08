//! Tray, desktop toast notifications, and incoming-call overlay for Tauri.
//! Mirrors Electron `main.cjs` tray + `desktopNotifications.cjs` + `callOverlay.cjs`.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::Value;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Runtime, State, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

const NOTIF_WIDTH: i32 = 356;
const NOTIF_CARD_HEIGHT: i32 = 96;
const NOTIF_HEADER_HEIGHT: i32 = 36;
const NOTIF_GAP: i32 = 4;
const NOTIF_MARGIN: i32 = 8;
const NOTIF_MAX_VISIBLE: usize = 5;
// Host fuse is 90s; this is a slightly longer safety net.
const NOTIF_AUTO_DISMISS_MS: u64 = 100 * 1000;
const NOTIF_DEDUPE_MS: u64 = 3000;

const CALL_WIDTH: f64 = 320.0;
const CALL_HEIGHT: f64 = 304.0;
const CALL_AUTO_DISMISS_MS: u64 = 3 * 60 * 1000;

const LABEL_NOTIFICATIONS: &str = "desktop-notifications";
const LABEL_CALL_OVERLAY: &str = "call-overlay";
const LABEL_ACTIVE_CALL: &str = "active-call-overlay";

const ACTIVE_PANEL_WIDTH: f64 = 220.0;
const ACTIVE_ROW_HEIGHT: f64 = 42.0;
const ACTIVE_ROW_GAP: f64 = 12.0;
const ACTIVE_HOST_PADDING: f64 = 16.0;
const ACTIVE_MAX_VISIBLE: usize = 8;
const ACTIVE_MARGIN: f64 = 12.0;
const ACTIVE_FORCE_SYNC_MS: u64 = 80;

#[derive(Clone, Default)]
pub struct DesktopShellState {
    inner: Arc<Mutex<DesktopShellInner>>,
}

#[derive(Default)]
struct DesktopShellInner {
    notifications: Vec<Value>,
    notification_theme: Option<Value>,
    notification_position: String,
    measured_height: Option<i32>,
    recent_notifications: HashMap<String, Instant>,
    last_notification_bounds: Option<(f64, f64, f64, f64)>,
    active_call: Option<Value>,
    call_theme: Option<Value>,
    /// Participants overlay while already in a call (Electron `activeCallOverlay.cjs`).
    active_call_overlay: Option<Value>,
    active_call_overlay_theme: Option<Value>,
    active_call_overlay_coords: (f64, f64),
    active_call_overlay_measured: Option<(f64, f64)>,
    active_call_overlay_sync_alive: bool,
    active_call_host_creating: bool,
    tray_alive: bool,
}

impl DesktopShellState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(DesktopShellInner {
                notification_position: "top-right".into(),
                active_call_overlay_coords: (100.0, 100.0),
                ..Default::default()
            })),
        }
    }
}

fn asset_url(relative: &str) -> Result<WebviewUrl, String> {
    let url = format!("whithin-asset://localhost/{relative}")
        .parse()
        .map_err(|e| format!("Invalid asset url: {e}"))?;
    Ok(WebviewUrl::CustomProtocol(url))
}

fn show_main_window(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
        emit_visibility(app, &main);
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
        emit_visibility(app, &main);
    }
}

fn emit_visibility(app: &AppHandle, main: &WebviewWindow) {
    let minimized = main.is_minimized().unwrap_or(false);
    let visible = main.is_visible().unwrap_or(false);
    let focused = main.is_focused().unwrap_or(false);
    let _ = app.emit(
        "window-visibility-changed",
        serde_json::json!({
            "minimized": minimized,
            "visible": visible,
            "focused": focused,
        }),
    );
}

pub fn emit_main_visibility(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        emit_visibility(app, &main);
    }
}

pub fn setup_tray(app: &AppHandle, state: &DesktopShellState) -> Result<(), String> {
    let show_i = MenuItem::with_id(app, "show", "Показать", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let hide_i = MenuItem::with_id(app, "hide", "Скрыть", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let menu = Menu::with_items(app, &[&show_i, &hide_i, &quit_i]).map_err(|e| e.to_string())?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "No default window icon for tray".to_string())?;

    let handle = app.clone();
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Whithin")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "hide" => hide_main_window(app),
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(&handle);
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    if let Ok(mut guard) = state.inner.lock() {
        guard.tray_alive = true;
    }
    Ok(())
}

pub fn handle_main_window_event(app: &AppHandle, state: &DesktopShellState, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            let tray_alive = state
                .inner
                .lock()
                .map(|g| g.tray_alive)
                .unwrap_or(false);
            if tray_alive {
                api.prevent_close();
                hide_main_window(app);
            }
        }
        WindowEvent::Focused(_) | WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            emit_main_visibility(app);
        }
        _ => {}
    }
}

/// Logical work area (excludes taskbar). Falls back to full primary monitor.
fn primary_work_area<R: Runtime>(app: &AppHandle<R>) -> Option<(f64, f64, f64, f64)> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor().max(0.5);

    #[cfg(windows)]
    if let Some((x, y, w, h)) = windows_work_area_physical() {
        return Some((x / scale, y / scale, w / scale, h / scale));
    }

    let pos = monitor.position();
    let size = monitor.size();
    Some((
        pos.x as f64 / scale,
        pos.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    ))
}

#[cfg(windows)]
fn windows_work_area_physical() -> Option<(f64, f64, f64, f64)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };

    unsafe {
        let hmon = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(hmon, &mut info).as_bool() {
            return None;
        }
        let r = info.rcWork;
        Some((
            r.left as f64,
            r.top as f64,
            (r.right - r.left) as f64,
            (r.bottom - r.top) as f64,
        ))
    }
}

fn estimate_notification_height(count: usize) -> i32 {
    let n = count.max(1) as i32;
    // Hide-all only when 2+ toasts.
    let header = if n >= 2 {
        NOTIF_HEADER_HEIGHT + NOTIF_GAP
    } else {
        0
    };
    header + n * NOTIF_CARD_HEIGHT + (n - 1).max(0) * NOTIF_GAP
}

fn notification_bounds(
    app: &AppHandle,
    position: &str,
    count: usize,
    measured_height: Option<i32>,
) -> Option<(f64, f64, f64, f64)> {
    let (mx, my, mw, mh) = primary_work_area(app)?;
    let estimated = estimate_notification_height(count);
    let height = measured_height.unwrap_or(estimated).max(NOTIF_CARD_HEIGHT) as f64;
    let width = NOTIF_WIDTH as f64;
    let margin = NOTIF_MARGIN as f64;
    let (x, y) = match position {
        "top-left" => (mx + margin, my + margin),
        "bottom-left" => (mx + margin, my + mh - height - margin),
        "bottom-right" => (mx + mw - width - margin, my + mh - height - margin),
        _ => (mx + mw - width - margin, my + margin),
    };
    Some((x, y, width, height))
}

fn call_bounds(app: &AppHandle) -> Option<(f64, f64, f64, f64)> {
    let (mx, my, mw, mh) = primary_work_area(app)?;
    let width = CALL_WIDTH;
    let height = CALL_HEIGHT;
    let x = mx + ((mw - width) / 2.0);
    let y = my + ((mh - height) / 2.0);
    Some((x, y, width, height))
}

fn push_notification_host_data(app: &AppHandle, state: &DesktopShellState) {
    let Ok(guard) = state.inner.lock() else {
        return;
    };
    let payload = serde_json::json!({
        "items": guard.notifications,
        "theme": guard.notification_theme,
        "position": guard.notification_position,
    });
    drop(guard);
    // Broadcast + window emit: host may miss early window-only events while booting.
    let _ = app.emit("desktop-notification-host-data", &payload);
    if let Some(host) = app.get_webview_window(LABEL_NOTIFICATIONS) {
        let _ = host.emit("desktop-notification-host-data", &payload);
    }
}

fn push_call_host_data(app: &AppHandle, state: &DesktopShellState) {
    let Ok(guard) = state.inner.lock() else {
        return;
    };
    let payload = serde_json::json!({
        "call": guard.active_call,
        "theme": guard.call_theme,
    });
    drop(guard);
    let _ = app.emit("call-overlay-host-data", &payload);
    if let Some(host) = app.get_webview_window(LABEL_CALL_OVERLAY) {
        let _ = host.emit("call-overlay-host-data", &payload);
    }
}

fn json_id(value: &Value) -> Option<String> {
    match value.get("id") {
        Some(Value::String(s)) if !s.is_empty() => Some(s.clone()),
        Some(Value::Number(n)) => Some(n.to_string()),
        Some(other) => {
            let s = other.to_string().trim_matches('"').to_string();
            if s.is_empty() || s == "null" {
                None
            } else {
                Some(s)
            }
        }
        None => None,
    }
}

fn ensure_notification_host(app: &AppHandle, state: &DesktopShellState) -> Result<(), String> {
    if app.get_webview_window(LABEL_NOTIFICATIONS).is_some() {
        reposition_notification_host(app, state);
        push_notification_host_data(app, state);
        return Ok(());
    }

    let (count, position, measured) = {
        let guard = state.inner.lock().map_err(|e| e.to_string())?;
        (
            guard.notifications.len(),
            guard.notification_position.clone(),
            guard.measured_height,
        )
    };
    let (x, y, w, h) = notification_bounds(app, &position, count.max(1), measured).unwrap_or((
        40.0,
        40.0,
        NOTIF_WIDTH as f64,
        NOTIF_CARD_HEIGHT as f64,
    ));

    let url = asset_url("notification-host.html")?;
    // IMPORTANT: caller must be an async command on Windows (sync WebviewWindowBuilder deadlocks).
    // Start at content estimate; report_height snaps to opaque measure (logical CSS px).
    let host = WebviewWindowBuilder::new(app, LABEL_NOTIFICATIONS, url)
        .title("Whithin notifications")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(false)
        .visible(false)
        .shadow(false)
        .build()
        .map_err(|e| {
            eprintln!("[whithin-tauri] notification host create failed: {e}");
            format!("notification host: {e}")
        })?;

    let _ = host.set_ignore_cursor_events(false);
    let _ = host.set_always_on_top(true);
    eprintln!("[whithin-tauri] notification host created");
    Ok(())
}

fn reposition_notification_host(app: &AppHandle, state: &DesktopShellState) {
    let Some(host) = app.get_webview_window(LABEL_NOTIFICATIONS) else {
        return;
    };
    let Ok(guard) = state.inner.lock() else {
        return;
    };
    let count = guard.notifications.len();
    if count == 0 {
        let _ = host.hide();
        return;
    }
    let bounds = notification_bounds(
        app,
        &guard.notification_position,
        count,
        guard.measured_height,
    );
    drop(guard);
    if let Some((x, y, w, h)) = bounds {
        // Logical CSS px. Do not lock min/max — that prevented shrink and left empty HWND.
        let _ = host.set_min_size(None::<LogicalSize<f64>>);
        let _ = host.set_max_size(None::<LogicalSize<f64>>);
        let _ = host.set_size(LogicalSize::new(w, h));
        let _ = host.set_position(LogicalPosition::new(x, y));
        let _ = host.show();
        if let Ok(mut guard) = state.inner.lock() {
            guard.last_notification_bounds = Some((x, y, w, h));
        }
        eprintln!("[whithin-tauri] notification host bounds {w:.0}x{h:.0} @ {x:.0},{y:.0}");
        reposition_active_call_overlay_if_active(app, state);
    }
}

fn close_notification_host(app: &AppHandle, state: &DesktopShellState) {
    if let Some(host) = app.get_webview_window(LABEL_NOTIFICATIONS) {
        let _ = host.close();
    }
    if let Ok(mut guard) = state.inner.lock() {
        guard.last_notification_bounds = None;
    }
    reposition_active_call_overlay_if_active(app, state);
}

fn ensure_call_host(app: &AppHandle, state: &DesktopShellState) -> Result<(), String> {
    if app.get_webview_window(LABEL_CALL_OVERLAY).is_some() {
        push_call_host_data(app, state);
        if let Some(host) = app.get_webview_window(LABEL_CALL_OVERLAY) {
            let _ = host.show();
        }
        return Ok(());
    }

    let (x, y, w, h) = call_bounds(app).unwrap_or((200.0, 200.0, CALL_WIDTH, CALL_HEIGHT));
    let url = asset_url("call-overlay-host.html")?;
    // IMPORTANT: caller must be an async command on Windows (sync WebviewWindowBuilder deadlocks).
    let host = WebviewWindowBuilder::new(app, LABEL_CALL_OVERLAY, url)
        .title("Whithin call")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(true)
        .visible(false)
        .build()
        .map_err(|e| {
            eprintln!("[whithin-tauri] call overlay host create failed: {e}");
            format!("call overlay host: {e}")
        })?;
    let _ = host.set_always_on_top(true);
    eprintln!("[whithin-tauri] call overlay host created");
    Ok(())
}

fn close_call_host(app: &AppHandle) {
    if let Some(host) = app.get_webview_window(LABEL_CALL_OVERLAY) {
        let _ = host.close();
    }
}

fn chat_id_of(value: &Value) -> Option<String> {
    value
        .get("chatId")
        .map(|v| match v {
            Value::String(s) => s.clone(),
            other => other.to_string().trim_matches('"').to_string(),
        })
        .filter(|s| !s.is_empty())
}

fn schedule_call_auto_dismiss(app: AppHandle, state: DesktopShellState, chat_id: String) {
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(CALL_AUTO_DISMISS_MS));
        let still = state
            .inner
            .lock()
            .ok()
            .and_then(|g| g.active_call.as_ref().and_then(chat_id_of));
        if still.as_deref() == Some(chat_id.as_str()) {
            if let Ok(mut guard) = state.inner.lock() {
                guard.active_call = None;
            }
            close_call_host(&app);
        }
    });
}

// --- Commands: notifications -------------------------------------------------

#[tauri::command]
pub async fn show_desktop_notification(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    let id = json_id(&payload).ok_or_else(|| "notification id required".to_string())?;

    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        let now = Instant::now();
        guard
            .recent_notifications
            .retain(|_, at| now.duration_since(*at) < Duration::from_millis(NOTIF_DEDUPE_MS));
        if guard.recent_notifications.contains_key(&id) {
            return Ok(());
        }
        guard.recent_notifications.insert(id.clone(), now);
        guard.notifications.retain(|item| json_id(item).as_deref() != Some(id.as_str()));
        // Ensure host always gets a string id (HTML data-id / dismiss match).
        let mut stored = payload;
        if let Some(obj) = stored.as_object_mut() {
            obj.insert("id".into(), Value::String(id.clone()));
        }
        guard.notifications.insert(0, stored);
        if guard.notifications.len() > NOTIF_MAX_VISIBLE {
            guard.notifications.truncate(NOTIF_MAX_VISIBLE);
        }
        guard.measured_height = None;
    }

    eprintln!("[whithin-tauri] show desktop notification id={id}");
    ensure_notification_host(&app, &state)?;
    reposition_notification_host(&app, &state);
    push_notification_host_data(&app, &state);

    let app2 = app.clone();
    let state2 = DesktopShellState {
        inner: Arc::clone(&state.inner),
    };
    let dismiss_id = id.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(NOTIF_AUTO_DISMISS_MS));
        let _ = desktop_notification_dismiss_inner(&app2, &state2, &dismiss_id);
    });

    Ok(())
}

fn desktop_notification_dismiss_inner(
    app: &AppHandle,
    state: &DesktopShellState,
    id: &str,
) -> Result<(), String> {
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        guard
            .notifications
            .retain(|item| json_id(item).as_deref() != Some(id));
        if guard.notifications.is_empty() {
            guard.measured_height = None;
        }
    }
    if state
        .inner
        .lock()
        .map(|g| g.notifications.is_empty())
        .unwrap_or(true)
    {
        close_notification_host(app, state);
    } else {
        reposition_notification_host(app, state);
        push_notification_host_data(app, state);
    }
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_dismiss(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    id: String,
) -> Result<(), String> {
    desktop_notification_dismiss_inner(&app, &state, &id)
}

#[tauri::command]
pub fn desktop_notification_dismiss_by_chat(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    chat_id: String,
) -> Result<(), String> {
    {
        let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
        guard.notifications.retain(|item| {
            item.get("chatId")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .map(|existing| existing != chat_id)
                .unwrap_or(true)
        });
    }
    if state
        .inner
        .lock()
        .map(|g| g.notifications.is_empty())
        .unwrap_or(true)
    {
        close_notification_host(&app, &state);
    } else {
        reposition_notification_host(&app, &state);
        push_notification_host_data(&app, &state);
    }
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_dismiss_all(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.notifications.clear();
        guard.measured_height = None;
    }
    close_notification_host(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_sync_settings(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    settings: Value,
) -> Result<(), String> {
    if let Some(position) = settings.get("position").and_then(|v| v.as_str()) {
        let valid = matches!(
            position,
            "top-right" | "top-left" | "bottom-right" | "bottom-left"
        );
        if valid {
            if let Ok(mut guard) = state.inner.lock() {
                guard.notification_position = position.to_string();
                guard.measured_height = None;
            }
        }
    }
    reposition_notification_host(&app, &state);
    push_notification_host_data(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_sync_theme(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    theme: Value,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.notification_theme = Some(theme);
    }
    push_notification_host_data(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_report_height(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    height: f64,
) -> Result<(), String> {
    // CSS px of opaque toast stack only (no swipe padding / window chrome).
    let clamped = height
        .round()
        .clamp(
            NOTIF_CARD_HEIGHT as f64,
            estimate_notification_height(NOTIF_MAX_VISIBLE) as f64 + 32.0,
        ) as i32;
    if let Ok(mut guard) = state.inner.lock() {
        guard.measured_height = Some(clamped);
    }
    reposition_notification_host(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_open(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    if let Some(id) = json_id(&payload) {
        let _ = desktop_notification_dismiss_inner(&app, &state, &id);
    }
    show_main_window(&app);
    let _ = app.emit("desktop-open-notification", payload);
    Ok(())
}

#[tauri::command]
pub fn desktop_notification_host_ready(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    reposition_notification_host(&app, &state);
    push_notification_host_data(&app, &state);
    if let Some(host) = app.get_webview_window(LABEL_NOTIFICATIONS) {
        let _ = host.show();
    }
    Ok(())
}

// --- Commands: call overlay --------------------------------------------------

#[tauri::command]
pub async fn show_call_overlay(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    let chat_id = payload
        .get("chatId")
        .map(|v| v.to_string().trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "chatId required".to_string())?;

    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call = Some(payload);
    }

    ensure_call_host(&app, &state)?;
    if let Some((x, y, w, h)) = call_bounds(&app) {
        if let Some(host) = app.get_webview_window(LABEL_CALL_OVERLAY) {
            let _ = host.set_size(LogicalSize::new(w, h));
            let _ = host.set_position(LogicalPosition::new(x, y));
            let _ = host.show();
            let _ = host.set_focus();
        }
    }
    push_call_host_data(&app, &state);
    let shell = DesktopShellState {
        inner: Arc::clone(&state.inner),
    };
    schedule_call_auto_dismiss(app.clone(), shell, chat_id);
    Ok(())
}

#[tauri::command]
pub fn update_call_overlay(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    let Ok(mut guard) = state.inner.lock() else {
        return Ok(());
    };
    let Some(active) = guard.active_call.as_mut() else {
        return Ok(());
    };
    let active_id = active
        .get("chatId")
        .map(|v| v.to_string())
        .unwrap_or_default();
    let next_id = payload
        .get("chatId")
        .map(|v| v.to_string())
        .unwrap_or_default();
    if active_id != next_id {
        return Ok(());
    }
    if let (Some(a), Some(b)) = (active.as_object_mut(), payload.as_object()) {
        for (k, v) in b {
            a.insert(k.clone(), v.clone());
        }
    }
    drop(guard);
    push_call_host_data(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn call_overlay_dismiss(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call = None;
    }
    close_call_host(&app);
    Ok(())
}

#[tauri::command]
pub fn call_overlay_sync_theme(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    theme: Value,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.call_theme = Some(theme);
    }
    push_call_host_data(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn call_overlay_accept(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call = None;
    }
    close_call_host(&app);
    show_main_window(&app);
    let _ = app.emit(
        "call-overlay-action",
        serde_json::json!({ "action": "accept" }),
    );
    Ok(())
}

#[tauri::command]
pub fn call_overlay_decline(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call = None;
    }
    close_call_host(&app);
    let _ = app.emit(
        "call-overlay-action",
        serde_json::json!({ "action": "decline" }),
    );
    Ok(())
}

#[tauri::command]
pub fn call_overlay_host_ready(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    push_call_host_data(&app, &state);
    if let Some(host) = app.get_webview_window(LABEL_CALL_OVERLAY) {
        let _ = host.show();
    }
    Ok(())
}

// --- Active call participants overlay ----------------------------------------

fn clamp_percent(value: f64, fallback: f64) -> f64 {
    if !value.is_finite() {
        return fallback;
    }
    value.clamp(0.0, 100.0)
}

fn normalize_overlay_coords(coords: &Value) -> (f64, f64) {
    let x = coords
        .get("xPercent")
        .and_then(|v| v.as_f64())
        .unwrap_or(100.0);
    let y = coords
        .get("yPercent")
        .and_then(|v| v.as_f64())
        .unwrap_or(100.0);
    (clamp_percent(x, 100.0), clamp_percent(y, 100.0))
}

fn active_participant_count(payload: &Value) -> usize {
    let count = payload
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    count.max(1).min(ACTIVE_MAX_VISIBLE)
}

fn estimate_active_call_height(payload: &Value) -> f64 {
    let count = active_participant_count(payload) as f64;
    if count <= 1.0 {
        return ACTIVE_ROW_HEIGHT + ACTIVE_HOST_PADDING;
    }
    count * ACTIVE_ROW_HEIGHT + (count - 1.0) * ACTIVE_ROW_GAP + ACTIVE_HOST_PADDING
}

fn rects_intersect(
    a: (f64, f64, f64, f64),
    b: (f64, f64, f64, f64),
) -> bool {
    let (ax, ay, aw, ah) = a;
    let (bx, by, bw, bh) = b;
    !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay)
}

/// Full primary monitor in logical px (Electron uses bounds on Win so overlay
/// survives exclusive fullscreen; notifications still use work area).
fn primary_monitor_area<R: Runtime>(app: &AppHandle<R>) -> Option<(f64, f64, f64, f64)> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let scale = monitor.scale_factor().max(0.5);
    let pos = monitor.position();
    let size = monitor.size();
    Some((
        pos.x as f64 / scale,
        pos.y as f64 / scale,
        size.width as f64 / scale,
        size.height as f64 / scale,
    ))
}

fn active_call_overlay_bounds(
    app: &AppHandle,
    state: &DesktopShellState,
    payload: &Value,
    size_override: Option<(f64, f64)>,
) -> Option<(f64, f64, f64, f64)> {
    let (mx, my, mw, mh) = primary_monitor_area(app)?;
    let Ok(guard) = state.inner.lock() else {
        return None;
    };
    let (x_pct, y_pct) = guard.active_call_overlay_coords;
    let notif_pos = guard.notification_position.clone();
    let measured = guard.active_call_overlay_measured;
    let notif_bounds = guard.last_notification_bounds;
    drop(guard);

    let (width, height) = size_override
        .or(measured)
        .unwrap_or_else(|| (ACTIVE_PANEL_WIDTH, estimate_active_call_height(payload)));

    let max_x = (mw - width - ACTIVE_MARGIN * 2.0).max(0.0);
    let max_y = (mh - height - ACTIVE_MARGIN * 2.0).max(0.0);
    let x = mx + ACTIVE_MARGIN + max_x * (x_pct / 100.0);
    let mut y = my + ACTIVE_MARGIN + max_y * (y_pct / 100.0);

    if let Some(nb) = notif_bounds {
        let overlay_rect = (x, y, width, height);
        if rects_intersect(overlay_rect, nb) {
            let is_bottom = notif_pos.starts_with("bottom");
            if is_bottom {
                y = (nb.1 - height - ACTIVE_MARGIN).max(my + ACTIVE_MARGIN);
            } else {
                let max_y_pos = my + mh - height - ACTIVE_MARGIN;
                y = (nb.1 + nb.3 + ACTIVE_MARGIN).min(max_y_pos);
            }
        }
    }

    Some((x, y, width, height))
}

fn push_active_call_overlay_data(app: &AppHandle, state: &DesktopShellState) {
    let Ok(guard) = state.inner.lock() else {
        return;
    };
    let payload = serde_json::json!({
        "payload": guard.active_call_overlay,
        "theme": guard.active_call_overlay_theme,
        "coords": {
            "xPercent": guard.active_call_overlay_coords.0,
            "yPercent": guard.active_call_overlay_coords.1,
        },
    });
    drop(guard);
    let _ = app.emit("active-call-overlay-host-data", &payload);
    if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
        let _ = host.emit("active-call-overlay-host-data", &payload);
    }
}

fn start_active_call_force_sync(app: AppHandle, state: DesktopShellState) {
    let already = state
        .inner
        .lock()
        .map(|g| g.active_call_overlay_sync_alive)
        .unwrap_or(true);
    if already {
        return;
    }
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay_sync_alive = true;
    }
    std::thread::spawn(move || {
        loop {
            let alive = state
                .inner
                .lock()
                .map(|g| g.active_call_overlay.is_some() && g.active_call_overlay_sync_alive)
                .unwrap_or(false);
            if !alive {
                if let Ok(mut guard) = state.inner.lock() {
                    guard.active_call_overlay_sync_alive = false;
                }
                break;
            }
            let _ = app.emit("force-active-call-overlay-sync", serde_json::json!({}));
            std::thread::sleep(Duration::from_millis(ACTIVE_FORCE_SYNC_MS));
        }
    });
}

fn stop_active_call_force_sync(state: &DesktopShellState) {
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay_sync_alive = false;
    }
}

fn apply_active_call_host_bounds(app: &AppHandle, state: &DesktopShellState, payload: &Value) {
    let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) else {
        return;
    };
    let Some((x, y, w, h)) = active_call_overlay_bounds(app, state, payload, None) else {
        return;
    };
    let _ = host.set_min_size(None::<LogicalSize<f64>>);
    let _ = host.set_max_size(None::<LogicalSize<f64>>);
    let _ = host.set_size(LogicalSize::new(w, h));
    let _ = host.set_position(LogicalPosition::new(x, y));
    let _ = host.set_ignore_cursor_events(true);
    let _ = host.set_always_on_top(true);
}

fn ensure_active_call_host(app: &AppHandle, state: &DesktopShellState) -> Result<(), String> {
    let payload = state
        .inner
        .lock()
        .ok()
        .and_then(|g| g.active_call_overlay.clone())
        .ok_or_else(|| "no active call overlay payload".to_string())?;

    if app.get_webview_window(LABEL_ACTIVE_CALL).is_some() {
        apply_active_call_host_bounds(app, state, &payload);
        push_active_call_overlay_data(app, state);
        if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
            let _ = host.show();
        }
        return Ok(());
    }

    {
        let Ok(mut guard) = state.inner.lock() else {
            return Ok(());
        };
        if guard.active_call_host_creating {
            return Ok(());
        }
        guard.active_call_host_creating = true;
    }

    let (x, y, w, h) = active_call_overlay_bounds(app, state, &payload, None).unwrap_or((
        40.0,
        40.0,
        ACTIVE_PANEL_WIDTH,
        estimate_active_call_height(&payload),
    ));
    let url = match asset_url("active-call-overlay-host.html") {
        Ok(u) => u,
        Err(e) => {
            if let Ok(mut guard) = state.inner.lock() {
                guard.active_call_host_creating = false;
            }
            return Err(e);
        }
    };

    let built = WebviewWindowBuilder::new(app, LABEL_ACTIVE_CALL, url)
        .title("Whithin active call")
        .inner_size(w, h)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(false)
        .visible(false)
        .shadow(false)
        .build();

    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_host_creating = false;
    }

    match built {
        Ok(host) => {
            let _ = host.set_ignore_cursor_events(true);
            let _ = host.set_always_on_top(true);
            eprintln!("[whithin-tauri] active call overlay host created");
            Ok(())
        }
        Err(e) => {
            // Concurrent create: window may already exist.
            if app.get_webview_window(LABEL_ACTIVE_CALL).is_some() {
                apply_active_call_host_bounds(app, state, &payload);
                push_active_call_overlay_data(app, state);
                return Ok(());
            }
            eprintln!("[whithin-tauri] active call overlay create failed: {e}");
            Err(format!("active call overlay: {e}"))
        }
    }
}

fn close_active_call_host(app: &AppHandle) {
    if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
        let _ = host.close();
    }
}

fn sync_active_call_host(app: &AppHandle, state: &DesktopShellState) -> Result<(), String> {
    let payload = state
        .inner
        .lock()
        .ok()
        .and_then(|g| g.active_call_overlay.clone());
    let Some(payload) = payload else {
        close_active_call_host(app);
        return Ok(());
    };
    let has_participants = payload
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_participants {
        close_active_call_host(app);
        return Ok(());
    }
    ensure_active_call_host(app, state)?;
    apply_active_call_host_bounds(app, state, &payload);
    push_active_call_overlay_data(app, state);
    if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
        let _ = host.show();
    }
    Ok(())
}

fn reposition_active_call_overlay_if_active(app: &AppHandle, state: &DesktopShellState) {
    let payload = state
        .inner
        .lock()
        .ok()
        .and_then(|g| g.active_call_overlay.clone());
    let Some(payload) = payload else {
        return;
    };
    if app.get_webview_window(LABEL_ACTIVE_CALL).is_none() {
        return;
    }
    apply_active_call_host_bounds(app, state, &payload);
}

#[tauri::command]
pub async fn show_active_call_overlay(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    let has_participants = payload
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_participants {
        return Ok(());
    }

    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay = Some(payload);
        guard.active_call_overlay_measured = None;
    }

    let shell = DesktopShellState {
        inner: Arc::clone(&state.inner),
    };
    start_active_call_force_sync(app.clone(), shell);
    sync_active_call_host(&app, &state)?;
    eprintln!("[whithin-tauri] show active call overlay");
    Ok(())
}

#[tauri::command]
pub async fn update_active_call_overlay(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    payload: Value,
) -> Result<(), String> {
    let has_participants = payload
        .get("participants")
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_participants {
        return dismiss_active_call_overlay(app, state);
    }

    let prev_count = state
        .inner
        .lock()
        .ok()
        .and_then(|g| g.active_call_overlay.as_ref().map(active_participant_count))
        .unwrap_or(0);
    let next_count = active_participant_count(&payload);

    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay = Some(payload.clone());
        if prev_count != next_count {
            guard.active_call_overlay_measured = None;
        }
    }

    if app.get_webview_window(LABEL_ACTIVE_CALL).is_none() {
        let shell = DesktopShellState {
            inner: Arc::clone(&state.inner),
        };
        start_active_call_force_sync(app.clone(), shell);
        sync_active_call_host(&app, &state)?;
        return Ok(());
    }

    push_active_call_overlay_data(&app, &state);
    if prev_count != next_count {
        apply_active_call_host_bounds(&app, &state, &payload);
    }
    Ok(())
}

#[tauri::command]
pub fn dismiss_active_call_overlay(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    stop_active_call_force_sync(&state);
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay = None;
        guard.active_call_overlay_measured = None;
    }
    close_active_call_host(&app);
    Ok(())
}

#[tauri::command]
pub fn sync_active_call_overlay_settings(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    settings: Value,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        if let Some(coords) = settings.get("coords") {
            guard.active_call_overlay_coords = normalize_overlay_coords(coords);
        }
        if let Some(pos) = settings.get("notificationPosition").and_then(|v| v.as_str()) {
            if matches!(
                pos,
                "top-right" | "top-left" | "bottom-right" | "bottom-left"
            ) {
                // Keep toast corner in sync for collision avoidance with this overlay.
                guard.notification_position = pos.to_string();
            }
        }
    }
    reposition_active_call_overlay_if_active(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn sync_active_call_overlay_theme(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    theme: Value,
) -> Result<(), String> {
    if let Ok(mut guard) = state.inner.lock() {
        guard.active_call_overlay_theme = Some(theme);
    }
    push_active_call_overlay_data(&app, &state);
    Ok(())
}

#[tauri::command]
pub fn active_call_overlay_report_size(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if !width.is_finite() || !height.is_finite() {
        return Ok(());
    }
    let measured = (
        width.round().clamp(80.0, 360.0),
        height.round().max(ACTIVE_ROW_HEIGHT),
    );
    let payload = {
        let Ok(mut guard) = state.inner.lock() else {
            return Ok(());
        };
        guard.active_call_overlay_measured = Some(measured);
        guard.active_call_overlay.clone()
    };
    let Some(payload) = payload else {
        return Ok(());
    };
    if let Some((x, y, w, h)) =
        active_call_overlay_bounds(&app, &state, &payload, Some(measured))
    {
        if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
            let _ = host.set_size(LogicalSize::new(w, h));
            let _ = host.set_position(LogicalPosition::new(x, y));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn active_call_overlay_host_ready(
    app: AppHandle,
    state: State<'_, DesktopShellState>,
) -> Result<(), String> {
    push_active_call_overlay_data(&app, &state);
    if let Some(host) = app.get_webview_window(LABEL_ACTIVE_CALL) {
        let _ = host.set_ignore_cursor_events(true);
        let _ = host.show();
    }
    Ok(())
}

#[tauri::command]
pub fn focus_main_window(app: AppHandle) -> Result<(), String> {
    show_main_window(&app);
    Ok(())
}

#[tauri::command]
pub fn window_minimize(app: AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    main.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_toggle_maximize(app: AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    if main.is_maximized().unwrap_or(false) {
        main.unmaximize().map_err(|e| e.to_string())
    } else {
        main.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    // Close-to-tray is handled by CloseRequested on the main window.
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    main.close().map_err(|e| e.to_string())
}
