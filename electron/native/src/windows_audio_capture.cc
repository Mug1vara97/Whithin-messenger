#include <napi.h>
#include <windows.h>
#include <TlHelp32.h>
#include <mmdeviceapi.h>
#include <audioclient.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <mutex>
#include <thread>
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
std::thread g_captureThread;
uint32_t g_sampleRate = 48000;
uint32_t g_channels = 2;
std::vector<int16_t> g_ringBuffer;
size_t g_ringReadPos = 0;
size_t g_ringWritePos = 0;
size_t g_ringSize = 0;

void RingInit(size_t samples) {
  g_ringBuffer.assign(samples, 0);
  g_ringReadPos = 0;
  g_ringWritePos = 0;
  g_ringSize = 0;
}

void RingPush(const int16_t* data, size_t count) {
  if (g_ringBuffer.empty() || count == 0) return;
  for (size_t i = 0; i < count; i++) {
    if (g_ringSize == g_ringBuffer.size()) {
      g_ringReadPos = (g_ringReadPos + 1) % g_ringBuffer.size();
      g_ringSize--;
    }
    g_ringBuffer[g_ringWritePos] = data[i];
    g_ringWritePos = (g_ringWritePos + 1) % g_ringBuffer.size();
    g_ringSize++;
  }
}

size_t RingPop(int16_t* dst, size_t count) {
  if (g_ringBuffer.empty() || count == 0) return 0;
  size_t copied = 0;
  while (copied < count && g_ringSize > 0) {
    dst[copied++] = g_ringBuffer[g_ringReadPos];
    g_ringReadPos = (g_ringReadPos + 1) % g_ringBuffer.size();
    g_ringSize--;
  }
  return copied;
}

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

bool ConvertToInt16Stereo(const BYTE* input, UINT32 frames, const WAVEFORMATEX* format, std::vector<int16_t>& out) {
  const uint16_t inChannels = format->nChannels > 0 ? format->nChannels : 1;
  out.resize(static_cast<size_t>(frames) * 2);

  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT && format->wBitsPerSample == 32) {
    const float* src = reinterpret_cast<const float*>(input);
    for (UINT32 i = 0; i < frames; ++i) {
      float l = src[static_cast<size_t>(i) * inChannels];
      float r = inChannels > 1 ? src[static_cast<size_t>(i) * inChannels + 1] : l;
      l = std::max(-1.0f, std::min(1.0f, l));
      r = std::max(-1.0f, std::min(1.0f, r));
      out[static_cast<size_t>(i) * 2] = static_cast<int16_t>(l * 32767.0f);
      out[static_cast<size_t>(i) * 2 + 1] = static_cast<int16_t>(r * 32767.0f);
    }
    return true;
  }

  if (format->wBitsPerSample == 16) {
    const int16_t* src = reinterpret_cast<const int16_t*>(input);
    for (UINT32 i = 0; i < frames; ++i) {
      int16_t l = src[static_cast<size_t>(i) * inChannels];
      int16_t r = inChannels > 1 ? src[static_cast<size_t>(i) * inChannels + 1] : l;
      out[static_cast<size_t>(i) * 2] = l;
      out[static_cast<size_t>(i) * 2 + 1] = r;
    }
    return true;
  }

  return false;
}

void CaptureLoop() {
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
    return;
  }

  IMMDeviceEnumerator* deviceEnum = nullptr;
  IMMDevice* device = nullptr;
  IAudioClient* audioClient = nullptr;
  IAudioCaptureClient* captureClient = nullptr;
  WAVEFORMATEX* mixFormat = nullptr;

  do {
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                          __uuidof(IMMDeviceEnumerator), reinterpret_cast<void**>(&deviceEnum));
    if (FAILED(hr)) break;

    hr = deviceEnum->GetDefaultAudioEndpoint(eRender, eConsole, &device);
    if (FAILED(hr)) break;

    hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, reinterpret_cast<void**>(&audioClient));
    if (FAILED(hr)) break;

    hr = audioClient->GetMixFormat(&mixFormat);
    if (FAILED(hr) || !mixFormat) break;

    {
      std::lock_guard<std::mutex> lock(g_stateMutex);
      g_sampleRate = mixFormat->nSamplesPerSec > 0 ? mixFormat->nSamplesPerSec : 48000;
      g_channels = 2;
      RingInit(static_cast<size_t>(g_sampleRate) * g_channels * 5);
    }

    hr = audioClient->Initialize(
      AUDCLNT_SHAREMODE_SHARED,
      AUDCLNT_STREAMFLAGS_LOOPBACK,
      0,
      0,
      mixFormat,
      nullptr
    );
    if (FAILED(hr)) break;

    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), reinterpret_cast<void**>(&captureClient));
    if (FAILED(hr)) break;

    hr = audioClient->Start();
    if (FAILED(hr)) break;

    while (g_captureActive.load()) {
      UINT32 packetFrames = 0;
      hr = captureClient->GetNextPacketSize(&packetFrames);
      if (FAILED(hr)) break;

      while (packetFrames > 0) {
        BYTE* data = nullptr;
        UINT32 numFrames = 0;
        DWORD flags = 0;
        hr = captureClient->GetBuffer(&data, &numFrames, &flags, nullptr, nullptr);
        if (FAILED(hr)) break;

        if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
          std::vector<int16_t> silence(static_cast<size_t>(numFrames) * 2, 0);
          std::lock_guard<std::mutex> lock(g_stateMutex);
          RingPush(silence.data(), silence.size());
        } else if (data && numFrames > 0) {
          std::vector<int16_t> converted;
          if (ConvertToInt16Stereo(data, numFrames, mixFormat, converted)) {
            std::lock_guard<std::mutex> lock(g_stateMutex);
            RingPush(converted.data(), converted.size());
          }
        }

        captureClient->ReleaseBuffer(numFrames);
        hr = captureClient->GetNextPacketSize(&packetFrames);
        if (FAILED(hr)) break;
      }

      Sleep(5);
    }

    audioClient->Stop();
  } while (false);

  if (captureClient) captureClient->Release();
  if (mixFormat) CoTaskMemFree(mixFormat);
  if (audioClient) audioClient->Release();
  if (device) device->Release();
  if (deviceEnum) deviceEnum->Release();
  CoUninitialize();
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
  if (g_captureActive.load()) {
    g_captureActive.store(false);
    if (g_captureThread.joinable()) {
      g_captureThread.join();
    }
  }
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_selectedSessionId = sessionId;
    g_sampleRate = 48000;
    g_channels = 2;
    RingInit(static_cast<size_t>(g_sampleRate) * g_channels * 5);
  }
  g_captureActive.store(true);
  g_captureThread = std::thread(CaptureLoop);
  return Napi::Boolean::New(env, true);
}

Napi::Value StopCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  g_captureActive.store(false);
  if (g_captureThread.joinable()) {
    g_captureThread.join();
  }
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_selectedSessionId.clear();
    RingInit(0);
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

  uint32_t sampleRate = 48000;
  uint32_t channels = 2;
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    sampleRate = g_sampleRate;
    channels = g_channels;
  }
  const size_t samples = static_cast<size_t>(frames) * channels;
  std::vector<int16_t> pcm(samples, 0);

  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    RingPop(pcm.data(), samples);
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
