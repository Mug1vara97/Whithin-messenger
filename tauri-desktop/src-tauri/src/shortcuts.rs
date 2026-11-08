//! Passiveive global keyboard + mouse shortcuts (Windows).
//!
//! Listens system-wide and notifies the UI, but ALWAYS passes the input through
//! to the focused app (game, browser, etc.). Unlike Electron `globalShortcut`,
//! this does not steal / block the key or mouse button.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};

use serde::Deserialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MouseButton {
    Left,
    Middle,
    Right,
    Back,    // Mouse4 / XBUTTON1
    Forward, // Mouse5 / XBUTTON2
}

#[derive(Debug, Clone)]
enum BindingTarget {
    Key { vk: u32 },
    Mouse { button: MouseButton },
}

#[derive(Debug, Clone)]
struct Binding {
    action: String,
    target: BindingTarget,
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
}

static APP: OnceLock<AppHandle> = OnceLock::new();
static BINDINGS: OnceLock<Mutex<Vec<Binding>>> = OnceLock::new();
static HOOK_STARTED: AtomicBool = AtomicBool::new(false);
static LAST_ACTION: Mutex<Option<(String, u128)>> = Mutex::new(None);

fn bindings() -> &'static Mutex<Vec<Binding>> {
    BINDINGS.get_or_init(|| Mutex::new(Vec::new()))
}

pub fn init(app: AppHandle) {
    let _ = APP.set(app);
    #[cfg(windows)]
    start_windows_hooks();
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutsUpdate {
    /// Map of action -> accelerator string (same format as the web client: "F1", "Ctrl+M", "Mouse4").
    pub shortcuts: HashMap<String, String>,
}

pub fn update_shortcuts(payload: ShortcutsUpdate) {
    let mut next = Vec::new();
    for (action, accel) in payload.shortcuts {
        if let Some(binding) = parse_accelerator(&action, &accel) {
            next.push(binding);
        }
    }
    if let Ok(mut guard) = bindings().lock() {
        *guard = next;
        eprintln!(
            "[shortcuts] passive bindings updated: {}",
            guard
                .iter()
                .map(|b| match &b.target {
                    BindingTarget::Key { vk } => format!("{}=vk:{vk}", b.action),
                    BindingTarget::Mouse { button } => {
                        format!("{}=mouse:{button:?}", b.action)
                    }
                })
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
}

fn parse_accelerator(action: &str, accel: &str) -> Option<Binding> {
    let parts: Vec<&str> = accel
        .split('+')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .collect();
    if parts.is_empty() {
        return None;
    }

    let mut ctrl = false;
    let mut alt = false;
    let mut shift = false;
    let mut meta = false;
    let mut key: Option<&str> = None;
    let mut mouse: Option<MouseButton> = None;

    for part in parts {
        match part.to_ascii_lowercase().as_str() {
            "ctrl" | "control" => ctrl = true,
            "alt" | "altgraph" => alt = true,
            "shift" => shift = true,
            "cmd" | "meta" | "command" | "super" | "win" => meta = true,
            "mouse4" | "xbutton1" | "back" => mouse = Some(MouseButton::Back),
            "mouse5" | "xbutton2" | "forward" => mouse = Some(MouseButton::Forward),
            "leftclick" | "left" if mouse.is_none() && key.is_none() => {
                // Only treat as mouse when it's clearly a mouse binding token.
                if part.eq_ignore_ascii_case("leftclick") {
                    mouse = Some(MouseButton::Left);
                } else {
                    key = Some(part);
                }
            }
            "middleclick" | "middle" => mouse = Some(MouseButton::Middle),
            "rightclick" => mouse = Some(MouseButton::Right),
            other => {
                let _ = other;
                key = Some(part);
            }
        }
    }

    let target = if let Some(button) = mouse {
        BindingTarget::Mouse { button }
    } else {
        let key = key?;
        let vk = web_key_to_vk(key)?;
        BindingTarget::Key { vk }
    };

    Some(Binding {
        action: action.to_string(),
        target,
        ctrl,
        alt,
        shift,
        meta,
    })
}

fn web_key_to_vk(key: &str) -> Option<u32> {
    if key.len() == 1 {
        let ch = key.chars().next()?.to_ascii_uppercase();
        if ch.is_ascii_alphanumeric() {
            return Some(ch as u32);
        }
    }
    match key {
        "F1" => Some(0x70),
        "F2" => Some(0x71),
        "F3" => Some(0x72),
        "F4" => Some(0x73),
        "F5" => Some(0x74),
        "F6" => Some(0x75),
        "F7" => Some(0x76),
        "F8" => Some(0x77),
        "F9" => Some(0x78),
        "F10" => Some(0x79),
        "F11" => Some(0x7A),
        "F12" => Some(0x7B),
        "Escape" | "Esc" => Some(0x1B),
        "Enter" | "Return" => Some(0x0D),
        "Tab" => Some(0x09),
        " " | "Space" | "Spacebar" => Some(0x20),
        "Backspace" => Some(0x08),
        "Delete" | "Del" => Some(0x2E),
        "Insert" | "Ins" => Some(0x2D),
        "Home" => Some(0x24),
        "End" => Some(0x23),
        "PageUp" | "PgUp" => Some(0x21),
        "PageDown" | "PgDn" => Some(0x22),
        "ArrowUp" | "Up" => Some(0x26),
        "ArrowDown" | "Down" => Some(0x28),
        "ArrowLeft" | "Left" => Some(0x25),
        "ArrowRight" | "Right" => Some(0x27),
        _ => {
            if let Some(num) = key
                .strip_prefix('F')
                .or_else(|| key.strip_prefix('f'))
                .and_then(|n| n.parse::<u32>().ok())
            {
                if (1..=24).contains(&num) {
                    return Some(0x6F + num);
                }
            }
            None
        }
    }
}

fn dispatch_action(action: &str) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    if let Ok(mut last) = LAST_ACTION.lock() {
        if let Some((prev, at)) = last.as_ref() {
            if prev == action && now.saturating_sub(*at) < 160 {
                return;
            }
        }
        *last = Some((action.to_string(), now));
    }

    let Some(app) = APP.get() else {
        return;
    };
    let _ = app.emit("whithin-global-shortcut", action);
}

#[cfg(windows)]
fn read_modifier_state() -> (bool, bool, bool, bool) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
    };

    let ctrl = unsafe { GetAsyncKeyState(VK_CONTROL.0 as i32) } < 0;
    let alt = unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } < 0;
    let shift = unsafe { GetAsyncKeyState(VK_SHIFT.0 as i32) } < 0;
    let meta = unsafe {
        GetAsyncKeyState(VK_LWIN.0 as i32) < 0 || GetAsyncKeyState(VK_RWIN.0 as i32) < 0
    };
    (ctrl, alt, shift, meta)
}

#[cfg(windows)]
fn maybe_match_key(vk: u32) {
    // Skip pure modifiers.
    if matches!(vk, 0xA0 | 0xA1 | 0xA2 | 0xA3 | 0xA4 | 0xA5 | 0x5B | 0x5C) {
        return;
    }

    let (ctrl, alt, shift, meta) = read_modifier_state();
    let Ok(guard) = bindings().lock() else {
        return;
    };
    for binding in guard.iter() {
        let BindingTarget::Key { vk: bind_vk } = binding.target else {
            continue;
        };
        if bind_vk != vk {
            continue;
        }
        if binding.ctrl != ctrl || binding.alt != alt || binding.shift != shift || binding.meta != meta
        {
            continue;
        }
        let action = binding.action.clone();
        drop(guard);
        dispatch_action(&action);
        return;
    }
}

#[cfg(windows)]
fn maybe_match_mouse(button: MouseButton) {
    let (ctrl, alt, shift, meta) = read_modifier_state();
    let Ok(guard) = bindings().lock() else {
        return;
    };
    for binding in guard.iter() {
        let BindingTarget::Mouse { button: bind_btn } = binding.target else {
            continue;
        };
        if bind_btn != button {
            continue;
        }
        if binding.ctrl != ctrl || binding.alt != alt || binding.shift != shift || binding.meta != meta
        {
            continue;
        }
        let action = binding.action.clone();
        drop(guard);
        dispatch_action(&action);
        return;
    }
}

#[cfg(windows)]
fn start_windows_hooks() {
    if HOOK_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::Builder::new()
        .name("whithin-passive-hotkeys".into())
        .spawn(|| unsafe {
            use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
            use windows::Win32::UI::WindowsAndMessaging::{
                CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW,
                TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG,
                MSLLHOOKSTRUCT, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN, WM_LBUTTONDOWN,
                WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_SYSKEYDOWN, WM_XBUTTONDOWN,
            };

            // Winuser.h — avoid depending on optional XBUTTON* re-exports.
            const XBUTTON1: u16 = 0x0001;
            const XBUTTON2: u16 = 0x0002;

            unsafe extern "system" fn keyboard_proc(
                code: i32,
                wparam: WPARAM,
                lparam: LPARAM,
            ) -> LRESULT {
                if code >= 0 {
                    let is_down =
                        wparam.0 == WM_KEYDOWN as usize || wparam.0 == WM_SYSKEYDOWN as usize;
                    if is_down {
                        let info = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
                        maybe_match_key(info.vkCode);
                    }
                }
                // CRITICAL: always pass through — never consume the key.
                CallNextHookEx(None, code, wparam, lparam)
            }

            unsafe extern "system" fn mouse_proc(
                code: i32,
                wparam: WPARAM,
                lparam: LPARAM,
            ) -> LRESULT {
                if code >= 0 {
                    let msg = wparam.0 as u32;
                    let button = match msg {
                        m if m == WM_LBUTTONDOWN => Some(MouseButton::Left),
                        m if m == WM_RBUTTONDOWN => Some(MouseButton::Right),
                        m if m == WM_MBUTTONDOWN => Some(MouseButton::Middle),
                        m if m == WM_XBUTTONDOWN => {
                            let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                            // HIWORD(mouseData) — XBUTTON1 / XBUTTON2
                            let xbtn = ((info.mouseData >> 16) & 0xffff) as u16;
                            if xbtn == XBUTTON1 {
                                Some(MouseButton::Back)
                            } else if xbtn == XBUTTON2 {
                                Some(MouseButton::Forward)
                            } else {
                                None
                            }
                        }
                        _ => None,
                    };
                    if let Some(button) = button {
                        maybe_match_mouse(button);
                    }
                }
                // CRITICAL: always pass through — never consume the click.
                CallNextHookEx(None, code, wparam, lparam)
            }

            let kb_hook: HHOOK =
                match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0) {
                    Ok(h) => h,
                    Err(err) => {
                        eprintln!("[shortcuts] SetWindowsHookExW(keyboard) failed: {err}");
                        HOOK_STARTED.store(false, Ordering::SeqCst);
                        return;
                    }
                };

            let mouse_hook: HHOOK =
                match SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0) {
                    Ok(h) => h,
                    Err(err) => {
                        eprintln!("[shortcuts] SetWindowsHookExW(mouse) failed: {err}");
                        let _ = UnhookWindowsHookEx(kb_hook);
                        HOOK_STARTED.store(false, Ordering::SeqCst);
                        return;
                    }
                };

            eprintln!("[shortcuts] passive WH_KEYBOARD_LL + WH_MOUSE_LL hooks installed");

            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).into() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }

            let _ = UnhookWindowsHookEx(mouse_hook);
            let _ = UnhookWindowsHookEx(kb_hook);
            HOOK_STARTED.store(false, Ordering::SeqCst);
        })
        .expect("spawn hotkey thread");
}

#[cfg(not(windows))]
fn start_windows_hooks() {}
