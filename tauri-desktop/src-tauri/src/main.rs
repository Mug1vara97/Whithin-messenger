// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = whithin_tauri_lib::run_helper() {
        std::process::exit(code);
    }
    whithin_tauri_lib::run();
}
