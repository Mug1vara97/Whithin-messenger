#include <napi.h>
#include <windows.h>
#include <TlHelp32.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <mutex>
#include <string>
#include <vector>

namespace {

struct SessionInfo {
  std::string id;
  std::string processName;
  uint32_t pid;
  std::string displayName;
};

std::mutex g_stateMutex;
std::atomic<bool> g_captureActive{false};
std::string g_selectedSessionId;
double g_phase = 0.0;

std::vector<SessionInfo> EnumerateProcessSessions() {
  std::vector<SessionInfo> sessions;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snapshot == INVALID_HANDLE_VALUE) {
    return sessions;
  }

  PROCESSENTRY32 entry;
  entry.dwSize = sizeof(PROCESSENTRY32);
  if (Process32First(snapshot, &entry)) {
    do {
      std::string processName(entry.szExeFile);
      if (processName.empty()) {
        continue;
      }
      SessionInfo info;
      info.pid = entry.th32ProcessID;
      info.processName = processName;
      info.displayName = processName;
      info.id = std::to_string(info.pid) + ":" + processName;
      sessions.push_back(info);
    } while (Process32Next(snapshot, &entry));
  }

  CloseHandle(snapshot);

  std::sort(
      sessions.begin(), sessions.end(),
      [](const SessionInfo& a, const SessionInfo& b) { return a.processName < b.processName; });

  if (sessions.size() > 250) {
    sessions.resize(250);
  }
  return sessions;
}

Napi::Value ListAudioSessions(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<SessionInfo> sessions = EnumerateProcessSessions();
  Napi::Array result = Napi::Array::New(env, sessions.size());

  for (size_t i = 0; i < sessions.size(); ++i) {
    Napi::Object item = Napi::Object::New(env);
    item.Set("id", Napi::String::New(env, sessions[i].id));
    item.Set("pid", Napi::Number::New(env, sessions[i].pid));
    item.Set("processName", Napi::String::New(env, sessions[i].processName));
    item.Set("displayName", Napi::String::New(env, sessions[i].displayName));
    result.Set(i, item);
  }

  return result;
}

Napi::Value StartCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "sessionId is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string sessionId = info[0].As<Napi::String>().Utf8Value();
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_selectedSessionId = sessionId;
    g_phase = 0.0;
  }
  g_captureActive.store(true);
  return Napi::Boolean::New(env, true);
}

Napi::Value StopCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  g_captureActive.store(false);
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_selectedSessionId.clear();
    g_phase = 0.0;
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value ReadChunk(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  uint32_t frames = 960;
  if (info.Length() > 0 && info[0].IsNumber()) {
    frames = info[0].As<Napi::Number>().Uint32Value();
    if (frames == 0) frames = 960;
    if (frames > 4096) frames = 4096;
  }

  const uint32_t channels = 2;
  const uint32_t sampleRate = 48000;
  const size_t samples = static_cast<size_t>(frames) * channels;
  std::vector<int16_t> pcm(samples, 0);

  if (g_captureActive.load()) {
    // Placeholder transport-safe tone/silence source.
    // Replaced by WASAPI per-session PCM capture implementation.
    for (size_t i = 0; i < samples; i += channels) {
      const double value = std::sin(g_phase) * 250.0;
      const int16_t sample = static_cast<int16_t>(value);
      pcm[i] = sample;
      pcm[i + 1] = sample;
      g_phase += 2.0 * 3.14159265358979323846 * 220.0 / sampleRate;
      if (g_phase > 2.0 * 3.14159265358979323846) g_phase -= 2.0 * 3.14159265358979323846;
    }
  }

  Napi::Object chunk = Napi::Object::New(env);
  Napi::Buffer<int16_t> buf = Napi::Buffer<int16_t>::Copy(env, pcm.data(), pcm.size());
  chunk.Set("pcm", buf);
  chunk.Set("frames", Napi::Number::New(env, frames));
  chunk.Set("channels", Napi::Number::New(env, channels));
  chunk.Set("sampleRate", Napi::Number::New(env, sampleRate));
  return chunk;
}

Napi::Value GetCaptureState(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object state = Napi::Object::New(env);
  std::lock_guard<std::mutex> lock(g_stateMutex);
  state.Set("active", Napi::Boolean::New(env, g_captureActive.load()));
  state.Set("sessionId", Napi::String::New(env, g_selectedSessionId));
  return state;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("listAudioSessions", Napi::Function::New(env, ListAudioSessions));
  exports.Set("startCapture", Napi::Function::New(env, StartCapture));
  exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
  exports.Set("readChunk", Napi::Function::New(env, ReadChunk));
  exports.Set("getCaptureState", Napi::Function::New(env, GetCaptureState));
  return exports;
}

}  // namespace

NODE_API_MODULE(windows_audio_capture, Init)
