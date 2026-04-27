#include <napi.h>
#include <windows.h>
#include <TlHelp32.h>
#include <audioclient.h>
#include <mmreg.h>
#include <ks.h>
#include <ksmedia.h>
#include <Mmdeviceapi.h>
#include <audioclientactivationparams.h>
#include <functiondiscoverykeys_devpkey.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <mutex>
#include <thread>
#include <string>
#include <vector>

namespace {

using ActivateAudioInterfaceAsyncFn = HRESULT(WINAPI*)(
  LPCWSTR,
  REFIID,
  PROPVARIANT*,
  IActivateAudioInterfaceCompletionHandler*,
  IActivateAudioInterfaceAsyncOperation**
);

struct SessionInfo {
  std::string id;
  std::string processName;
  uint32_t pid;
  std::string displayName;
};

std::mutex g_stateMutex;
std::atomic<bool> g_captureActive{false};
std::string g_selectedSessionId;
uint32_t g_selectedPid = 0;
std::thread g_captureThread;
uint32_t g_sampleRate = 48000;
uint32_t g_channels = 1;
std::vector<int16_t> g_ringBuffer;
size_t g_ringReadPos = 0;
size_t g_ringWritePos = 0;
size_t g_ringSize = 0;

class ActivateAudioInterfaceHandler : public IActivateAudioInterfaceCompletionHandler {
 public:
  ActivateAudioInterfaceHandler() : refCount_(1), activateResult_(E_FAIL), audioClient_(nullptr) {
    completedEvent_ = CreateEvent(nullptr, FALSE, FALSE, nullptr);
  }

  virtual ~ActivateAudioInterfaceHandler() {
    if (audioClient_) {
      audioClient_->Release();
      audioClient_ = nullptr;
    }
    if (completedEvent_) {
      CloseHandle(completedEvent_);
      completedEvent_ = nullptr;
    }
  }

  HRESULT Wait(DWORD timeoutMs) {
    if (!completedEvent_) return E_FAIL;
    DWORD waitResult = WaitForSingleObject(completedEvent_, timeoutMs);
    if (waitResult != WAIT_OBJECT_0) {
      return HRESULT_FROM_WIN32(ERROR_TIMEOUT);
    }
    return activateResult_;
  }

  IAudioClient* DetachAudioClient() {
    IAudioClient* result = audioClient_;
    audioClient_ = nullptr;
    return result;
  }

  STDMETHODIMP ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override {
    if (!operation) {
      activateResult_ = E_POINTER;
    } else {
      IUnknown* activatedInterface = nullptr;
      activateResult_ = operation->GetActivateResult(&activateResult_, &activatedInterface);
      if (SUCCEEDED(activateResult_) && activatedInterface) {
        activateResult_ = activatedInterface->QueryInterface(__uuidof(IAudioClient), reinterpret_cast<void**>(&audioClient_));
        activatedInterface->Release();
      }
    }
    if (completedEvent_) {
      SetEvent(completedEvent_);
    }
    return S_OK;
  }

  STDMETHODIMP QueryInterface(REFIID iid, void** obj) override {
    if (!obj) return E_POINTER;
    if (iid == __uuidof(IUnknown) || iid == __uuidof(IActivateAudioInterfaceCompletionHandler)) {
      *obj = static_cast<IActivateAudioInterfaceCompletionHandler*>(this);
      AddRef();
      return S_OK;
    }
    *obj = nullptr;
    return E_NOINTERFACE;
  }

  STDMETHODIMP_(ULONG) AddRef() override { return static_cast<ULONG>(InterlockedIncrement(&refCount_)); }
  STDMETHODIMP_(ULONG) Release() override {
    ULONG refs = static_cast<ULONG>(InterlockedDecrement(&refCount_));
    if (refs == 0) {
      delete this;
    }
    return refs;
  }

 private:
  long refCount_;
  HANDLE completedEvent_;
  HRESULT activateResult_;
  IAudioClient* audioClient_;
};

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

uint32_t ExtractPidFromSessionId(const std::string& sessionId) {
  const size_t sep = sessionId.find(':');
  if (sep == std::string::npos) {
    return 0;
  }
  try {
    return static_cast<uint32_t>(std::stoul(sessionId.substr(0, sep)));
  } catch (...) {
    return 0;
  }
}

bool ConvertToInt16Mono(const BYTE* input, UINT32 frames, const WAVEFORMATEX* format, std::vector<int16_t>& out) {
  const uint16_t inChannels = format->nChannels > 0 ? format->nChannels : 1;
  uint16_t bitsPerSample = format->wBitsPerSample;
  bool isFloat = false;

  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    isFloat = true;
  } else if (format->wFormatTag == WAVE_FORMAT_EXTENSIBLE) {
    const auto* ext = reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
    bitsPerSample = ext->Samples.wValidBitsPerSample ? ext->Samples.wValidBitsPerSample : ext->Format.wBitsPerSample;
    if (ext->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) {
      isFloat = true;
    } else if (ext->SubFormat == KSDATAFORMAT_SUBTYPE_PCM) {
      isFloat = false;
    } else {
      return false;
    }
  }

  out.resize(static_cast<size_t>(frames));

  if (isFloat && bitsPerSample == 32) {
    const float* src = reinterpret_cast<const float*>(input);
    for (UINT32 i = 0; i < frames; ++i) {
      float l = src[static_cast<size_t>(i) * inChannels];
      float r = inChannels > 1 ? src[static_cast<size_t>(i) * inChannels + 1] : l;
      float m = (l + r) * 0.5f;
      m = std::max(-1.0f, std::min(1.0f, m));
      out[static_cast<size_t>(i)] = static_cast<int16_t>(m * 32767.0f);
    }
    return true;
  }

  if (!isFloat && bitsPerSample == 16) {
    const int16_t* src = reinterpret_cast<const int16_t*>(input);
    for (UINT32 i = 0; i < frames; ++i) {
      int16_t l = src[static_cast<size_t>(i) * inChannels];
      int16_t r = inChannels > 1 ? src[static_cast<size_t>(i) * inChannels + 1] : l;
      out[static_cast<size_t>(i)] = static_cast<int16_t>((static_cast<int32_t>(l) + static_cast<int32_t>(r)) / 2);
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

  IAudioClient* audioClient = nullptr;
  IAudioCaptureClient* captureClient = nullptr;
  WAVEFORMATEX* mixFormat = nullptr;
  IActivateAudioInterfaceAsyncOperation* asyncOp = nullptr;

  do {
    uint32_t pid = 0;
    {
      std::lock_guard<std::mutex> lock(g_stateMutex);
      pid = g_selectedPid;
    }
    if (pid == 0) break;

    AUDIOCLIENT_ACTIVATION_PARAMS activationParams = {};
    activationParams.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    activationParams.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;
    activationParams.ProcessLoopbackParams.TargetProcessId = pid;

    PROPVARIANT activateParamsVariant;
    PropVariantInit(&activateParamsVariant);
    activateParamsVariant.vt = VT_BLOB;
    activateParamsVariant.blob.cbSize = sizeof(activationParams);
    activateParamsVariant.blob.pBlobData = reinterpret_cast<BYTE*>(&activationParams);

    auto* completionHandler = new ActivateAudioInterfaceHandler();
    HMODULE mmdevapi = LoadLibraryW(L"Mmdevapi.dll");
    if (!mmdevapi) {
      completionHandler->Release();
      break;
    }

    auto activateAudioInterfaceAsyncFn =
      reinterpret_cast<ActivateAudioInterfaceAsyncFn>(GetProcAddress(mmdevapi, "ActivateAudioInterfaceAsync"));
    if (!activateAudioInterfaceAsyncFn) {
      FreeLibrary(mmdevapi);
      completionHandler->Release();
      break;
    }

    hr = activateAudioInterfaceAsyncFn(
      VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
      __uuidof(IAudioClient),
      &activateParamsVariant,
      completionHandler,
      &asyncOp
    );
    FreeLibrary(mmdevapi);
    if (FAILED(hr)) {
      completionHandler->Release();
      break;
    }

    hr = completionHandler->Wait(8000);
    if (SUCCEEDED(hr)) {
      audioClient = completionHandler->DetachAudioClient();
    }
    completionHandler->Release();
    if (FAILED(hr) || !audioClient) {
      break;
    }

    hr = audioClient->GetMixFormat(&mixFormat);
    if (FAILED(hr)) break;
    if (!mixFormat) break;

    {
      std::lock_guard<std::mutex> lock(g_stateMutex);
      g_sampleRate = mixFormat->nSamplesPerSec > 0 ? mixFormat->nSamplesPerSec : 48000;
      g_channels = 1;
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
          std::vector<int16_t> silence(static_cast<size_t>(numFrames) * g_channels, 0);
          std::lock_guard<std::mutex> lock(g_stateMutex);
          RingPush(silence.data(), silence.size());
        } else if (data && numFrames > 0) {
          std::vector<int16_t> converted;
          if (ConvertToInt16Mono(data, numFrames, mixFormat, converted)) {
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
  if (asyncOp) asyncOp->Release();
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
  uint32_t pid = ExtractPidFromSessionId(sessionId);
  if (pid == 0) {
    Napi::Error::New(env, "Invalid sessionId, pid is required").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (g_captureActive.load()) {
    g_captureActive.store(false);
    if (g_captureThread.joinable()) {
      g_captureThread.join();
    }
  }
  {
    std::lock_guard<std::mutex> lock(g_stateMutex);
    g_selectedSessionId = sessionId;
    g_selectedPid = pid;
    g_sampleRate = 48000;
    g_channels = 1;
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
    g_selectedPid = 0;
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
  uint32_t channels = 1;
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
