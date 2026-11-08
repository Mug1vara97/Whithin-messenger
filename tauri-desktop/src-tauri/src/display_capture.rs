//! Custom `getDisplayMedia` backend for Tauri/WebView2.
//!
//! Pipeline (all latest-frame-only, so a slow stage never builds a backlog):
//!
//!   Windows Graphics Capture (GPU, cursor, occluded windows OK)
//!     → BGRA frame copy               [capture thread]
//!     → SIMD downscale + JPEG encode  [encode thread]
//!     → binary WebSocket push         [one thread per client, 127.0.0.1 only]
//!
//! Every WebSocket message is `[u32 seq][u32 width][u32 height][u64 ts_us][u32 format]`
//! (LE) followed by the payload. The preferred payload is raw **I420** — exactly
//! what WebRTC's encoder consumes, so the bridge wraps it in a `VideoFrame` with
//! zero decoding/conversion and writes it to a `MediaStreamTrackGenerator`.
//! JPEG payloads remain for the canvas / polling fallbacks.
//!
//! If WGC is unavailable (very old Windows 10) a GDI fallback feeds the same
//! pipeline. The latest JPEG is also kept for the `whithin-asset://` pull path
//! used by the bridge as a last-resort fallback.

use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use fast_image_resize::images::{Image, ImageRef};
use fast_image_resize::{FilterType, PixelType, ResizeAlg, ResizeOptions, Resizer};
use jpeg_encoder::{ColorType, Encoder, SamplingFactor};

/// Size of the binary header that precedes each payload.
pub const FRAME_HEADER_LEN: usize = 4 + 4 + 4 + 8 + 4;

const DEFAULT_MAX_WIDTH: u32 = 1280;
const DEFAULT_MAX_HEIGHT: u32 = 720;
const DEFAULT_FPS: u32 = 30;
const DEFAULT_QUALITY: u8 = 80;
const MAX_FPS: u32 = 60;

// ---------------------------------------------------------------------------
// Public options / results
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FrameFormat {
    /// Baseline JPEG (fallback paths that need an image the browser can decode).
    Jpeg = 1,
    /// Planar I420 (Y, then U, then V; tightly packed). Zero-conversion path
    /// into WebCodecs `VideoFrame` → WebRTC.
    I420 = 2,
}

impl FrameFormat {
    pub fn parse(value: Option<&str>) -> Self {
        match value.map(|v| v.to_ascii_lowercase()).as_deref() {
            Some("jpeg") | Some("jpg") => FrameFormat::Jpeg,
            _ => FrameFormat::I420,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            FrameFormat::Jpeg => "jpeg",
            FrameFormat::I420 => "i420",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct CaptureOptions {
    pub max_width: u32,
    pub max_height: u32,
    pub fps: u32,
    pub quality: u8,
    pub format: FrameFormat,
}

impl Default for CaptureOptions {
    fn default() -> Self {
        Self {
            max_width: DEFAULT_MAX_WIDTH,
            max_height: DEFAULT_MAX_HEIGHT,
            fps: DEFAULT_FPS,
            quality: DEFAULT_QUALITY,
            format: FrameFormat::I420,
        }
    }
}

impl CaptureOptions {
    pub fn sanitized(mut self) -> Self {
        self.max_width = self.max_width.clamp(320, 3840);
        self.max_height = self.max_height.clamp(180, 2160);
        self.fps = self.fps.clamp(5, MAX_FPS);
        self.quality = self.quality.clamp(40, 95);
        self
    }
}

#[derive(Clone, Debug)]
pub struct StartInfo {
    pub port: u16,
    pub token: String,
    pub source_width: u32,
    pub source_height: u32,
    pub out_width: u32,
    pub out_height: u32,
    pub fps: u32,
    pub backend: &'static str,
    pub format: FrameFormat,
}

// ---------------------------------------------------------------------------
// Latest-JPEG slot (asset protocol fallback + frame info command)
// ---------------------------------------------------------------------------

struct LatestFrame {
    /// Full message (header + JPEG).
    message: Arc<Vec<u8>>,
    width: u32,
    height: u32,
    seq: u64,
}

static LATEST: OnceLock<Mutex<LatestFrame>> = OnceLock::new();

fn latest_slot() -> &'static Mutex<LatestFrame> {
    LATEST.get_or_init(|| {
        Mutex::new(LatestFrame {
            message: Arc::new(Vec::new()),
            width: 0,
            height: 0,
            seq: 0,
        })
    })
}

/// Latest encoded frame as a full message (header + JPEG). Slice off
/// [`FRAME_HEADER_LEN`] to get the raw JPEG.
pub fn take_latest_jpeg() -> Option<(Arc<Vec<u8>>, u32, u32, u64)> {
    let guard = latest_slot().lock().ok()?;
    if guard.message.len() <= FRAME_HEADER_LEN {
        return None;
    }
    Some((
        Arc::clone(&guard.message),
        guard.width,
        guard.height,
        guard.seq,
    ))
}

pub fn latest_frame_info() -> Option<(u64, u32, u32)> {
    let guard = latest_slot().lock().ok()?;
    if guard.message.len() <= FRAME_HEADER_LEN || guard.seq == 0 {
        return None;
    }
    Some((guard.seq, guard.width, guard.height))
}

pub fn clear_latest() {
    if let Ok(mut guard) = latest_slot().lock() {
        guard.message = Arc::new(Vec::new());
        guard.width = 0;
        guard.height = 0;
        guard.seq = 0;
    }
}

// ---------------------------------------------------------------------------
// Session shared between threads
// ---------------------------------------------------------------------------

struct RawFrame {
    bgra: Vec<u8>,
    width: u32,
    height: u32,
    ts_us: u64,
}

/// Latest-only slot for raw BGRA frames with a small buffer pool.
struct RawSlot {
    frame: Mutex<Option<RawFrame>>,
    cv: Condvar,
    pool: Mutex<Vec<Vec<u8>>>,
}

impl RawSlot {
    fn new() -> Self {
        Self {
            frame: Mutex::new(None),
            cv: Condvar::new(),
            pool: Mutex::new(Vec::new()),
        }
    }

    fn take_buffer(&self, len: usize) -> Vec<u8> {
        let mut buf = self
            .pool
            .lock()
            .ok()
            .and_then(|mut p| p.pop())
            .unwrap_or_default();
        buf.resize(len, 0);
        buf
    }

    fn recycle(&self, buf: Vec<u8>) {
        if let Ok(mut p) = self.pool.lock() {
            if p.len() < 3 {
                p.push(buf);
            }
        }
    }

    fn publish(&self, frame: RawFrame) {
        if let Ok(mut slot) = self.frame.lock() {
            if let Some(old) = slot.replace(frame) {
                drop(slot);
                self.recycle(old.bgra);
            }
        }
        self.cv.notify_one();
    }

    /// Blocks until a frame is available or `stop` is set.
    fn wait_take(&self, stop: &AtomicBool) -> Option<RawFrame> {
        let mut slot = self.frame.lock().ok()?;
        loop {
            if stop.load(Ordering::Relaxed) {
                return None;
            }
            if let Some(frame) = slot.take() {
                return Some(frame);
            }
            let (guard, _) = self
                .cv
                .wait_timeout(slot, Duration::from_millis(100))
                .ok()?;
            slot = guard;
        }
    }
}

struct BusState {
    seq: u64,
    message: Option<Arc<Vec<u8>>>,
}

/// Broadcast of encoded frames to WebSocket clients (latest-only per client).
struct FrameBus {
    state: Mutex<BusState>,
    cv: Condvar,
}

impl FrameBus {
    fn new() -> Self {
        Self {
            state: Mutex::new(BusState {
                seq: 0,
                message: None,
            }),
            cv: Condvar::new(),
        }
    }

    fn publish(&self, seq: u64, message: Arc<Vec<u8>>) {
        if let Ok(mut st) = self.state.lock() {
            st.seq = seq;
            st.message = Some(message);
        }
        self.cv.notify_all();
    }

    /// Waits for a frame newer than `after`, up to `timeout`.
    fn wait_newer(&self, after: u64, timeout: Duration) -> Option<(u64, Arc<Vec<u8>>)> {
        let mut st = self.state.lock().ok()?;
        if st.seq <= after {
            let (guard, _) = self.cv.wait_timeout(st, timeout).ok()?;
            st = guard;
        }
        if st.seq > after {
            st.message.as_ref().map(|m| (st.seq, Arc::clone(m)))
        } else {
            None
        }
    }
}

pub(crate) struct Session {
    stop: AtomicBool,
    raw: RawSlot,
    bus: FrameBus,
    seq: AtomicU64,
    started: Instant,
    options: CaptureOptions,
    token: String,
    frames_in: AtomicU64,
    frames_out: AtomicU64,
}

impl Session {
    fn new(options: CaptureOptions, token: String) -> Self {
        Self {
            stop: AtomicBool::new(false),
            raw: RawSlot::new(),
            bus: FrameBus::new(),
            seq: AtomicU64::new(0),
            started: Instant::now(),
            options,
            token,
            frames_in: AtomicU64::new(0),
            frames_out: AtomicU64::new(0),
        }
    }

    fn stopped(&self) -> bool {
        self.stop.load(Ordering::Relaxed)
    }

    fn request_stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
        self.raw.cv.notify_all();
        self.bus.cv.notify_all();
    }

    fn now_us(&self) -> u64 {
        self.started.elapsed().as_micros() as u64
    }

    fn push_raw(&self, bgra: Vec<u8>, width: u32, height: u32) {
        self.frames_in.fetch_add(1, Ordering::Relaxed);
        self.raw.publish(RawFrame {
            bgra,
            width,
            height,
            ts_us: self.now_us(),
        });
    }

    fn publish_encoded(&self, message: Vec<u8>, width: u32, height: u32) {
        let seq = self.seq.fetch_add(1, Ordering::Relaxed) + 1;
        let mut message = message;
        message[0..4].copy_from_slice(&(seq as u32).to_le_bytes());
        let message = Arc::new(message);
        // The asset-protocol fallback can only serve JPEG.
        if self.options.format == FrameFormat::Jpeg {
            if let Ok(mut guard) = latest_slot().lock() {
                guard.message = Arc::clone(&message);
                guard.width = width;
                guard.height = height;
                guard.seq = seq;
            }
        }
        self.bus.publish(seq, message);
        self.frames_out.fetch_add(1, Ordering::Relaxed);
    }
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

struct CaptureInner {
    session: Arc<Session>,
    threads: Vec<JoinHandle<()>>,
    #[cfg(windows)]
    wgc: Option<wgc::Control>,
}

pub struct DisplayCaptureManager {
    inner: Mutex<Option<CaptureInner>>,
}

impl DisplayCaptureManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn is_capturing(&self) -> bool {
        self.inner
            .lock()
            .map(|g| g.as_ref().map(|c| !c.session.stopped()).unwrap_or(false))
            .unwrap_or(false)
    }

    pub fn stop(&self) -> bool {
        let taken = match self.inner.lock() {
            Ok(mut g) => g.take(),
            Err(_) => return false,
        };
        let Some(inner) = taken else {
            return false;
        };
        inner.session.request_stop();
        #[cfg(windows)]
        if let Some(control) = inner.wgc {
            control.stop();
        }
        for handle in inner.threads {
            let _ = handle.join();
        }
        clear_latest();
        eprintln!(
            "[display-capture] stopped (in={} out={})",
            inner.session.frames_in.load(Ordering::Relaxed),
            inner.session.frames_out.load(Ordering::Relaxed)
        );
        true
    }

    pub fn start(
        &self,
        source_id: String,
        source_type: String,
        options: CaptureOptions,
    ) -> Result<StartInfo, String> {
        self.stop();
        clear_latest();

        let options = options.sanitized();
        let token = random_token();
        let session = Arc::new(Session::new(options, token.clone()));

        let target = resolve_target(&source_id, &source_type)?;
        eprintln!(
            "[display-capture] start id={source_id} type={source_type} src={}x{} max={}x{} fps={} q={} fmt={}",
            target.width,
            target.height,
            options.max_width,
            options.max_height,
            options.fps,
            options.quality,
            options.format.as_str()
        );

        let mut threads = Vec::new();

        // WebSocket server first so the port is known before any frame exists.
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to bind frame socket: {e}"))?;
        let port = listener
            .local_addr()
            .map_err(|e| e.to_string())?
            .port();
        listener
            .set_nonblocking(true)
            .map_err(|e| e.to_string())?;
        {
            let session = Arc::clone(&session);
            threads.push(
                thread::Builder::new()
                    .name("display-ws-accept".into())
                    .spawn(move || run_ws_accept_loop(listener, session))
                    .map_err(|e| e.to_string())?,
            );
        }

        // Encoder.
        {
            let session = Arc::clone(&session);
            threads.push(
                thread::Builder::new()
                    .name("display-encode".into())
                    .spawn(move || run_encoder(session))
                    .map_err(|e| e.to_string())?,
            );
        }

        // Capture source.
        #[cfg(windows)]
        let (wgc, backend) = match wgc::start(&target, Arc::clone(&session)) {
            Ok(control) => (Some(control), "wgc"),
            Err(err) => {
                eprintln!("[display-capture] WGC unavailable ({err}); using GDI fallback");
                let session = Arc::clone(&session);
                let target = target.clone();
                threads.push(
                    thread::Builder::new()
                        .name("display-gdi".into())
                        .spawn(move || gdi::run_loop(target, session))
                        .map_err(|e| e.to_string())?,
                );
                (None, "gdi")
            }
        };
        #[cfg(not(windows))]
        let backend = {
            session.request_stop();
            return Err("Display capture is only implemented on Windows".into());
        };

        let (out_width, out_height) = fit_dimensions(
            target.width,
            target.height,
            options.max_width,
            options.max_height,
        );

        *self.inner.lock().map_err(|e| e.to_string())? = Some(CaptureInner {
            session: Arc::clone(&session),
            threads,
            #[cfg(windows)]
            wgc,
        });

        Ok(StartInfo {
            port,
            token,
            source_width: target.width,
            source_height: target.height,
            out_width,
            out_height,
            fps: options.fps,
            backend,
            format: options.format,
        })
    }
}

// ---------------------------------------------------------------------------
// Target resolution
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct CaptureTarget {
    pub kind: TargetKind,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Debug)]
pub enum TargetKind {
    /// HMONITOR value + virtual-screen rect.
    Monitor {
        hmonitor: isize,
        x: i32,
        y: i32,
    },
    Window {
        hwnd: isize,
    },
}

fn resolve_target(source_id: &str, source_type: &str) -> Result<CaptureTarget, String> {
    let is_window = source_type == "window" || source_id.starts_with("window:");
    let mut parts = source_id.split(':');
    let _prefix = parts.next();
    let second = parts.next().unwrap_or("");
    let third = parts.next().unwrap_or("");

    if is_window {
        let hwnd = second
            .parse::<isize>()
            .map_err(|_| format!("Bad window id: {source_id}"))?;
        let (w, h) = window_size(hwnd).ok_or_else(|| "Window is gone".to_string())?;
        return Ok(CaptureTarget {
            kind: TargetKind::Window { hwnd },
            width: w,
            height: h,
        });
    }

    let wanted_id = second.parse::<u32>().ok();
    let wanted_index = third.parse::<usize>().ok();
    let monitors = xcap::Monitor::all().map_err(|e| format!("Monitor enumeration failed: {e}"))?;
    let pick = monitors
        .iter()
        .find(|m| wanted_id.is_some() && m.id().ok() == wanted_id)
        .or_else(|| wanted_index.and_then(|i| monitors.get(i)))
        .or_else(|| monitors.iter().find(|m| m.is_primary().unwrap_or(false)))
        .or_else(|| monitors.first())
        .ok_or_else(|| "No monitors found".to_string())?;

    let x = pick.x().unwrap_or(0);
    let y = pick.y().unwrap_or(0);
    let width = pick.width().unwrap_or(1280).max(2);
    let height = pick.height().unwrap_or(720).max(2);
    let hmonitor = pick.id().map(|id| id as isize).unwrap_or(0);

    Ok(CaptureTarget {
        kind: TargetKind::Monitor { hmonitor, x, y },
        width,
        height,
    })
}

#[cfg(windows)]
fn window_size(hwnd: isize) -> Option<(u32, u32)> {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsWindow};
    unsafe {
        let hwnd = HWND(hwnd as *mut _);
        if !IsWindow(Some(hwnd)).as_bool() {
            return None;
        }
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        let w = (rect.right - rect.left).max(2) as u32;
        let h = (rect.bottom - rect.top).max(2) as u32;
        Some((w, h))
    }
}

#[cfg(not(windows))]
fn window_size(_hwnd: isize) -> Option<(u32, u32)> {
    None
}

/// Fit `src` into `max` keeping aspect ratio, never upscaling, even dimensions.
fn fit_dimensions(src_w: u32, src_h: u32, max_w: u32, max_h: u32) -> (u32, u32) {
    if src_w == 0 || src_h == 0 {
        return (max_w & !1, max_h & !1);
    }
    let scale = (max_w as f64 / src_w as f64)
        .min(max_h as f64 / src_h as f64)
        .min(1.0);
    let w = ((src_w as f64 * scale).round() as u32).max(2) & !1;
    let h = ((src_h as f64 * scale).round() as u32).max(2) & !1;
    (w, h)
}

fn random_token() -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut out = String::with_capacity(32);
    for salt in 0..2u64 {
        // RandomState is seeded from OS randomness — good enough for a loopback token.
        let mut h = RandomState::new().build_hasher();
        h.write_u64(salt ^ std::process::id() as u64);
        h.write_u128(nanos ^ 0x9e37_79b9_7f4a_7c15);
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

// ---------------------------------------------------------------------------
// Encoder thread: raw BGRA → (resize) → JPEG → bus
// ---------------------------------------------------------------------------

fn run_encoder(session: Arc<Session>) {
    let opts = session.options;
    let mut resizer = Resizer::new();
    let resize_opts = ResizeOptions::new()
        .resize_alg(ResizeAlg::Convolution(FilterType::Bilinear))
        .use_alpha(false);
    let mut dst: Option<Image<'static>> = None;
    let mut out = Vec::with_capacity(512 * 1024);
    let mut last_report = Instant::now();
    let mut encoded = 0u64;
    let mut encode_time = Duration::ZERO;

    while let Some(raw) = session.raw.wait_take(&session.stop) {
        let t0 = Instant::now();
        let (ow, oh) = fit_dimensions(raw.width, raw.height, opts.max_width, opts.max_height);

        let pixels: &[u8] = if (ow, oh) == (raw.width, raw.height) {
            &raw.bgra
        } else {
            let needs_alloc = dst
                .as_ref()
                .map(|d| d.width() != ow || d.height() != oh)
                .unwrap_or(true);
            if needs_alloc {
                dst = Some(Image::new(ow, oh, PixelType::U8x4));
            }
            let dst_img = dst.as_mut().expect("dst allocated");
            match ImageRef::new(raw.width, raw.height, &raw.bgra, PixelType::U8x4) {
                Ok(src_img) => {
                    if let Err(err) = resizer.resize(&src_img, dst_img, &resize_opts) {
                        eprintln!("[display-capture] resize failed: {err}");
                        session.raw.recycle(raw.bgra);
                        continue;
                    }
                }
                Err(err) => {
                    eprintln!("[display-capture] bad raw frame: {err}");
                    session.raw.recycle(raw.bgra);
                    continue;
                }
            }
            dst_img.buffer()
        };

        out.clear();
        out.extend_from_slice(&0u32.to_le_bytes()); // seq, patched on publish
        out.extend_from_slice(&ow.to_le_bytes());
        out.extend_from_slice(&oh.to_le_bytes());
        out.extend_from_slice(&raw.ts_us.to_le_bytes());
        out.extend_from_slice(&(opts.format as u32).to_le_bytes());

        let ok = match opts.format {
            FrameFormat::I420 => {
                bgra_to_i420(pixels, ow, oh, &mut out);
                true
            }
            FrameFormat::Jpeg => {
                let mut encoder = Encoder::new(&mut out, opts.quality);
                encoder.set_sampling_factor(SamplingFactor::F_2_2);
                encoder
                    .encode(pixels, ow as u16, oh as u16, ColorType::Bgra)
                    .is_ok()
            }
        };

        if ok {
            let next_capacity = out.capacity();
            let message = std::mem::replace(&mut out, Vec::with_capacity(next_capacity));
            session.publish_encoded(message, ow, oh);
            encoded += 1;
            encode_time += t0.elapsed();
        }
        session.raw.recycle(raw.bgra);

        if last_report.elapsed() >= Duration::from_secs(3) {
            let secs = last_report.elapsed().as_secs_f32().max(0.001);
            let avg_ms = if encoded > 0 {
                encode_time.as_secs_f32() * 1000.0 / encoded as f32
            } else {
                0.0
            };
            eprintln!(
                "[display-capture] {:.1} fps out {}x{} ({avg_ms:.1} ms/frame)",
                encoded as f32 / secs,
                ow,
                oh
            );
            encoded = 0;
            encode_time = Duration::ZERO;
            last_report = Instant::now();
        }
    }
}

/// BGRA → planar I420 (BT.601 limited range, same matrix libyuv's ARGBToI420
/// uses, so it matches what Chromium produces for native screen capture).
/// Appends Y, U, V planes to `out`. `width`/`height` must be even.
fn bgra_to_i420(bgra: &[u8], width: u32, height: u32, out: &mut Vec<u8>) {
    use rayon::prelude::*;

    let w = width as usize;
    let h = height as usize;
    let y_len = w * h;
    let c_len = (w / 2) * (h / 2);
    let start = out.len();
    out.resize(start + y_len + 2 * c_len, 0);

    let (y_plane, chroma) = out[start..].split_at_mut(y_len);
    let (u_plane, v_plane) = chroma.split_at_mut(c_len);

    let src_stride = w * 4;
    let cw = w / 2;

    // One task per pair of rows: writes 2 Y rows + 1 U row + 1 V row.
    y_plane
        .par_chunks_mut(2 * w)
        .zip(u_plane.par_chunks_mut(cw))
        .zip(v_plane.par_chunks_mut(cw))
        .enumerate()
        .for_each(|(pair, ((y_rows, u_row), v_row))| {
            let row0 = &bgra[pair * 2 * src_stride..pair * 2 * src_stride + src_stride];
            let row1 = &bgra[(pair * 2 + 1) * src_stride..(pair * 2 + 1) * src_stride + src_stride];
            let (y0, y1) = y_rows.split_at_mut(w);

            #[inline(always)]
            fn luma(b: i32, g: i32, r: i32) -> u8 {
                (((66 * r + 129 * g + 25 * b + 128) >> 8) + 16) as u8
            }

            for x in 0..cw {
                let i = x * 8;
                let p00 = &row0[i..i + 4];
                let p01 = &row0[i + 4..i + 8];
                let p10 = &row1[i..i + 4];
                let p11 = &row1[i + 4..i + 8];

                let (b00, g00, r00) = (p00[0] as i32, p00[1] as i32, p00[2] as i32);
                let (b01, g01, r01) = (p01[0] as i32, p01[1] as i32, p01[2] as i32);
                let (b10, g10, r10) = (p10[0] as i32, p10[1] as i32, p10[2] as i32);
                let (b11, g11, r11) = (p11[0] as i32, p11[1] as i32, p11[2] as i32);

                y0[x * 2] = luma(b00, g00, r00);
                y0[x * 2 + 1] = luma(b01, g01, r01);
                y1[x * 2] = luma(b10, g10, r10);
                y1[x * 2 + 1] = luma(b11, g11, r11);

                // Average the 2x2 block before chroma conversion.
                let b = (b00 + b01 + b10 + b11 + 2) >> 2;
                let g = (g00 + g01 + g10 + g11 + 2) >> 2;
                let r = (r00 + r01 + r10 + r11 + 2) >> 2;
                u_row[x] = (((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128) as u8;
                v_row[x] = (((112 * r - 94 * g - 18 * b + 128) >> 8) + 128) as u8;
            }
        });
}

// ---------------------------------------------------------------------------
// WebSocket server (loopback only, token-guarded)
// ---------------------------------------------------------------------------

fn run_ws_accept_loop(listener: TcpListener, session: Arc<Session>) {
    let mut clients: Vec<JoinHandle<()>> = Vec::new();
    while !session.stopped() {
        match listener.accept() {
            Ok((stream, addr)) => {
                if !addr.ip().is_loopback() {
                    continue;
                }
                let session = Arc::clone(&session);
                if let Ok(handle) = thread::Builder::new()
                    .name("display-ws-client".into())
                    .spawn(move || serve_ws_client(stream, session))
                {
                    clients.push(handle);
                }
                clients.retain(|h| !h.is_finished());
            }
            Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(15));
            }
            Err(err) => {
                eprintln!("[display-capture] accept failed: {err}");
                thread::sleep(Duration::from_millis(50));
            }
        }
    }
    for handle in clients {
        let _ = handle.join();
    }
}

fn serve_ws_client(stream: TcpStream, session: Arc<Session>) {
    use tungstenite::handshake::server::{ErrorResponse, Request, Response};
    use tungstenite::http::StatusCode;
    use tungstenite::{Bytes, Message};

    let _ = stream.set_nonblocking(false);
    let _ = stream.set_nodelay(true);
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));

    let expected = format!("token={}", session.token);
    let mut ws = match tungstenite::accept_hdr(stream, |req: &Request, resp: Response| {
        let ok = req
            .uri()
            .query()
            .map(|q| q.split('&').any(|kv| kv == expected))
            .unwrap_or(false);
        if ok {
            Ok(resp)
        } else {
            let mut deny = ErrorResponse::new(Some("forbidden".to_string()));
            *deny.status_mut() = StatusCode::FORBIDDEN;
            Err(deny)
        }
    }) {
        Ok(ws) => ws,
        Err(err) => {
            eprintln!("[display-capture] ws handshake rejected: {err}");
            return;
        }
    };

    eprintln!("[display-capture] ws client connected");
    let mut last_seq = 0u64;
    while !session.stopped() {
        let Some((seq, message)) = session
            .bus
            .wait_newer(last_seq, Duration::from_millis(250))
        else {
            continue;
        };
        last_seq = seq;
        if ws
            .send(Message::Binary(Bytes::copy_from_slice(&message)))
            .is_err()
        {
            break;
        }
    }
    let _ = ws.close(None);
    let _ = ws.flush();
    eprintln!("[display-capture] ws client disconnected");
}

// ---------------------------------------------------------------------------
// Windows Graphics Capture backend
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod wgc {
    use super::{CaptureTarget, Session, TargetKind};
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
    use windows_capture::frame::Frame;
    use windows_capture::graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl};
    use windows_capture::monitor::Monitor;
    use windows_capture::settings::{
        ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
        MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
    };
    use windows_capture::window::Window;

    pub(super) struct Control(CaptureControl<Handler, String>);

    impl Control {
        pub fn stop(self) {
            if let Err(err) = self.0.stop() {
                eprintln!("[display-capture] WGC stop: {err}");
            }
        }
    }

    pub(super) struct Handler {
        session: Arc<Session>,
        interval: Duration,
        last_accept: Option<Instant>,
        frames: u64,
    }

    impl GraphicsCaptureApiHandler for Handler {
        type Flags = Arc<Session>;
        type Error = String;

        fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
            let fps = ctx.flags.options.fps.max(1) as u64;
            Ok(Self {
                session: ctx.flags,
                interval: Duration::from_micros(1_000_000 / fps),
                last_accept: None,
                frames: 0,
            })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            if self.session.stopped() {
                control.stop();
                return Ok(());
            }

            // Pace to the requested fps (WGC delivers at compositor rate).
            let now = Instant::now();
            if let Some(last) = self.last_accept {
                // Allow ~1ms jitter so 60Hz sources still hit 60fps targets.
                if now.duration_since(last) + Duration::from_millis(1) < self.interval {
                    return Ok(());
                }
            }
            self.last_accept = Some(now);

            let width = frame.width();
            let height = frame.height();
            if width < 2 || height < 2 {
                return Ok(());
            }

            let mut buffer = match frame.buffer() {
                Ok(b) => b,
                Err(err) => {
                    // Transient (device lost / resize in flight): skip this frame.
                    eprintln!("[display-capture] frame map failed: {err}");
                    return Ok(());
                }
            };
            let size = (width as usize) * (height as usize) * 4;
            let mut bgra = self.session.raw.take_buffer(size);
            if buffer.has_padding() {
                let _ = buffer.as_nopadding_buffer(&mut bgra);
                bgra.truncate(size);
            } else {
                let raw = buffer.as_raw_buffer();
                let n = raw.len().min(size);
                bgra[..n].copy_from_slice(&raw[..n]);
            }
            self.session.push_raw(bgra, width, height);
            self.frames += 1;
            Ok(())
        }

        fn on_closed(&mut self) -> Result<(), Self::Error> {
            eprintln!("[display-capture] capture item closed");
            self.session.request_stop();
            Ok(())
        }
    }

    fn supported(check: fn() -> Result<bool, windows_capture::graphics_capture_api::Error>) -> bool {
        check().unwrap_or(false)
    }

    pub fn start(target: &CaptureTarget, session: Arc<Session>) -> Result<Control, String> {
        if !supported(GraphicsCaptureApi::is_supported) {
            return Err("Windows Graphics Capture not supported".into());
        }

        let cursor = if supported(GraphicsCaptureApi::is_cursor_settings_supported) {
            CursorCaptureSettings::WithCursor
        } else {
            CursorCaptureSettings::Default
        };
        let secondary = if supported(GraphicsCaptureApi::is_secondary_windows_supported) {
            SecondaryWindowSettings::Include
        } else {
            SecondaryWindowSettings::Default
        };
        let fps = session.options.fps.max(1) as u64;
        let min_interval = if supported(GraphicsCaptureApi::is_minimum_update_interval_supported) {
            MinimumUpdateIntervalSettings::Custom(Duration::from_micros(1_000_000 / fps))
        } else {
            MinimumUpdateIntervalSettings::Default
        };

        // Prefer no yellow capture border; some builds refuse it, so retry with Default.
        let mut border_attempts = Vec::new();
        if supported(GraphicsCaptureApi::is_border_settings_supported) {
            border_attempts.push(DrawBorderSettings::WithoutBorder);
        }
        border_attempts.push(DrawBorderSettings::Default);

        let mut last_err = String::from("WGC start failed");
        for border in border_attempts {
            let attempt = |border| -> Result<Control, String> {
                let flags = Arc::clone(&session);
                let control = match &target.kind {
                    TargetKind::Monitor { hmonitor, .. } => {
                        let monitor = resolve_monitor(*hmonitor)?;
                        let settings = Settings::new(
                            monitor,
                            cursor,
                            border,
                            secondary,
                            min_interval,
                            DirtyRegionSettings::Default,
                            ColorFormat::Bgra8,
                            flags,
                        );
                        Handler::start_free_threaded(settings).map_err(|e| e.to_string())?
                    }
                    TargetKind::Window { hwnd } => {
                        let window = Window::from_raw_hwnd(*hwnd as *mut std::ffi::c_void);
                        if !window.is_valid() {
                            return Err("Window is not capturable".into());
                        }
                        let settings = Settings::new(
                            window,
                            cursor,
                            border,
                            secondary,
                            min_interval,
                            DirtyRegionSettings::Default,
                            ColorFormat::Bgra8,
                            flags,
                        );
                        Handler::start_free_threaded(settings).map_err(|e| e.to_string())?
                    }
                };
                Ok(Control(control))
            };
            match attempt(border) {
                Ok(control) => return Ok(control),
                Err(err) => {
                    eprintln!("[display-capture] WGC start ({border:?}) failed: {err}");
                    last_err = err;
                }
            }
        }
        Err(last_err)
    }

    fn resolve_monitor(hmonitor: isize) -> Result<Monitor, String> {
        let monitors = Monitor::enumerate().map_err(|e| e.to_string())?;
        if hmonitor != 0 {
            if let Some(m) = monitors
                .iter()
                .find(|m| (m.as_raw_hmonitor() as isize) == hmonitor
                    || (m.as_raw_hmonitor() as usize as u32) == hmonitor as u32)
            {
                return Ok(*m);
            }
        }
        Monitor::primary()
            .or_else(|_| monitors.first().copied().ok_or(()))
            .map_err(|_| "No monitor for WGC".to_string())
    }
}

// ---------------------------------------------------------------------------
// GDI fallback backend (pre-WGC Windows 10 builds)
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod gdi {
    use super::{fit_dimensions, CaptureTarget, Session, TargetKind};
    use std::sync::Arc;
    use std::thread;
    use std::time::{Duration, Instant};

    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
        ReleaseDC, SelectObject, SetStretchBltMode, StretchBlt, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS, HALFTONE, HDC, SRCCOPY,
    };
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsIconic, IsWindow};

    const PW_RENDERFULLCONTENT: PRINT_WINDOW_FLAGS = PRINT_WINDOW_FLAGS(2);

    pub fn run_loop(target: CaptureTarget, session: Arc<Session>) {
        let fps = session.options.fps.max(1) as u64;
        let interval = Duration::from_micros(1_000_000 / fps);
        while !session.stopped() {
            let t0 = Instant::now();
            let grabbed = match &target.kind {
                TargetKind::Monitor { x, y, .. } => {
                    let (ow, oh) = fit_dimensions(
                        target.width,
                        target.height,
                        session.options.max_width,
                        session.options.max_height,
                    );
                    grab_screen(*x, *y, target.width as i32, target.height as i32, ow, oh)
                }
                TargetKind::Window { hwnd } => grab_window(*hwnd, &session),
            };
            if let Some((bgra, w, h)) = grabbed {
                session.push_raw(bgra, w, h);
            }
            let spent = t0.elapsed();
            if spent < interval {
                thread::sleep(interval - spent);
            }
        }
    }

    unsafe fn read_dib(hdc: HDC, hbmp: windows::Win32::Graphics::Gdi::HBITMAP, w: i32, h: i32) -> Option<Vec<u8>> {
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0 as u32,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut pixels = vec![0u8; (w * h * 4) as usize];
        let got = GetDIBits(
            hdc,
            hbmp,
            0,
            h as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut info,
            DIB_RGB_COLORS,
        );
        if got == 0 {
            None
        } else {
            Some(pixels)
        }
    }

    fn grab_screen(x: i32, y: i32, sw: i32, sh: i32, ow: u32, oh: u32) -> Option<(Vec<u8>, u32, u32)> {
        let (dw, dh) = (ow as i32, oh as i32);
        unsafe {
            let hdc_screen = GetDC(None);
            if hdc_screen.is_invalid() {
                return None;
            }
            let hdc_mem = CreateCompatibleDC(Some(hdc_screen));
            let hbmp = CreateCompatibleBitmap(hdc_screen, dw, dh);
            let old = SelectObject(hdc_mem, hbmp.into());
            let _ = SetStretchBltMode(hdc_mem, HALFTONE);
            let ok = StretchBlt(hdc_mem, 0, 0, dw, dh, Some(hdc_screen), x, y, sw, sh, SRCCOPY).as_bool();
            let pixels = if ok { read_dib(hdc_mem, hbmp, dw, dh) } else { None };
            SelectObject(hdc_mem, old);
            let _ = DeleteObject(hbmp.into());
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            pixels.map(|p| (p, ow, oh))
        }
    }

    fn grab_window(hwnd_value: isize, session: &Session) -> Option<(Vec<u8>, u32, u32)> {
        unsafe {
            let hwnd = HWND(hwnd_value as *mut _);
            if !IsWindow(Some(hwnd)).as_bool() || IsIconic(hwnd).as_bool() {
                return None;
            }
            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect).ok()?;
            let sw = (rect.right - rect.left).max(0);
            let sh = (rect.bottom - rect.top).max(0);
            if sw < 2 || sh < 2 {
                return None;
            }
            let (ow, oh) = fit_dimensions(
                sw as u32,
                sh as u32,
                session.options.max_width,
                session.options.max_height,
            );
            let (dw, dh) = (ow as i32, oh as i32);

            let hdc_window = GetDC(Some(hwnd));
            if hdc_window.is_invalid() {
                return None;
            }
            let hdc_full = CreateCompatibleDC(Some(hdc_window));
            let hbmp_full = CreateCompatibleBitmap(hdc_window, sw, sh);
            let old_full = SelectObject(hdc_full, hbmp_full.into());
            let printed = PrintWindow(hwnd, hdc_full, PW_RENDERFULLCONTENT).as_bool();

            let mut result = None;
            if printed {
                let hdc_out = CreateCompatibleDC(Some(hdc_window));
                let hbmp_out = CreateCompatibleBitmap(hdc_window, dw, dh);
                let old_out = SelectObject(hdc_out, hbmp_out.into());
                let _ = SetStretchBltMode(hdc_out, HALFTONE);
                let ok = StretchBlt(hdc_out, 0, 0, dw, dh, Some(hdc_full), 0, 0, sw, sh, SRCCOPY).as_bool();
                if ok {
                    result = read_dib(hdc_out, hbmp_out, dw, dh).map(|p| (p, ow, oh));
                }
                SelectObject(hdc_out, old_out);
                let _ = DeleteObject(hbmp_out.into());
                let _ = DeleteDC(hdc_out);
            }
            SelectObject(hdc_full, old_full);
            let _ = DeleteObject(hbmp_full.into());
            let _ = DeleteDC(hdc_full);
            ReleaseDC(Some(hwnd), hdc_window);
            result
        }
    }
}
