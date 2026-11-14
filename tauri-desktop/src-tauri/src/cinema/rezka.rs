//! HDRezka through a hidden browser window: its mirrors sit behind an Anubis proof-of-work page that a real
//! WebView2 passes on its own, and requests then carry the site's cookies like any visitor's. The window
//! loads only the remote site and gets no capability, so the site can't call into the app.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

pub const LABEL: &str = "rezka-bridge";
pub const MIRROR: &str = "https://rezka.ag/";
const BRIDGE_JS: &str = include_str!("../../assets/rezka-bridge.js");
const READY_TIMEOUT: Duration = Duration::from_secs(45);
/// If the check page is still up after this, the window is shown so the user can see what's going on.
const SHOW_AFTER: Duration = Duration::from_secs(15);
const JOB_TIMEOUT: Duration = Duration::from_secs(40);
const OPS: &[&str] = &["list", "search", "post", "episodes", "stream"];

static NEXT_JOB: AtomicU64 = AtomicU64::new(1);
static READY_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(win) = app.get_webview_window(LABEL) {
        return Ok(win);
    }
    let url = MIRROR.parse().map_err(|e| format!("bad mirror url: {e}"))?;
    let win = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::External(url))
        .title("HDRezka — Whithin")
        .inner_size(1100.0, 760.0)
        .visible(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Не удалось открыть HDRezka: {e}"))?;
    // Closing only hides it: the session (cookies, passed check) stays alive for the player.
    let handle = win.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = handle.hide();
            let _ = handle.set_skip_taskbar(true);
        }
    });
    Ok(win)
}

async fn eval(win: &WebviewWindow, js: String) -> Result<serde_json::Value, String> {
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Mutex::new(Some(tx));
    win.eval_with_callback(js, move |result| {
        if let Some(tx) = tx.lock().ok().and_then(|mut g| g.take()) {
            let _ = tx.send(result);
        }
    })
    .map_err(|e| e.to_string())?;
    let raw = tokio::time::timeout(Duration::from_secs(10), rx)
        .await
        .map_err(|_| "HDRezka не отвечает".to_string())?
        .map_err(|_| "HDRezka: окно закрыто".to_string())?;
    Ok(serde_json::from_str(&raw).unwrap_or(serde_json::Value::Null))
}

/// Waits until the site itself (not the bot check) is loaded in the window.
async fn wait_ready(win: &WebviewWindow) -> Result<(), String> {
    let _guard = READY_LOCK.lock().await;
    let started = Instant::now();
    let mut shown = false;
    loop {
        let ready = eval(
            win,
            "document.readyState === 'complete' && !document.getElementById('anubis_challenge') && /^https?:$/.test(location.protocol)".into(),
        )
        .await
        .unwrap_or(serde_json::Value::Null);
        if ready == serde_json::Value::Bool(true) {
            if shown {
                let _ = win.hide();
            }
            return Ok(());
        }
        let elapsed = started.elapsed();
        if !shown && elapsed > SHOW_AFTER {
            shown = true;
            let _ = win.set_skip_taskbar(false);
            let _ = win.show();
        }
        if elapsed > READY_TIMEOUT {
            return Err("HDRezka не прошла проверку «не бот». Откройте окно HDRezka и дождитесь загрузки сайта".into());
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
}

async fn run_once(win: &WebviewWindow, op: &str, args: &serde_json::Value) -> Result<serde_json::Value, String> {
    let id = format!("j{}", NEXT_JOB.fetch_add(1, Ordering::Relaxed));
    let start = format!(
        "{BRIDGE_JS}\n;window.__wz.start({}, {}, {})",
        serde_json::to_string(&id).unwrap_or_default(),
        serde_json::to_string(op).unwrap_or_default(),
        args
    );
    eval(win, start).await?;
    let take = format!("window.__wz ? window.__wz.take({}) : {{ lost: true }}", serde_json::to_string(&id).unwrap_or_default());
    let started = Instant::now();
    loop {
        tokio::time::sleep(Duration::from_millis(120)).await;
        let result = eval(win, take.clone()).await?;
        if result.is_null() {
            if started.elapsed() > JOB_TIMEOUT {
                return Err("HDRezka слишком долго отвечает".into());
            }
            continue;
        }
        if result.get("lost").is_some() {
            return Err("challenge:".into());
        }
        if result.get("ok").and_then(|v| v.as_bool()) == Some(true) {
            return Ok(result.get("v").cloned().unwrap_or(serde_json::Value::Null));
        }
        return Err(result.get("e").and_then(|v| v.as_str()).unwrap_or("HDRezka: ошибка").to_string());
    }
}

#[tauri::command]
pub async fn cinema_rezka(app: AppHandle, op: String, args: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    if !OPS.contains(&op.as_str()) {
        return Err(format!("unsupported op {op}"));
    }
    let args = args.unwrap_or_else(|| serde_json::json!({}));
    let win = window(&app)?;
    let mut attempts = 0;
    loop {
        wait_ready(&win).await?;
        match run_once(&win, &op, &args).await {
            // The check page came back (cookie expired): let the window pass it on that URL, then retry.
            Err(e) if e.starts_with("challenge:") && attempts < 2 => {
                attempts += 1;
                let target = e.trim_start_matches("challenge:");
                if let Ok(url) = target.parse::<url::Url>() {
                    let _ = win.navigate(url);
                }
                tokio::time::sleep(Duration::from_millis(800)).await;
            }
            other => return other,
        }
    }
}

/// Shows the HDRezka window so the user can sign in on the site itself (lifts region limits on some titles).
#[tauri::command]
pub fn cinema_rezka_account(app: AppHandle) -> Result<(), String> {
    let win = window(&app)?;
    let _ = win.set_skip_taskbar(false);
    win.show().map_err(|e| e.to_string())?;
    let _ = win.set_focus();
    Ok(())
}
