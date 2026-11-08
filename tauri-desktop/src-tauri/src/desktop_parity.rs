//! Electron parity: deep links delivery helpers, taskbar badge, wallpaper FS, save-media.
//! Deep-link / single-instance plugins are wired in `lib.rs`.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::Value;
use tauri::image::Image;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;

const MAX_WALLPAPER_BYTES: u64 = 12 * 1024 * 1024;

fn is_deep_link_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.starts_with("whithin://") || lower.starts_with("within://")
}

pub fn extract_deep_link_from_argv(argv: &[String]) -> Option<String> {
    argv.iter()
        .find(|arg| is_deep_link_url(arg))
        .cloned()
}

pub fn deliver_deep_link<R: Runtime>(app: &AppHandle<R>, url: &str) {
    if !is_deep_link_url(url) {
        return;
    }
    show_main_window(app);
    let _ = app.emit("deep-link-received", url);
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("deep-link-received", url);
    }
    eprintln!("[whithin-tauri] deep link delivered: {url}");
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
    }
}

fn wallpaper_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("wallpapers");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    }
}

fn read_wallpaper_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    Ok(format!(
        "data:{};base64,{}",
        mime_from_ext(ext),
        B64.encode(bytes)
    ))
}

fn is_wallpaper_path_allowed(app: &AppHandle, file_path: &str) -> bool {
    let Ok(root) = wallpaper_dir(app) else {
        return false;
    };
    let candidate = PathBuf::from(file_path);
    let Ok(canon_root) = fs::canonicalize(&root) else {
        return false;
    };
    let Ok(canon_file) = fs::canonicalize(&candidate) else {
        return false;
    };
    canon_file.starts_with(canon_root)
}

fn sanitize_download_file_name(file_name: &str) -> String {
    let cleaned: String = file_name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim();
    let base = Path::new(if trimmed.is_empty() {
        "download"
    } else {
        trimmed
    })
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or("download");
    if base.is_empty() {
        "download".into()
    } else {
        base.into()
    }
}

fn stream_http_url_to_file(url: &str, file_path: &Path, headers: &Value) -> Result<(), String> {
    let mut request = ureq::get(url);
    if let Some(obj) = headers.as_object() {
        for (key, value) in obj {
            if let Some(s) = value.as_str() {
                request = request.set(key, s);
            }
        }
    }
    let response = request.call().map_err(|e| e.to_string())?;
    if !(200..300).contains(&response.status()) {
        return Err(format!("Download failed with status {}", response.status()));
    }
    let mut reader = response.into_reader();
    let mut file = fs::File::create(file_path).map_err(|e| e.to_string())?;
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn make_badge_rgba(count: u32) -> (Vec<u8>, u32, u32) {
    let size = 16u32;
    let label = if count > 99 {
        "99+".to_string()
    } else {
        count.to_string()
    };
    let mut rgba = vec![0u8; (size * size * 4) as usize];
    let cx = 7.5f32;
    let cy = 7.5f32;
    let r = 7.2f32;
    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let i = ((y * size + x) * 4) as usize;
            if dist <= r {
                // Discord-like red badge
                rgba[i] = 0xed;
                rgba[i + 1] = 0x42;
                rgba[i + 2] = 0x45;
                rgba[i + 3] = 0xff;
            }
        }
    }
    // Tiny 3x5 digit stamps (white) — enough for 1–2 digits / "99+"
    let glyphs: &[(&str, &[(u8, u8)])] = &[
        ("0", &[(1,0),(2,0),(0,1),(3,1),(0,2),(3,2),(0,3),(3,3),(1,4),(2,4)]),
        ("1", &[(2,0),(1,1),(2,1),(2,2),(2,3),(1,4),(2,4),(3,4)]),
        ("2", &[(1,0),(2,0),(0,1),(3,1),(2,2),(1,3),(0,4),(1,4),(2,4),(3,4)]),
        ("3", &[(0,0),(1,0),(2,0),(3,1),(1,2),(2,2),(3,3),(0,4),(1,4),(2,4)]),
        ("4", &[(0,0),(3,0),(0,1),(3,1),(0,2),(1,2),(2,2),(3,2),(3,3),(3,4)]),
        ("5", &[(0,0),(1,0),(2,0),(3,0),(0,1),(0,2),(1,2),(2,2),(3,3),(0,4),(1,4),(2,4)]),
        ("6", &[(1,0),(2,0),(0,1),(0,2),(1,2),(2,2),(0,3),(3,3),(1,4),(2,4)]),
        ("7", &[(0,0),(1,0),(2,0),(3,0),(3,1),(2,2),(1,3),(1,4)]),
        ("8", &[(1,0),(2,0),(0,1),(3,1),(1,2),(2,2),(0,3),(3,3),(1,4),(2,4)]),
        ("9", &[(1,0),(2,0),(0,1),(3,1),(1,2),(2,2),(3,2),(3,3),(1,4),(2,4)]),
        ("+", &[(1,1),(0,2),(1,2),(2,2),(1,3)]),
    ];
    let glyph_map: std::collections::HashMap<&str, &[(u8, u8)]> =
        glyphs.iter().copied().collect();

    let chars: Vec<char> = label.chars().collect();
    let total_w = chars.len() as i32 * 4 - 1;
    let start_x = ((size as i32 - total_w) / 2).max(1);
    let start_y = 5i32;
    for (idx, ch) in chars.iter().enumerate() {
        let key = ch.to_string();
        let Some(pixels) = glyph_map.get(key.as_str()) else {
            continue;
        };
        let ox = start_x + idx as i32 * 4;
        for &(px, py) in *pixels {
            let x = ox + px as i32;
            let y = start_y + py as i32;
            if x >= 0 && y >= 0 && (x as u32) < size && (y as u32) < size {
                let i = ((y as u32 * size + x as u32) * 4) as usize;
                rgba[i] = 255;
                rgba[i + 1] = 255;
                rgba[i + 2] = 255;
                rgba[i + 3] = 255;
            }
        }
    }
    (rgba, size, size)
}

#[tauri::command]
pub fn set_badge_count(app: AppHandle, count: i64) -> Result<(), String> {
    let normalized = if count > 0 {
        (count as u32).min(9999)
    } else {
        0
    };

    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };

    #[cfg(windows)]
    {
        if normalized > 0 {
            let (rgba, w, h) = make_badge_rgba(normalized);
            let image = Image::new_owned(rgba, w, h);
            main.set_overlay_icon(Some(image))
                .map_err(|e| e.to_string())?;
        } else {
            main.set_overlay_icon(None::<Image>).map_err(|e| e.to_string())?;
        }
    }

    #[cfg(not(windows))]
    {
        let _ = (main, normalized);
    }

    Ok(())
}

#[tauri::command]
pub async fn pick_background_image(app: AppHandle) -> Result<Option<Value>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Images", &["jpg", "jpeg", "png", "webp", "gif"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        return Ok(None);
    };
    let source = file_path
        .into_path()
        .map_err(|e| format!("Unsupported file path: {e}"))?;

    let meta = fs::metadata(&source).map_err(|e| e.to_string())?;
    if meta.len() > MAX_WALLPAPER_BYTES {
        return Err("Изображение слишком большое (максимум 12 МБ)".into());
    }

    let dir = wallpaper_dir(&app)?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{e}"))
        .unwrap_or_else(|| ".jpg".into());
    let dest = dir.join(format!("wallpaper{ext}"));
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    let data_url = read_wallpaper_data_url(&dest)?;
    Ok(Some(serde_json::json!({
        "filePath": dest.to_string_lossy(),
        "dataUrl": data_url,
    })))
}

#[tauri::command]
pub fn load_background_image(app: AppHandle, file_path: String) -> Result<Option<Value>, String> {
    if !is_wallpaper_path_allowed(&app, &file_path) || !Path::new(&file_path).exists() {
        return Ok(None);
    }
    let data_url = read_wallpaper_data_url(Path::new(&file_path))?;
    Ok(Some(serde_json::json!({
        "filePath": file_path,
        "dataUrl": data_url,
    })))
}

#[tauri::command]
pub fn clear_background_image(app: AppHandle) -> Result<bool, String> {
    let dir = wallpaper_dir(&app)?;
    if !dir.exists() {
        return Ok(true);
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with("wallpaper.") {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(true)
}

#[tauri::command]
pub async fn save_media_file(app: AppHandle, payload: Value) -> Result<Value, String> {
    let file_name = sanitize_download_file_name(
        payload
            .get("fileName")
            .and_then(|v| v.as_str())
            .unwrap_or("download"),
    );
    let primary_url = payload
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let fallback_url = payload
        .get("fallbackUrl")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let headers = payload
        .get("headers")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));

    if primary_url.is_empty() && fallback_url.is_empty() {
        return Err("Invalid file URL".into());
    }

    let picked = app
        .dialog()
        .file()
        .set_file_name(&file_name)
        .blocking_save_file();

    let Some(file_path) = picked else {
        return Ok(serde_json::json!({ "canceled": true }));
    };
    let target = file_path
        .into_path()
        .map_err(|e| format!("Unsupported save path: {e}"))?;

    let urls = [primary_url, fallback_url]
        .into_iter()
        .filter(|u| !u.is_empty())
        .collect::<Vec<_>>();

    let mut last_error = None;
    for url in urls {
        match stream_http_url_to_file(&url, &target, &headers) {
            Ok(()) => {
                return Ok(serde_json::json!({
                    "canceled": false,
                    "filePath": target.to_string_lossy(),
                }));
            }
            Err(err) => {
                last_error = Some(err);
                let _ = fs::remove_file(&target);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Download failed".into()))
}
