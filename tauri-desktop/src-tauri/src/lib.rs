mod audio_capture;
mod apple;
mod deezer;
mod desktop_parity;
mod desktop_shell;
mod display_capture;
mod music;
mod music_audio;
mod music_library;
mod music_window;
mod screen_sources;
mod shortcuts;
mod soundcloud;
mod local_music;
mod yt_net;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use audio_capture::AudioCaptureManager;
use display_capture::DisplayCaptureManager;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSelection {
    pub id: String,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub source_type: String,
    pub capture_audio: bool,
    pub include_camera: Option<bool>,
    pub process_pid: Option<u32>,
    pub exclude_self_pid: Option<u32>,
    /// Capture/publish preset: 480p | 720p | 1080p | 1440p
    pub resolution: Option<String>,
    /// Target capture/publish FPS: 15 | 30 | 60
    pub frame_rate: Option<u32>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PickerSelectionIn {
    id: String,
    name: Option<String>,
    #[serde(rename = "type")]
    source_type: String,
    capture_audio: bool,
    include_camera: Option<bool>,
    process_pid: Option<u32>,
    resolution: Option<String>,
    frame_rate: Option<u32>,
}

struct AppState {
    audio: AudioCaptureManager,
    display: DisplayCaptureManager,
    last_selection: Mutex<Option<ScreenSelection>>,
    picker_tx: Mutex<Option<std::sync::mpsc::Sender<Option<ScreenSelection>>>>,
}

fn client_url() -> String {
    if let Ok(url) = std::env::var("WEB_CLIENT_URL") {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if cfg!(debug_assertions) {
        "http://localhost:5173".to_string()
    } else {
        "https://whithin.ru".to_string()
    }
}

fn asset_url(relative: &str) -> Result<WebviewUrl, String> {
    // Custom protocol so the picker gets Tauri IPC (file:// does not).
    // Windows resolves this as http://whithin-asset.localhost/<path>
    let url = format!("whithin-asset://localhost/{relative}")
        .parse()
        .map_err(|e| format!("Invalid asset url: {e}"))?;
    Ok(WebviewUrl::CustomProtocol(url))
}

fn serve_embedded_asset(request: tauri::http::Request<Vec<u8>>) -> tauri::http::Response<Vec<u8>> {
    let path = request.uri().path().trim_start_matches('/');
    let (bytes, mime) = match path {
        "" | "shell.html" => (load_asset_html("shell.html"), "text/html; charset=utf-8"),
        "music.html" => (load_asset_html("music.html"), "text/html; charset=utf-8"),
        "screen-picker.html" => (load_screen_picker_html(), "text/html; charset=utf-8"),
        "notification-host.html" => (load_asset_html("notification-host.html"), "text/html; charset=utf-8"),
        "call-overlay-host.html" => (load_asset_html("call-overlay-host.html"), "text/html; charset=utf-8"),
        "active-call-overlay-host.html" => (
            load_asset_html("active-call-overlay-host.html"),
            "text/html; charset=utf-8",
        ),
        "sad404.svg" => (load_asset_bytes("sad404.svg"), "image/svg+xml"),
        "live-frame.jpg" | "live-frame.jpeg" => {
            match display_capture::take_latest_jpeg() {
                Some((message, _, _, _)) if message.len() > display_capture::FRAME_HEADER_LEN => {
                    (message[display_capture::FRAME_HEADER_LEN..].to_vec(), "image/jpeg")
                }
                _ => {
                    // 1x1 dark pixel so fetch never hard-fails before first frame.
                    return tauri::http::Response::builder()
                        .status(204)
                        .header("Cache-Control", "no-store, no-cache, must-revalidate")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Vec::new())
                        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
                }
            }
        }
        other => {
            eprintln!("[whithin-asset] not found: {other}");
            return tauri::http::Response::builder()
                .status(404)
                .header("Content-Type", "text/plain; charset=utf-8")
                .body(format!("asset not found: {other}").into_bytes())
                .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
        }
    };

    tauri::http::Response::builder()
        .status(200)
        .header("Content-Type", mime)
        .header("Cache-Control", "no-store, no-cache, must-revalidate")
        .header("Access-Control-Allow-Origin", "*")
        .body(bytes)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

fn load_screen_picker_html() -> Vec<u8> {
    load_asset_html("screen-picker.html")
}

fn load_asset_bytes(file_name: &str) -> Vec<u8> {
    // In debug, prefer live file so asset tweaks don't require full rebuild.
    #[cfg(debug_assertions)]
    {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets").join(file_name);
        if let Ok(bytes) = std::fs::read(&path) {
            return bytes;
        }
    }
    match file_name {
        "sad404.svg" => include_bytes!("../assets/sad404.svg").to_vec(),
        _ => format!("asset not found: {file_name}").into_bytes(),
    }
}

fn load_asset_html(file_name: &str) -> Vec<u8> {
    // In debug, prefer live file so HTML tweaks don't require full rebuild.
    #[cfg(debug_assertions)]
    {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets").join(file_name);
        if let Ok(bytes) = std::fs::read(&path) {
            return bytes;
        }
    }
    match file_name {
        "shell.html" => include_str!("../assets/shell.html").as_bytes().to_vec(),
        "music.html" => include_str!("../assets/music.html").as_bytes().to_vec(),
        "titlebar-player.js" => include_str!("../assets/titlebar-player.js").as_bytes().to_vec(),
        "screen-picker.html" => include_str!("../assets/screen-picker.html")
            .as_bytes()
            .to_vec(),
        "notification-host.html" => include_str!("../assets/notification-host.html")
            .as_bytes()
            .to_vec(),
        "call-overlay-host.html" => include_str!("../assets/call-overlay-host.html")
            .as_bytes()
            .to_vec(),
        "active-call-overlay-host.html" => {
            include_str!("../assets/active-call-overlay-host.html")
                .as_bytes()
                .to_vec()
        }
        _ => format!("asset not found: {file_name}").into_bytes(),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellProbeResult {
    ok: bool,
    url: String,
    message: Option<String>,
}

#[tauri::command]
fn shell_client_url() -> String {
    client_url()
}

#[tauri::command]
fn shell_probe_client() -> ShellProbeResult {
    let url = client_url();
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(3))
        .timeout_read(std::time::Duration::from_secs(5))
        .build();

    match agent.get(&url).call() {
        Ok(resp) => {
            let status = resp.status();
            // Accept anything short of a hard server failure — SPA/dev servers may 304/redirect.
            if (200..500).contains(&status) {
                ShellProbeResult {
                    ok: true,
                    url,
                    message: None,
                }
            } else {
                ShellProbeResult {
                    ok: false,
                    url,
                    message: Some(format!("Сервер ответил HTTP {status}")),
                }
            }
        }
        Err(err) => ShellProbeResult {
            ok: false,
            url,
            message: Some(format!("Сервер недоступен: {err}")),
        },
    }
}

#[tauri::command]
fn shell_open_client(app: tauri::AppHandle) -> Result<(), String> {
    let main = app
        .get_webview("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let parsed = client_url()
        .parse::<url::Url>()
        .map_err(|e| format!("Invalid client url: {e}"))?;
    main.navigate(parsed).map_err(|e| e.to_string())
}

#[tauri::command]
fn shell_show_offline(app: tauri::AppHandle) -> Result<(), String> {
    navigate_main_to_shell(&app, true)
}

fn shell_page_url(offline: bool) -> Result<url::Url, String> {
    let relative = if offline {
        "shell.html?error=1"
    } else {
        "shell.html"
    };
    format!("whithin-asset://localhost/{relative}")
        .parse()
        .map_err(|e| format!("Invalid shell url: {e}"))
}

fn navigate_main_to_shell(app: &tauri::AppHandle, offline: bool) -> Result<(), String> {
    let main = app
        .get_webview("main")
        .ok_or_else(|| "main window missing".to_string())?;
    main.navigate(shell_page_url(offline)?).map_err(|e| e.to_string())
}

#[tauri::command]
fn audio_is_platform_supported() -> bool {
    cfg!(windows)
}

#[tauri::command]
fn audio_check_permission() -> serde_json::Value {
    serde_json::json!({ "status": "authorized" })
}

#[tauri::command]
fn audio_request_permission() -> serde_json::Value {
    serde_json::json!({ "status": "authorized" })
}

#[tauri::command]
fn audio_start_capture(app: tauri::AppHandle, state: State<'_, Arc<AppState>>, pid: u32) -> Result<bool, String> {
    state.audio.start(app, pid, false)
}

#[tauri::command]
fn audio_start_capture_exclude(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    pid: u32,
) -> Result<bool, String> {
    state.audio.start(app, pid, true)
}

#[tauri::command]
fn audio_stop_capture(state: State<'_, Arc<AppState>>) -> bool {
    state.audio.stop()
}

#[tauri::command]
fn audio_is_capturing(state: State<'_, Arc<AppState>>) -> bool {
    state.audio.is_capturing()
}

#[tauri::command]
fn list_screen_sources() -> Result<Vec<screen_sources::ScreenSourceDto>, String> {
    screen_sources::list_screen_sources()
}

#[tauri::command]
fn get_app_pid() -> u32 {
    std::process::id()
}

#[tauri::command]
fn seed_screen_selection(
    state: State<'_, Arc<AppState>>,
    selection: PickerSelectionIn,
) -> bool {
    let exclude_self_pid = if cfg!(windows) {
        Some(std::process::id())
    } else {
        None
    };
    let result = ScreenSelection {
        id: selection.id,
        name: selection.name,
        source_type: selection.source_type,
        capture_audio: selection.capture_audio,
        include_camera: selection.include_camera,
        process_pid: selection.process_pid,
        exclude_self_pid,
        resolution: selection.resolution,
        frame_rate: selection.frame_rate,
    };
    if let Ok(mut last) = state.last_selection.lock() {
        *last = Some(result);
        true
    } else {
        false
    }
}

#[tauri::command]
fn arm_screen_capture(
    state: State<'_, Arc<AppState>>,
    options: Option<serde_json::Value>,
) -> bool {
    let mut last = match state.last_selection.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    let Some(sel) = last.as_mut() else {
        return false;
    };
    if let Some(opts) = options {
        if let Some(capture_audio) = opts.get("captureAudio").and_then(|v| v.as_bool()) {
            sel.capture_audio = capture_audio;
        }
    }
    true
}

#[derive(Clone, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct DisplayCaptureRequest {
    max_width: Option<u32>,
    max_height: Option<u32>,
    frame_rate: Option<u32>,
    quality: Option<u8>,
    /// "i420" (default, zero-conversion WebRTC path) or "jpeg" (fallbacks).
    format: Option<String>,
}

#[tauri::command]
fn display_capture_start(
    state: State<'_, Arc<AppState>>,
    options: Option<DisplayCaptureRequest>,
) -> Result<serde_json::Value, String> {
    let selection = state
        .last_selection
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No screen source armed — open the picker first".to_string())?;

    let req = options.unwrap_or_default();
    let defaults = display_capture::CaptureOptions::default();
    let capture_options = display_capture::CaptureOptions {
        max_width: req.max_width.unwrap_or(defaults.max_width),
        max_height: req.max_height.unwrap_or(defaults.max_height),
        fps: req.frame_rate.unwrap_or(defaults.fps),
        quality: req.quality.unwrap_or(defaults.quality),
        format: display_capture::FrameFormat::parse(req.format.as_deref()),
    };

    let info = state.display.start(
        selection.id.clone(),
        selection.source_type.clone(),
        capture_options,
    )?;

    Ok(serde_json::json!({
        "ok": true,
        "id": selection.id,
        "type": selection.source_type,
        "name": selection.name,
        "captureAudio": selection.capture_audio,
        "processPid": selection.process_pid,
        "excludeSelfPid": selection.exclude_self_pid,
        "backend": info.backend,
        "wsUrl": format!("ws://127.0.0.1:{}/frames?token={}", info.port, info.token),
        "sourceWidth": info.source_width,
        "sourceHeight": info.source_height,
        "width": info.out_width,
        "height": info.out_height,
        "frameRate": info.fps,
        "format": info.format.as_str(),
        "headerLength": display_capture::FRAME_HEADER_LEN,
        "frameUrl": "http://whithin-asset.localhost/live-frame.jpg",
    }))
}

#[tauri::command]
fn display_capture_stop(state: State<'_, Arc<AppState>>) -> bool {
    state.display.stop()
}

#[tauri::command]
fn display_capture_is_active(state: State<'_, Arc<AppState>>) -> bool {
    state.display.is_capturing()
}

#[tauri::command]
fn display_capture_frame_info() -> serde_json::Value {
    match display_capture::latest_frame_info() {
        Some((seq, width, height)) => serde_json::json!({
            "seq": seq,
            "width": width,
            "height": height,
        }),
        None => serde_json::json!({
            "seq": 0,
            "width": 0,
            "height": 0,
        }),
    }
}

#[tauri::command]
fn get_last_screen_selection(state: State<'_, Arc<AppState>>) -> Option<ScreenSelection> {
    state.last_selection.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
fn shortcuts_update(shortcuts: std::collections::HashMap<String, String>) {
    shortcuts::update_shortcuts(shortcuts::ShortcutsUpdate { shortcuts });
}

#[tauri::command]
fn picker_ready(app: tauri::AppHandle) -> Result<Vec<screen_sources::ScreenSourceDto>, String> {
    // Return screens immediately (never wait on Window::all).
    let screens = screen_sources::list_screens_only();
    if let Some(picker) = app.get_webview_window("screen-picker") {
        let _ = picker.emit(
            "screen-picker-init",
            serde_json::json!({ "sources": screens.clone() }),
        );
    }

    // Append windows + thumbnails in background.
    let app2 = app.clone();
    std::thread::spawn(move || {
        let mut sources = screen_sources::list_screens_only();
        sources.extend(screen_sources::list_windows_only());
        if let Some(picker) = app2.get_webview_window("screen-picker") {
            let _ = picker.emit(
                "screen-picker-init",
                serde_json::json!({ "sources": sources }),
            );
        }
        // Optional richer pass with thumbnails.
        if let Ok(full) = screen_sources::list_screen_sources() {
            if let Some(picker) = app2.get_webview_window("screen-picker") {
                let _ = picker.emit(
                    "screen-picker-init",
                    serde_json::json!({ "sources": full }),
                );
            }
        }
    });

    Ok(screens)
}

#[tauri::command]
fn picker_refresh(app: tauri::AppHandle) -> Result<Vec<screen_sources::ScreenSourceDto>, String> {
    let mut sources = screen_sources::list_screens_only();
    sources.extend(screen_sources::list_windows_only());
    if let Some(picker) = app.get_webview_window("screen-picker") {
        let _ = picker.emit(
            "screen-picker-init",
            serde_json::json!({ "sources": sources.clone() }),
        );
    }
    Ok(sources)
}

#[tauri::command]
fn picker_submit(app: tauri::AppHandle, state: State<'_, Arc<AppState>>, selection: PickerSelectionIn) {
    let exclude_self_pid = if cfg!(windows) {
        Some(std::process::id())
    } else {
        None
    };
    let result = ScreenSelection {
        id: selection.id,
        name: selection.name,
        source_type: selection.source_type,
        capture_audio: selection.capture_audio,
        include_camera: selection.include_camera,
        process_pid: selection.process_pid,
        exclude_self_pid,
        resolution: selection.resolution,
        frame_rate: selection.frame_rate,
    };
    if let Ok(mut last) = state.last_selection.lock() {
        *last = Some(result.clone());
    }
    if let Ok(mut tx) = state.picker_tx.lock() {
        if let Some(sender) = tx.take() {
            let _ = sender.send(Some(result));
        }
    }
    if let Some(picker) = app.get_webview_window("screen-picker") {
        let _ = picker.close();
    }
}

#[tauri::command]
fn picker_cancel(app: tauri::AppHandle, state: State<'_, Arc<AppState>>) {
    if let Ok(mut tx) = state.picker_tx.lock() {
        if let Some(sender) = tx.take() {
            let _ = sender.send(None);
        }
    }
    if let Some(picker) = app.get_webview_window("screen-picker") {
        let _ = picker.close();
    }
}

#[tauri::command]
async fn choose_screen_source(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<Option<ScreenSelection>, String> {
    let (tx, rx) = std::sync::mpsc::channel::<Option<ScreenSelection>>();
    {
        let mut slot = state.picker_tx.lock().map_err(|e| e.to_string())?;
        *slot = Some(tx);
    }

    if let Some(existing) = app.get_webview_window("screen-picker") {
        let _ = existing.close();
    }

    let url = asset_url("screen-picker.html")?;
    let picker = WebviewWindowBuilder::new(&app, "screen-picker", url)
        .title("Демонстрация экрана — Whithin")
        .inner_size(960.0, 720.0)
        .resizable(false)
        .minimizable(true)
        .maximizable(false)
        .decorations(false)
        .center()
        .build()
        .map_err(|e| format!("Failed to open screen picker: {e}"))?;

    // Push screens immediately so UI is never empty while HTML boots.
    let screens = screen_sources::list_screens_only();
    let _ = picker.emit(
        "screen-picker-init",
        serde_json::json!({ "sources": screens }),
    );

    // Block async command without freezing the runtime hard — poll channel.
    let selection = tauri::async_runtime::spawn_blocking(move || rx.recv().unwrap_or(None))
        .await
        .map_err(|e| e.to_string())?;

    Ok(selection)
}

/// Runs a helper mode of the executable (e.g. the music audio host) if requested on the
/// command line; returns its exit code, or `None` for a normal app start.
pub fn run_helper() -> Option<i32> {
    if std::env::args().nth(1).as_deref() == Some("--yt-net-selftest") {
        return Some(yt_net::selftest());
    }
    music_audio::run_host_from_args()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState {
        audio: AudioCaptureManager::new(),
        display: DisplayCaptureManager::new(),
        last_selection: Mutex::new(None),
        picker_tx: Mutex::new(None),
    });
    let desktop = desktop_shell::DesktopShellState::new();
    let music_service = music::MusicService::new();
    let music_for_protocol = music_service.clone();

    let mut builder = tauri::Builder::default();

    // Single-instance must be registered first so deep links go to the live process.
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(url) = desktop_parity::extract_deep_link_from_argv(&argv) {
                desktop_parity::deliver_deep_link(app, &url);
            } else {
                desktop_parity::show_main_window(app);
            }
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state.clone())
        .manage(desktop.clone())
        .manage(music_service)
        .manage(music_audio::MusicAudio::new())
        .register_uri_scheme_protocol("whithin-asset", |_ctx, request| {
            serve_embedded_asset(request)
        })
        .register_asynchronous_uri_scheme_protocol(music::SCHEME, move |_ctx, request, responder| {
            let service = music_for_protocol.clone();
            tauri::async_runtime::spawn(async move {
                responder.respond(service.serve(request).await);
            });
        })
        .invoke_handler(tauri::generate_handler![
            audio_is_platform_supported,
            audio_check_permission,
            audio_request_permission,
            audio_start_capture,
            audio_start_capture_exclude,
            audio_stop_capture,
            audio_is_capturing,
            list_screen_sources,
            get_app_pid,
            arm_screen_capture,
            seed_screen_selection,
            get_last_screen_selection,
            display_capture_start,
            display_capture_stop,
            display_capture_is_active,
            display_capture_frame_info,
            choose_screen_source,
            picker_ready,
            picker_refresh,
            picker_submit,
            picker_cancel,
            shortcuts_update,
            desktop_shell::show_desktop_notification,
            desktop_shell::desktop_notification_dismiss,
            desktop_shell::desktop_notification_dismiss_by_chat,
            desktop_shell::desktop_notification_dismiss_all,
            desktop_shell::desktop_notification_sync_settings,
            desktop_shell::desktop_notification_sync_theme,
            desktop_shell::desktop_notification_report_height,
            desktop_shell::desktop_notification_open,
            desktop_shell::desktop_notification_host_ready,
            desktop_shell::show_call_overlay,
            desktop_shell::update_call_overlay,
            desktop_shell::call_overlay_dismiss,
            desktop_shell::call_overlay_sync_theme,
            desktop_shell::call_overlay_accept,
            desktop_shell::call_overlay_decline,
            desktop_shell::call_overlay_host_ready,
            desktop_shell::show_active_call_overlay,
            desktop_shell::update_active_call_overlay,
            desktop_shell::dismiss_active_call_overlay,
            desktop_shell::sync_active_call_overlay_settings,
            desktop_shell::sync_active_call_overlay_theme,
            desktop_shell::active_call_overlay_report_size,
            desktop_shell::active_call_overlay_host_ready,
            desktop_shell::focus_main_window,
            desktop_shell::window_minimize,
            desktop_shell::window_toggle_maximize,
            desktop_shell::window_close,
            shell_client_url,
            shell_probe_client,
            shell_open_client,
            shell_show_offline,
            desktop_parity::set_badge_count,
            desktop_parity::pick_background_image,
            desktop_parity::load_background_image,
            desktop_parity::clear_background_image,
            desktop_parity::save_media_file,
            music::music_search,
            music::music_search_more,
            music::music_prepare,
            music::music_search_artists,
            music::music_artist,
            music::music_album,
            music::music_radio,
            music::music_home,
            music_audio::music_audio_load,
            music_audio::music_audio_command,
            music_library::music_auth_from_site,
            music_library::music_library_local,
            local_music::music_local_tracks,
            local_music::music_local_open,
            local_music::music_downloads,
            local_music::music_download,
            local_music::music_download_delete,
            music_library::music_library_sync,
            music_library::music_library_toggle,
            music_window::music_show,
            music_window::music_set_theme,
            music_window::music_get_theme,
            music_window::music_set_wallpaper,
            music_window::music_get_wallpaper,
        ])
        .setup(|app| {
            shortcuts::init(app.handle().clone());

            if let Ok(dir) = app.path().app_data_dir() {
                app.state::<Arc<music::MusicService>>().set_storage_dir(dir.join("music"));
            }
            music_library::start_keepalive(app.state::<Arc<music::MusicService>>().inner().clone());

            let desktop_state = app.state::<desktop_shell::DesktopShellState>().inner().clone();
            if let Err(err) = desktop_shell::setup_tray(app.handle(), &desktop_state) {
                eprintln!("[whithin-tauri] tray setup failed: {err}");
            }

            // Deep links: register schemes (Windows) + forward open-url to renderer.
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                #[cfg(any(windows, target_os = "linux"))]
                {
                    if let Err(err) = app.deep_link().register_all() {
                        eprintln!("[whithin-tauri] deep-link register_all failed: {err}");
                    }
                }
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        desktop_parity::deliver_deep_link(&handle, &url.to_string());
                    }
                });
                if let Ok(Some(urls)) = app.deep_link().get_current() {
                    let handle = app.handle().clone();
                    for url in urls {
                        let handle = handle.clone();
                        let url = url.to_string();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(1200));
                            desktop_parity::deliver_deep_link(&handle, &url);
                        });
                    }
                }
            }

            let bridge = include_str!("../assets/bridge.js");
            let titlebar_player = String::from_utf8_lossy(&load_asset_html("titlebar-player.js")).into_owned();
            // Local shell first: titlebar + offline UI always available without the remote site.
            let shell = asset_url("shell.html")?;

            if app.get_window("main").is_none() {
                let main = WebviewWindowBuilder::new(app, "main", shell)
                    .title("Whithin")
                    .inner_size(1280.0, 800.0)
                    .min_inner_size(900.0, 600.0)
                    .resizable(true)
                    .maximizable(true)
                    .minimizable(true)
                    .decorations(false)
                    .background_color(tauri::window::Color(0x1e, 0x1f, 0x22, 0xff))
                    .initialization_script(bridge)
                    .initialization_script(titlebar_player)
                    .build()?;

                // So F-keys reach the page when Whithin is focused (WebView2 won't eat them).
                // Global shortcuts are still passive OS-wide and never consume the key.
                // Retry once: CoreWebView2 is sometimes not ready on the first tick after build().
                configure_main_webview(&main);
                let main_retry = main.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(400));
                    configure_main_webview(&main_retry);
                });
            }

            Ok(())
        })
        .on_window_event(move |window, event| {
            let label = window.label().to_string();
            if label == "main" {
                if matches!(
                    event,
                    tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
                ) {
                    music_window::relayout(window.app_handle());
                }
                if let Some(desktop_state) = window.try_state::<desktop_shell::DesktopShellState>() {
                    desktop_shell::handle_main_window_event(
                        window.app_handle(),
                        desktop_state.inner(),
                        event,
                    );
                }
            }
            if label == "screen-picker"
                && matches!(
                    event,
                    tauri::WindowEvent::Destroyed | tauri::WindowEvent::CloseRequested { .. }
                )
            {
                if let Some(app_state) = window.try_state::<Arc<AppState>>() {
                    if let Ok(mut tx) = app_state.picker_tx.lock() {
                        if let Some(sender) = tx.take() {
                            let _ = sender.send(None);
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Whithin (Tauri)");
}

#[cfg(windows)]
fn configure_main_webview(window: &tauri::WebviewWindow) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static NAV_FALLBACK_WIRED: AtomicBool = AtomicBool::new(false);

    let app = window.app_handle().clone();
    if let Err(err) = window.with_webview(move |webview| {
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
            use webview2_com::{take_pwstr, NavigationCompletedEventHandler};
            use windows::core::Interface;

            let Ok(core) = webview.controller().CoreWebView2() else {
                eprintln!("[whithin-tauri] CoreWebView2 unavailable while configuring main");
                return;
            };

            if let Ok(settings) = core.Settings() {
                if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
                    let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
                }
            }

            if NAV_FALLBACK_WIRED.swap(true, Ordering::SeqCst) {
                return;
            }

            let mut token = 0i64;
            let handler = NavigationCompletedEventHandler::create(Box::new(move |sender, args| {
                let Some(args) = args else {
                    return Ok(());
                };
                let mut ok = windows::core::BOOL(0);
                args.IsSuccess(&mut ok)?;
                if ok.as_bool() {
                    return Ok(());
                }

                let uri = match sender.as_ref() {
                    Some(wv) => {
                        let mut source = windows::core::PWSTR::null();
                        if wv.Source(&mut source).is_ok() {
                            take_pwstr(source)
                        } else {
                            String::new()
                        }
                    }
                    None => String::new(),
                };

                // Already on shell / asset host — don't loop.
                if uri.contains("shell.html") || uri.contains("whithin-asset") {
                    return Ok(());
                }

                eprintln!("[whithin-tauri] client navigation failed ({uri}) → offline shell");
                let app_for_nav = app.clone();
                // Navigate on the UI thread — raw background navigate is unreliable on WebView2.
                let _ = app.run_on_main_thread(move || {
                    let _ = navigate_main_to_shell(&app_for_nav, true);
                });

                Ok(())
            }));

            if let Err(err) = core.add_NavigationCompleted(&handler, &mut token) {
                NAV_FALLBACK_WIRED.store(false, Ordering::SeqCst);
                eprintln!("[whithin-tauri] add_NavigationCompleted failed: {err:?}");
            }
            let _ = token;
        }
    }) {
        eprintln!("[whithin-tauri] configure_main_webview failed: {err}");
    }
}

#[cfg(not(windows))]
fn configure_main_webview(_window: &tauri::WebviewWindow) {}
