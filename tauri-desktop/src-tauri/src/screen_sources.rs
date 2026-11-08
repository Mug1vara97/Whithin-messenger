use base64::{engine::general_purpose::STANDARD as B64, Engine};
use image::codecs::jpeg::JpegEncoder;
use image::{imageops, ColorType, RgbaImage};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenSourceDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub thumbnail: Option<String>,
    pub app_icon: Option<String>,
    pub can_share_audio: bool,
    pub process_pid: Option<u32>,
}

/// Screens only — must be fast and never empty.
pub fn list_screens_only() -> Vec<ScreenSourceDto> {
    let mut sources = Vec::new();

    match xcap::Monitor::all() {
        Ok(monitors) => {
            eprintln!("[screen-sources] Monitor::all -> {}", monitors.len());
            for (index, monitor) in monitors.into_iter().enumerate() {
                let name = monitor
                    .name()
                    .ok()
                    .filter(|n| !n.trim().is_empty())
                    .unwrap_or_else(|| format!("Экран {}", index + 1));
                let id = format!(
                    "screen:{}:{}",
                    monitor.id().unwrap_or(index as u32),
                    index
                );
                sources.push(ScreenSourceDto {
                    id,
                    name,
                    source_type: "screen".into(),
                    thumbnail: None,
                    app_icon: None,
                    can_share_audio: true,
                    process_pid: None,
                });
            }
        }
        Err(err) => eprintln!("[screen-sources] Monitor::all failed: {err}"),
    }

    if sources.is_empty() {
        eprintln!("[screen-sources] using Win32 monitor fallback");
        sources.extend(list_monitors_win32_fallback());
    }

    if sources.is_empty() {
        sources.push(ScreenSourceDto {
            id: "screen:primary:0".into(),
            name: "Экран 1".into(),
            source_type: "screen".into(),
            thumbnail: None,
            app_icon: None,
            can_share_audio: true,
            process_pid: None,
        });
    }

    sources
}

/// Windows/apps only (can be slow on some PCs).
pub fn list_windows_only() -> Vec<ScreenSourceDto> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(list_windows_only_inner)) {
        Ok(sources) => sources,
        Err(_) => {
            eprintln!("[screen-sources] Window::all panicked — skipping windows");
            Vec::new()
        }
    }
}

fn list_windows_only_inner() -> Vec<ScreenSourceDto> {
    let mut sources = Vec::new();
    let self_pid = std::process::id();

    match xcap::Window::all() {
        Ok(windows) => {
            eprintln!(
                "[screen-sources] Window::all -> {} candidates",
                windows.len()
            );
            for window in windows {
                let title = window.title().unwrap_or_default();
                let app_name = window.app_name().unwrap_or_default();
                let title_trim = title.trim();
                let app_trim = app_name.trim();
                if title_trim.is_empty() && app_trim.is_empty() {
                    continue;
                }
                let width = window.width().unwrap_or(0);
                let height = window.height().unwrap_or(0);
                if width < 8 || height < 8 {
                    continue;
                }
                let pid = window.pid().ok();
                if pid == Some(self_pid) {
                    continue;
                }

                let name = if app_trim.is_empty() {
                    title_trim.to_string()
                } else if title_trim.is_empty() {
                    app_trim.to_string()
                } else if title_trim.contains(app_trim) {
                    title_trim.to_string()
                } else {
                    format!("{app_trim} — {title_trim}")
                };

                let hwnd = window.id().unwrap_or(0);
                let pid_value = pid.unwrap_or(0);
                let lower = name.to_lowercase();
                let is_self = lower.contains("whithin") || lower.contains("tauri");

                sources.push(ScreenSourceDto {
                    id: format!("window:{hwnd}:{pid_value}"),
                    name,
                    source_type: "window".into(),
                    thumbnail: None,
                    app_icon: None,
                    can_share_audio: !is_self,
                    process_pid: pid.filter(|&p| p > 0),
                });
            }
        }
        Err(err) => eprintln!("[screen-sources] Window::all failed: {err}"),
    }

    sources
}

pub fn list_screen_sources() -> Result<Vec<ScreenSourceDto>, String> {
    let mut sources = list_screens_only();

    // Best-effort screen thumbnails (never drop a screen if capture fails).
    for source in sources.iter_mut().filter(|s| s.source_type == "screen") {
        if let Some(index_str) = source.id.split(':').nth(2) {
            let index: usize = index_str.parse().unwrap_or(0);
            if let Ok(monitors) = xcap::Monitor::all() {
                if let Some(monitor) = monitors.get(index) {
                    source.thumbnail = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        monitor
                            .capture_image()
                            .ok()
                            .and_then(|img| rgba_to_jpeg_data_url(&img, 420))
                    }))
                    .ok()
                    .flatten();
                }
            }
        }
    }

    let mut windows = list_windows_only();
    let mut thumb_budget = 24usize;
    // Re-query for capture — list_windows_only doesn't keep handles.
    if let Ok(raw) = xcap::Window::all() {
        let self_pid = std::process::id();
        for window in raw {
            if thumb_budget == 0 {
                break;
            }
            let pid = window.pid().ok();
            if pid == Some(self_pid) {
                continue;
            }
            let hwnd = window.id().unwrap_or(0);
            let pid_value = pid.unwrap_or(0);
            let id = format!("window:{hwnd}:{pid_value}");
            if let Some(slot) = windows.iter_mut().find(|w| w.id == id) {
                let shot = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    window
                        .capture_image()
                        .ok()
                        .and_then(|img| rgba_to_jpeg_data_url(&img, 320))
                }))
                .ok()
                .flatten();
                if shot.is_some() {
                    thumb_budget = thumb_budget.saturating_sub(1);
                    slot.thumbnail = shot;
                }
            }
        }
    }

    sources.extend(windows);
    Ok(sources)
}

#[cfg(windows)]
fn list_monitors_win32_fallback() -> Vec<ScreenSourceDto> {
    use std::mem;
    use windows::core::BOOL;
    use windows::Win32::Foundation::{LPARAM, RECT};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW,
    };
    use windows::Win32::UI::WindowsAndMessaging::MONITORINFOF_PRIMARY;

    struct State {
        monitors: Vec<(isize, bool, String)>,
    }

    unsafe extern "system" fn enum_proc(
        h_monitor: HMONITOR,
        _: HDC,
        _: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let state = &mut *(lparam.0 as *mut State);
        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = mem::size_of::<MONITORINFOEXW>() as u32;
        let ok = GetMonitorInfoW(h_monitor, &mut info as *mut _ as *mut MONITORINFO);
        if ok.as_bool() {
            let is_primary = (info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY) != 0;
            let name_raw = String::from_utf16_lossy(
                &info
                    .szDevice
                    .iter()
                    .copied()
                    .take_while(|&c| c != 0)
                    .collect::<Vec<_>>(),
            );
            state
                .monitors
                .push((h_monitor.0 as isize, is_primary, name_raw));
        }
        BOOL(1)
    }

    let mut state = State {
        monitors: Vec::new(),
    };
    unsafe {
        let _ = EnumDisplayMonitors(
            None,
            None,
            Some(enum_proc),
            LPARAM(&mut state as *mut State as isize),
        );
    }

    if state.monitors.is_empty() {
        return Vec::new();
    }

    state.monitors.sort_by_key(|(_, primary, _)| !primary);

    state
        .monitors
        .into_iter()
        .enumerate()
        .map(|(index, (handle, is_primary, device))| {
            let name = if is_primary {
                format!("Экран {} (основной)", index + 1)
            } else if device.trim().is_empty() {
                format!("Экран {}", index + 1)
            } else {
                format!("Экран {} — {}", index + 1, device.trim())
            };
            ScreenSourceDto {
                id: format!("screen:{handle}:{index}"),
                name,
                source_type: "screen".into(),
                thumbnail: None,
                app_icon: None,
                can_share_audio: true,
                process_pid: None,
            }
        })
        .collect()
}

#[cfg(not(windows))]
fn list_monitors_win32_fallback() -> Vec<ScreenSourceDto> {
    Vec::new()
}

fn rgba_to_jpeg_data_url(img: &RgbaImage, max_width: u32) -> Option<String> {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 {
        return None;
    }

    let resized = if w > max_width {
        let new_h = ((h as f32) * (max_width as f32) / (w as f32)).round().max(1.0) as u32;
        imageops::resize(img, max_width, new_h, imageops::FilterType::Triangle)
    } else {
        img.clone()
    };

    let rgb = image::DynamicImage::ImageRgba8(resized).to_rgb8();
    let mut buf = Vec::new();
    {
        let mut encoder = JpegEncoder::new_with_quality(&mut buf, 55);
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                ColorType::Rgb8.into(),
            )
            .ok()?;
    }
    Some(format!("data:image/jpeg;base64,{}", B64.encode(buf)))
}
