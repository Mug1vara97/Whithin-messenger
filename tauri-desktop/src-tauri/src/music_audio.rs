//! Music audio output lives in its own process.
//!
//! Screen sharing with system sound captures "everything except Whithin's process tree" so
//! call voices don't echo back. Audio played by the app (or its WebView2 children) is cut
//! out the same way, so the player's sound comes from a helper started with explorer.exe as
//! its parent: a separate process tree that the capture keeps.
//!
//! The helper is this same executable run with [`HOST_ARG`]; it talks JSON lines over a
//! loopback TCP socket and exits as soon as the app side of the socket closes.

use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tauri::Emitter;

use crate::music::MusicService;

pub const HOST_ARG: &str = "--music-audio-host";
const EVENT: &str = "music-audio";
/// One request per track in practice: every new TLS handshake to googlevideo is a chance for
/// Russian DPI to drop the connection, so the body is streamed instead of fetched in small ranges.
const CHUNK_SIZE: u64 = 10 * 1024 * 1024;
const CHUNK_ATTEMPTS: u32 = 4;
/// Extra tries spent moving to other googlevideo servers when one doesn't answer.
const MAX_HOST_SWITCHES: u32 = 8;

fn host_of(url: &str) -> Option<String> {
    url::Url::parse(url).ok()?.host_str().map(str::to_string)
}
const TICK: Duration = Duration::from_millis(250);

// ---------------------------------------------------------------------------------------
// App side
// ---------------------------------------------------------------------------------------

struct HostConnection {
    writer: TcpStream,
    pid: u32,
}

#[derive(Default)]
pub struct MusicAudio {
    host: Mutex<Option<HostConnection>>,
}

impl MusicAudio {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    fn send(&self, app: &tauri::AppHandle, message: &Value) -> Result<(), String> {
        let mut host = self.host.lock().map_err(|e| e.to_string())?;
        if host.is_none() {
            *host = Some(start_host(app)?);
        }
        let mut line = message.to_string();
        line.push('\n');
        let connection = host.as_mut().expect("host started");
        if let Err(e) = connection.writer.write_all(line.as_bytes()) {
            eprintln!("[music-audio] host {} unreachable: {e}", connection.pid);
            *host = None;
            return Err(format!("host:{e}"));
        }
        Ok(())
    }

    /// Stops playback without spawning a host just for that.
    fn send_if_running(&self, message: &Value) {
        if let Ok(mut host) = self.host.lock() {
            if let Some(connection) = host.as_mut() {
                let line = format!("{message}\n");
                if connection.writer.write_all(line.as_bytes()).is_err() {
                    *host = None;
                }
            }
        }
    }
}

fn start_host(app: &tauri::AppHandle) -> Result<HostConnection, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("host:bind {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let token = crate::music::random_token(32);
    let exe = std::env::current_exe().map_err(|e| format!("host:exe {e}"))?;
    let pid = spawn_outside_tree(&exe, &format!("{HOST_ARG} {port} {token}"))
        .map_err(|e| format!("host:spawn {e}"))?;

    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(10);
    let stream = loop {
        match listener.accept() {
            Ok((stream, _)) => break stream,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock && Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(format!("host:accept {e}")),
        }
    };
    stream.set_nonblocking(false).map_err(|e| e.to_string())?;
    stream.set_nodelay(true).ok();

    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let mut hello = String::new();
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
    reader.read_line(&mut hello).map_err(|e| format!("host:hello {e}"))?;
    if hello.trim() != token {
        return Err("host:bad hello".to_string());
    }
    stream.set_read_timeout(None).ok();
    eprintln!("[music-audio] host started, pid {pid}");

    let app = app.clone();
    std::thread::Builder::new()
        .name("music-audio-events".into())
        .spawn(move || {
            for line in reader.lines() {
                let Ok(line) = line else { break };
                if let Ok(event) = serde_json::from_str::<Value>(&line) {
                    let _ = app.emit_to(crate::music_window::LABEL, EVENT, event);
                }
            }
            eprintln!("[music-audio] host {pid} exited");
            if let Some(audio) = tauri::Manager::try_state::<Arc<MusicAudio>>(&app) {
                if let Ok(mut host) = audio.host.lock() {
                    if host.as_ref().is_some_and(|h| h.pid == pid) {
                        *host = None;
                    }
                }
            }
            let _ = app.emit_to(crate::music_window::LABEL, EVENT, json!({ "event": "host-exit" }));
        })
        .map_err(|e| e.to_string())?;

    Ok(HostConnection { writer: stream, pid })
}

/// Starts `exe` as a child of explorer.exe, i.e. outside our own process tree.
#[cfg(windows)]
fn spawn_outside_tree(exe: &std::path::Path, args: &str) -> Result<u32, String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Threading::{
        CreateProcessW, DeleteProcThreadAttributeList, InitializeProcThreadAttributeList, OpenProcess,
        UpdateProcThreadAttribute, CREATE_NO_WINDOW, EXTENDED_STARTUPINFO_PRESENT, LPPROC_THREAD_ATTRIBUTE_LIST,
        PROCESS_CREATE_PROCESS, PROCESS_INFORMATION, PROC_THREAD_ATTRIBUTE_PARENT_PROCESS, STARTUPINFOEXW,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetShellWindow, GetWindowThreadProcessId};

    let mut command: Vec<u16> = format!("\"{}\" {args}", exe.display()).encode_utf16().chain(Some(0)).collect();
    unsafe {
        let mut shell_pid = 0u32;
        GetWindowThreadProcessId(GetShellWindow(), Some(&mut shell_pid));
        if shell_pid == 0 {
            return Err("no shell window".to_string());
        }
        let parent: HANDLE = OpenProcess(PROCESS_CREATE_PROCESS, false, shell_pid).map_err(|e| format!("open shell: {e}"))?;

        let mut size = 0usize;
        let _ = InitializeProcThreadAttributeList(None, 1, None, &mut size);
        let mut buffer = vec![0u8; size];
        let list = LPPROC_THREAD_ATTRIBUTE_LIST(buffer.as_mut_ptr().cast());
        let result = (|| -> Result<u32, String> {
            InitializeProcThreadAttributeList(Some(list), 1, None, &mut size).map_err(|e| format!("attr init: {e}"))?;
            let outcome = (|| {
                UpdateProcThreadAttribute(
                    list,
                    0,
                    PROC_THREAD_ATTRIBUTE_PARENT_PROCESS as usize,
                    Some((&parent as *const HANDLE).cast()),
                    std::mem::size_of::<HANDLE>(),
                    None,
                    None,
                )
                .map_err(|e| format!("attr parent: {e}"))?;
                let mut startup = STARTUPINFOEXW::default();
                startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
                startup.lpAttributeList = list;
                let mut info = PROCESS_INFORMATION::default();
                CreateProcessW(
                    None,
                    Some(PWSTR(command.as_mut_ptr())),
                    None,
                    None,
                    false,
                    EXTENDED_STARTUPINFO_PRESENT | CREATE_NO_WINDOW,
                    None,
                    None,
                    &startup.StartupInfo,
                    &mut info,
                )
                .map_err(|e| format!("create: {e}"))?;
                let _ = CloseHandle(info.hThread);
                let _ = CloseHandle(info.hProcess);
                Ok(info.dwProcessId)
            })();
            DeleteProcThreadAttributeList(list);
            outcome
        })();
        let _ = CloseHandle(parent);
        result
    }
}

#[cfg(not(windows))]
fn spawn_outside_tree(exe: &std::path::Path, args: &str) -> Result<u32, String> {
    std::process::Command::new(exe)
        .args(args.split(' '))
        .spawn()
        .map(|child| child.id())
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadRequest {
    token: u64,
    video_id: String,
    #[serde(default)]
    start: f64,
    #[serde(default = "default_true")]
    play: bool,
    #[serde(default = "default_volume")]
    volume: f32,
    /// Re-resolve the stream URL (the previous one got rejected).
    #[serde(default)]
    fresh: bool,
}

fn default_true() -> bool {
    true
}

fn default_volume() -> f32 {
    1.0
}

#[tauri::command]
pub async fn music_audio_load(
    app: tauri::AppHandle,
    music: tauri::State<'_, Arc<MusicService>>,
    audio: tauri::State<'_, Arc<MusicAudio>>,
    request: LoadRequest,
) -> Result<(), String> {
    // Silence the previous track right away; resolving may take a moment.
    audio.send_if_running(&json!({ "cmd": "stop" }));
    let stream = music.stream_for_playback(&request.video_id, request.fresh).await?;
    let message = json!({
        "cmd": "load",
        "token": request.token,
        "url": stream.url,
        "userAgent": stream.user_agent,
        "size": stream.size,
        "mime": stream.mime,
        "start": request.start,
        "play": request.play,
        "volume": request.volume,
    });
    let audio = audio.inner().clone();
    tauri::async_runtime::spawn_blocking(move || audio.send(&app, &message))
        .await
        .map_err(|e| e.to_string())?
}

/// `play` / `pause` / `seek {position}` / `volume {value}` / `stop`.
#[tauri::command]
pub async fn music_audio_command(
    app: tauri::AppHandle,
    audio: tauri::State<'_, Arc<MusicAudio>>,
    command: Value,
) -> Result<(), String> {
    let audio = audio.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        if command["cmd"] == "stop" || command["cmd"] == "pause" {
            audio.send_if_running(&command);
            Ok(())
        } else {
            audio.send(&app, &command)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------------------

/// Entry point when the executable was started as the audio host; `None` otherwise.
pub fn run_host_from_args() -> Option<i32> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some(HOST_ARG) {
        return None;
    }
    let port: u16 = args.next()?.parse().ok()?;
    let token = args.next()?;
    Some(match host_main(port, &token) {
        Ok(()) => 0,
        Err(e) => {
            crate::yt_net::log(&format!("[music-audio-host] {e}"));
            1
        }
    })
}

#[derive(Deserialize)]
#[serde(tag = "cmd", rename_all = "camelCase")]
enum HostCommand {
    #[serde(rename_all = "camelCase")]
    Load {
        token: u64,
        url: String,
        user_agent: String,
        size: u64,
        mime: String,
        start: f64,
        play: bool,
        volume: f32,
    },
    Play,
    Pause,
    Seek {
        position: f64,
    },
    Volume {
        value: f32,
    },
    Stop,
}

enum HostMessage {
    Command(HostCommand),
    Ready {
        token: u64,
        decoder: rodio::Decoder<StreamReader>,
    },
    Failed {
        token: u64,
        error: String,
    },
    Disconnected,
}

struct Track {
    token: u64,
    player: Arc<rodio::Player>,
    download: Arc<Download>,
    duration: f64,
    finished: bool,
}

fn host_main(port: u16, token: &str) -> Result<(), String> {
    let stream = TcpStream::connect(("127.0.0.1", port)).map_err(|e| format!("connect: {e}"))?;
    stream.set_nodelay(true).ok();
    let writer = Arc::new(Mutex::new(stream.try_clone().map_err(|e| e.to_string())?));
    writer
        .lock()
        .unwrap()
        .write_all(format!("{token}\n").as_bytes())
        .map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel::<HostMessage>();
    {
        let tx = tx.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stream).lines() {
                let Ok(line) = line else { break };
                match serde_json::from_str::<HostCommand>(&line) {
                    Ok(command) => {
                        if tx.send(HostMessage::Command(command)).is_err() {
                            return;
                        }
                    }
                    Err(e) => eprintln!("[music-audio-host] bad command {line}: {e}"),
                }
            }
            let _ = tx.send(HostMessage::Disconnected);
        });
    }

    let emit = {
        let writer = writer.clone();
        move |event: Value| {
            if let Ok(mut w) = writer.lock() {
                let _ = w.write_all(format!("{event}\n").as_bytes());
            }
        }
    };

    let mut sink: Option<rodio::MixerDeviceSink> = None;
    let mut track: Option<Track> = None;
    let mut pending: Option<(u64, Arc<Download>, f64)> = None;
    let mut volume: f32 = 1.0;
    let mut playing = false;

    loop {
        let message = match rx.recv_timeout(TICK) {
            Ok(m) => Some(m),
            Err(mpsc::RecvTimeoutError::Timeout) => None,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        };
        match message {
            Some(HostMessage::Disconnected) => break,
            Some(HostMessage::Command(command)) => match command {
                HostCommand::Load { token, url, user_agent, size, mime, start, play, volume: v } => {
                    if let Some(old) = track.take() {
                        old.player.stop();
                        old.download.cancel();
                    }
                    if let Some((_, old, _)) = pending.take() {
                        old.cancel();
                    }
                    volume = v;
                    playing = play;
                    let download = Download::start(url, user_agent, size);
                    pending = Some((token, download.clone(), start));
                    emit(json!({ "event": "loading", "token": token }));
                    let tx = tx.clone();
                    std::thread::spawn(move || {
                        let reader = StreamReader { download: download.clone(), pos: 0 };
                        let total = download.wait_total();
                        let result = match total {
                            Ok(total) => rodio::Decoder::builder()
                                .with_data(reader)
                                .with_byte_len(total)
                                .with_seekable(true)
                                .with_mime_type(&mime)
                                .with_gapless(true)
                                .build()
                                .map_err(|e| format!("decode:{e}")),
                            Err(e) => Err(e),
                        };
                        let _ = tx.send(match result {
                            Ok(decoder) => HostMessage::Ready { token, decoder },
                            Err(error) => HostMessage::Failed { token, error },
                        });
                    });
                }
                HostCommand::Play => {
                    playing = true;
                    if let Some(t) = &track {
                        t.player.play();
                    }
                }
                HostCommand::Pause => {
                    playing = false;
                    if let Some(t) = &track {
                        t.player.pause();
                    }
                }
                HostCommand::Seek { position } => {
                    if let Some(t) = &mut track {
                        t.finished = false;
                        let player = t.player.clone();
                        std::thread::spawn(move || {
                            let _ = player.try_seek(Duration::from_secs_f64(position.max(0.0)));
                        });
                    } else if let Some(p) = &mut pending {
                        p.2 = position;
                    }
                }
                HostCommand::Volume { value } => {
                    volume = value.clamp(0.0, 1.0);
                    if let Some(t) = &track {
                        t.player.set_volume(volume);
                    }
                }
                HostCommand::Stop => {
                    playing = false;
                    if let Some(old) = track.take() {
                        old.player.stop();
                        old.download.cancel();
                    }
                    if let Some((_, old, _)) = pending.take() {
                        old.cancel();
                    }
                }
            },
            Some(HostMessage::Ready { token, decoder }) => {
                if pending.as_ref().is_none_or(|p| p.0 != token) {
                    continue;
                }
                let (_, download, start) = pending.take().expect("pending checked");
                if sink.is_none() {
                    match rodio::DeviceSinkBuilder::open_default_sink() {
                        Ok(mut s) => {
                            s.log_on_drop(false);
                            sink = Some(s);
                        }
                        Err(e) => {
                            download.cancel();
                            emit(json!({ "event": "error", "token": token, "message": format!("output:{e}") }));
                            continue;
                        }
                    }
                }
                let duration = rodio::Source::total_duration(&decoder).map(|d| d.as_secs_f64()).unwrap_or(0.0);
                let player = Arc::new(rodio::Player::connect_new(sink.as_ref().unwrap().mixer()));
                player.set_volume(volume);
                if !playing {
                    player.pause();
                }
                player.append(decoder);
                if start > 0.5 {
                    let seeker = player.clone();
                    std::thread::spawn(move || {
                        let _ = seeker.try_seek(Duration::from_secs_f64(start));
                    });
                }
                emit(json!({ "event": "ready", "token": token, "duration": duration }));
                track = Some(Track { token, player, download, duration, finished: false });
            }
            Some(HostMessage::Failed { token, error }) => {
                if pending.as_ref().is_some_and(|p| p.0 == token) {
                    pending = None;
                    emit(json!({ "event": "error", "token": token, "message": error }));
                }
            }
            None => {}
        }

        if let Some(t) = &mut track {
            if t.finished {
                continue;
            }
            if t.player.empty() {
                t.finished = true;
                match t.download.error() {
                    Some(error) => emit(json!({ "event": "error", "token": t.token, "message": error })),
                    None => emit(json!({ "event": "ended", "token": t.token })),
                }
                continue;
            }
            emit(json!({
                "event": "time",
                "token": t.token,
                "position": t.player.get_pos().as_secs_f64(),
                "duration": t.duration,
                "playing": !t.player.is_paused(),
                "buffering": t.download.is_waiting(),
            }));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------
// Progressive download
// ---------------------------------------------------------------------------------------

#[derive(Default)]
struct Buffer {
    bytes: Vec<u8>,
    total: Option<u64>,
    done: bool,
    error: Option<String>,
}

/// Downloads the whole file sequentially in ranged chunks of at most 10 MiB (googlevideo throttles larger
/// single requests) while the decoder reads whatever has arrived.
struct Download {
    buffer: Mutex<Buffer>,
    changed: Condvar,
    cancelled: AtomicBool,
    waiting: AtomicBool,
}

impl Download {
    fn start(url: String, user_agent: String, size: u64) -> Arc<Self> {
        let download = Arc::new(Self {
            buffer: Mutex::new(Buffer { total: (size > 0).then_some(size), ..Default::default() }),
            changed: Condvar::new(),
            cancelled: AtomicBool::new(false),
            waiting: AtomicBool::new(false),
        });
        let worker = download.clone();
        std::thread::spawn(move || {
            let result = worker.run(&url, &user_agent);
            let mut buffer = worker.buffer.lock().unwrap();
            match result {
                Ok(()) => buffer.done = true,
                Err(e) => buffer.error = Some(e),
            }
            drop(buffer);
            worker.changed.notify_all();
        });
        download
    }

    /// Moves `url` to the best untried googlevideo server; false if there is none.
    fn switch_host(&self, url: &mut String) -> bool {
        for host in crate::yt_net::alternate_hosts(url) {
            if let Some(next) = crate::yt_net::with_host(url, &host) {
                crate::yt_net::log(&format!("[music-audio-host] switching to {host}"));
                *url = next;
                return true;
            }
        }
        false
    }

    fn run(&self, url: &str, user_agent: &str) -> Result<(), String> {
        if let Some(path) = url.strip_prefix(crate::music::LOCAL_FILE_PREFIX) {
            let bytes = std::fs::read(path).map_err(|e| format!("error:read {path}: {e}"))?;
            let mut buffer = self.buffer.lock().unwrap();
            buffer.total = Some(bytes.len() as u64);
            buffer.bytes = bytes;
            drop(buffer);
            self.changed.notify_all();
            return Ok(());
        }
        let mut builder = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(10))
            .timeout_read(Duration::from_secs(20))
            .timeout_write(Duration::from_secs(20));
        if let Some(proxy) = crate::yt_net::ureq_proxy() {
            builder = builder.proxy(proxy);
        }
        let agent = builder.build();
        let mut url = url.to_string();
        if host_of(&url).is_some_and(|h| crate::yt_net::is_dead(&h)) {
            self.switch_host(&mut url);
        }
        let mut offset = 0u64;
        loop {
            if self.cancelled.load(Ordering::Relaxed) {
                return Ok(());
            }
            let total = self.buffer.lock().unwrap().total;
            if total.is_some_and(|t| offset >= t) {
                return Ok(());
            }
            let end = match total {
                Some(t) => (offset + CHUNK_SIZE - 1).min(t - 1),
                None => offset + CHUNK_SIZE - 1,
            };
            let mut last_error = String::new();
            let mut progressed = false;
            let mut retries = 0;
            for attempt in 0..CHUNK_ATTEMPTS + MAX_HOST_SWITCHES {
                if attempt > 0 {
                    let unreachable = last_error.starts_with("network:connect");
                    if unreachable {
                        if let Some(host) = host_of(&url) {
                            crate::yt_net::mark_dead(&host);
                        }
                    }
                    if !(unreachable && self.switch_host(&mut url)) {
                        retries += 1;
                        if retries >= CHUNK_ATTEMPTS {
                            break;
                        }
                        std::thread::sleep(Duration::from_millis(300 * retries as u64));
                    }
                }
                if self.cancelled.load(Ordering::Relaxed) {
                    return Ok(());
                }
                let started = std::time::Instant::now();
                let attempt_host = host_of(&url).unwrap_or_default();
                let log_attempt = {
                    let (host, at) = (attempt_host.clone(), offset);
                    move |result: &str| {
                        crate::yt_net::log(&format!(
                            "[music-audio-host] chunk @{at} try {attempt} {host}: {result} in {:?}",
                            started.elapsed()
                        ));
                    }
                };
                let outcome = agent
                    .get(&url)
                    .set("User-Agent", user_agent)
                    .set("Range", &format!("bytes={offset}-{end}"))
                    .call();
                match outcome {
                    Ok(response) => {
                        let reported_total = response
                            .header("content-range")
                            .and_then(|v| v.rsplit('/').next())
                            .and_then(|v| v.parse::<u64>().ok());
                        {
                            let mut buffer = self.buffer.lock().unwrap();
                            if buffer.total.is_none() {
                                buffer.total = reported_total;
                            }
                        }
                        crate::yt_net::mark_alive(&attempt_host);
                        let (got, error) = self.stream_body(response.into_reader(), end + 1 - offset);
                        offset += got;
                        if got > 0 {
                            progressed = true;
                        }
                        match error {
                            None if got > 0 => {
                                last_error.clear();
                                if started.elapsed() > Duration::from_secs(5) {
                                    log_attempt(&format!("ok {got} bytes"));
                                }
                                break;
                            }
                            None => last_error = "upstream:empty".to_string(),
                            Some(e) => last_error = format!("network:io: {e} after {got} bytes"),
                        }
                        if self.cancelled.load(Ordering::Relaxed) {
                            return Ok(());
                        }
                        if got > 0 {
                            log_attempt(&last_error);
                            break;
                        }
                    }
                    Err(ureq::Error::Status(code, _)) => {
                        last_error = format!("upstream:{code}");
                        log_attempt(&last_error);
                        if code == 403 || code == 410 || code == 416 {
                            break;
                        }
                        continue;
                    }
                    Err(ureq::Error::Transport(t)) => {
                        let stage = if matches!(t.kind(), ureq::ErrorKind::ConnectionFailed | ureq::ErrorKind::Dns | ureq::ErrorKind::ProxyConnect) {
                            "connect"
                        } else {
                            "io"
                        };
                        last_error = format!("network:{stage}: {}: {}", t.kind(), t.message().unwrap_or_default());
                    }
                }
                log_attempt(&last_error);
            }
            if !progressed {
                crate::yt_net::log(&format!("[music-audio-host] chunk @{offset}: {last_error}"));
                return Err(last_error);
            }
            if self.buffer.lock().unwrap().total.is_none() && last_error.is_empty() && offset % CHUNK_SIZE != 0 {
                return Ok(());
            }
        }
    }

    /// Appends the response body to the buffer as it arrives; bytes received and the error that cut it short.
    fn stream_body(&self, mut body: impl Read, limit: u64) -> (u64, Option<String>) {
        let mut piece = vec![0u8; 64 * 1024];
        let mut got = 0u64;
        while got < limit {
            if self.cancelled.load(Ordering::Relaxed) {
                return (got, None);
            }
            let want = piece.len().min((limit - got) as usize);
            match body.read(&mut piece[..want]) {
                Ok(0) => break,
                Ok(n) => {
                    got += n as u64;
                    self.buffer.lock().unwrap().bytes.extend_from_slice(&piece[..n]);
                    self.changed.notify_all();
                }
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => {}
                Err(e) => return (got, Some(e.to_string())),
            }
        }
        (got, None)
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
        self.changed.notify_all();
    }

    fn error(&self) -> Option<String> {
        self.buffer.lock().unwrap().error.clone()
    }

    fn is_waiting(&self) -> bool {
        self.waiting.load(Ordering::Relaxed)
    }

    /// Blocks until the file size is known (from the first chunk at the latest).
    fn wait_total(&self) -> Result<u64, String> {
        let mut buffer = self.buffer.lock().unwrap();
        loop {
            if let Some(error) = &buffer.error {
                return Err(error.clone());
            }
            if self.cancelled.load(Ordering::Relaxed) {
                return Err("cancelled".to_string());
            }
            if let Some(total) = buffer.total {
                return Ok(total);
            }
            if buffer.done {
                return Ok(buffer.bytes.len() as u64);
            }
            buffer = self.changed.wait_timeout(buffer, Duration::from_millis(200)).unwrap().0;
        }
    }
}

struct StreamReader {
    download: Arc<Download>,
    pos: u64,
}

impl Read for StreamReader {
    fn read(&mut self, out: &mut [u8]) -> std::io::Result<usize> {
        let download = &self.download;
        let mut buffer = download.buffer.lock().unwrap();
        while (self.pos as usize) >= buffer.bytes.len()
            && !buffer.done
            && buffer.error.is_none()
            && !download.cancelled.load(Ordering::Relaxed)
        {
            download.waiting.store(true, Ordering::Relaxed);
            buffer = download.changed.wait_timeout(buffer, Duration::from_millis(200)).unwrap().0;
        }
        download.waiting.store(false, Ordering::Relaxed);
        let start = self.pos as usize;
        if start >= buffer.bytes.len() {
            return Ok(0);
        }
        let n = out.len().min(buffer.bytes.len() - start);
        out[..n].copy_from_slice(&buffer.bytes[start..start + n]);
        self.pos += n as u64;
        Ok(n)
    }
}

impl Seek for StreamReader {
    fn seek(&mut self, from: SeekFrom) -> std::io::Result<u64> {
        let total = {
            let buffer = self.download.buffer.lock().unwrap();
            buffer.total.unwrap_or(buffer.bytes.len() as u64)
        };
        let target = match from {
            SeekFrom::Start(p) => p as i64,
            SeekFrom::End(d) => total as i64 + d,
            SeekFrom::Current(d) => self.pos as i64 + d,
        };
        if target < 0 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "seek before start"));
        }
        self.pos = target as u64;
        Ok(self.pos)
    }
}
