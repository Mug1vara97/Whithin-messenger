use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

const FIRST_CHECK_DELAY: Duration = Duration::from_secs(20);
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

static BUSY: AtomicBool = AtomicBool::new(false);

/// Background checks: shortly after launch, then every few hours while the app keeps running in the tray.
pub fn spawn_periodic_check(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_CHECK_DELAY).await;
        loop {
            check(&app, false).await;
            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

/// Tray-triggered check that also reports "up to date" and errors.
pub fn check_now(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move { check(&app, true).await });
}

async fn check(app: &AppHandle, manual: bool) {
    if BUSY.swap(true, Ordering::SeqCst) {
        return;
    }
    let result = run(app, manual).await;
    BUSY.store(false, Ordering::SeqCst);
    if let Err(err) = result {
        eprintln!("[updater] {err}");
        if manual {
            notify(app, "Не удалось проверить обновления", &err, MessageDialogKind::Error);
        }
    }
}

async fn run(app: &AppHandle, manual: bool) -> Result<(), String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let Some(update) = update else {
        if manual {
            let text = format!("Установлена последняя версия Whithin ({}).", app.package_info().version);
            notify(app, "Обновлений нет", &text, MessageDialogKind::Info);
        }
        return Ok(());
    };

    let text = format!(
        "Доступна новая версия Whithin {}.\nСейчас установлена {}.\n\nУстановить обновление? Приложение перезапустится.",
        update.version,
        app.package_info().version
    );
    if !confirm(app, "Обновление Whithin", &text).await {
        return Ok(());
    }

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

async fn confirm(app: &AppHandle, title: &str, text: &str) -> bool {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .message(text)
        .title(title)
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom("Обновить".into(), "Позже".into()))
        .show(move |accepted| {
            let _ = tx.send(accepted);
        });
    rx.await.unwrap_or(false)
}

fn notify(app: &AppHandle, title: &str, text: &str, kind: MessageDialogKind) {
    app.dialog().message(text).title(title).kind(kind).show(|_| {});
}
