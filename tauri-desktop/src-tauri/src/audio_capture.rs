//! WASAPI process / exclude-process loopback capture (Windows).
//! Emits base64 PCM float32 chunks as `process-audio-data` events.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const SAMPLE_RATE: usize = 48_000;
const CHANNELS: usize = 2;
const CHUNK_FRAMES: usize = 960; // 20ms @ 48kHz

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChunkPayload {
    pub pcm_base64: String,
    pub channels: u16,
    pub sample_rate: u32,
}

struct CaptureInner {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

pub struct AudioCaptureManager {
    inner: Mutex<Option<CaptureInner>>,
}

impl AudioCaptureManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn is_capturing(&self) -> bool {
        self.inner.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn stop(&self) -> bool {
        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(_) => return false,
        };
        if let Some(state) = guard.take() {
            state.stop.store(true, Ordering::SeqCst);
            if let Some(handle) = state.handle {
                let _ = handle.join();
            }
            true
        } else {
            false
        }
    }

    pub fn start(&self, app: AppHandle, pid: u32, exclude: bool) -> Result<bool, String> {
        if pid == 0 {
            return Err("Invalid process id".into());
        }

        self.stop();

        let stop = Arc::new(AtomicBool::new(false));
        let stop_thread = Arc::clone(&stop);

        let handle = thread::Builder::new()
            .name("wasapi-capture".into())
            .spawn(move || {
                if let Err(err) = run_capture_loop(app, pid, exclude, stop_thread) {
                    eprintln!("[process-audio] capture loop error: {err}");
                }
            })
            .map_err(|e| format!("Failed to spawn capture thread: {e}"))?;

        *self.inner.lock().map_err(|e| e.to_string())? = Some(CaptureInner {
            stop,
            handle: Some(handle),
        });

        Ok(true)
    }
}

fn run_capture_loop(
    app: AppHandle,
    pid: u32,
    exclude: bool,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        use wasapi::*;

        let _ = initialize_mta();

        // include_tree=true  → INCLUDE target process tree (window audio)
        // include_tree=false → EXCLUDE target process tree (system audio minus self)
        let include_tree = !exclude;

        let desired = WaveFormat::new(32, 32, &SampleType::Float, SAMPLE_RATE, CHANNELS, None);
        let blockalign = desired.get_blockalign() as usize;

        let mut audio_client = AudioClient::new_application_loopback_client(pid, include_tree)
            .map_err(|e| format!("Failed to create loopback client (pid={pid}, exclude={exclude}): {e}"))?;

        let mode = StreamMode::EventsShared {
            autoconvert: true,
            buffer_duration_hns: 0,
        };
        audio_client
            .initialize_client(&desired, &Direction::Capture, &mode)
            .map_err(|e| format!("initialize_client failed: {e}"))?;

        let h_event = audio_client
            .set_get_eventhandle()
            .map_err(|e| format!("set_get_eventhandle failed: {e}"))?;
        let capture_client = audio_client
            .get_audiocaptureclient()
            .map_err(|e| format!("get_audiocaptureclient failed: {e}"))?;

        let mut sample_queue: VecDeque<u8> = VecDeque::with_capacity(blockalign * CHUNK_FRAMES * 4);
        let chunk_bytes = blockalign * CHUNK_FRAMES;

        audio_client
            .start_stream()
            .map_err(|e| format!("start_stream failed: {e}"))?;

        while !stop.load(Ordering::SeqCst) {
            while sample_queue.len() >= chunk_bytes {
                let mut chunk = vec![0u8; chunk_bytes];
                for byte in chunk.iter_mut() {
                    *byte = sample_queue.pop_front().unwrap_or(0);
                }
                let payload = AudioChunkPayload {
                    pcm_base64: B64.encode(&chunk),
                    channels: CHANNELS as u16,
                    sample_rate: SAMPLE_RATE as u32,
                };
                let _ = app.emit("process-audio-data", payload);
            }

            let new_frames = capture_client
                .get_next_packet_size()
                .map_err(|e| format!("get_next_packet_size failed: {e}"))?
                .unwrap_or(0);

            if new_frames > 0 {
                let need = new_frames as usize * blockalign;
                let additional = need.saturating_sub(sample_queue.capacity() - sample_queue.len());
                sample_queue.reserve(additional);
                capture_client
                    .read_from_device_to_deque(&mut sample_queue)
                    .map_err(|e| format!("read_from_device_to_deque failed: {e}"))?;
            }

            if h_event.wait_for_event(50).is_err() {
                // timeout is normal when silent; keep looping until stop
            }
        }

        let _ = audio_client.stop_stream();
        Ok(())
    }

    #[cfg(not(windows))]
    {
        let _ = (app, pid, exclude, stop);
        Err("Process audio capture is only supported on Windows".into())
    }
}
