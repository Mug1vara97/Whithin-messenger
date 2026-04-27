#include <napi.h>
#include <windows.h>

#include <atomic>
#include <mutex>
#include <string>

namespace {

std::mutex g_overlayMutex;
std::atomic<bool> g_attached{false};
std::atomic<bool> g_visible{false};
uint32_t g_targetPid = 0;
std::string g_lastStateJson = "{}";

Napi::Value Attach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "pid is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  uint32_t pid = info[0].As<Napi::Number>().Uint32Value();
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!process) {
    return Napi::Boolean::New(env, false);
  }
  CloseHandle(process);

  std::lock_guard<std::mutex> lock(g_overlayMutex);
  g_targetPid = pid;
  g_attached.store(true);
  g_visible.store(true);
  return Napi::Boolean::New(env, true);
}

Napi::Value Detach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::lock_guard<std::mutex> lock(g_overlayMutex);
  g_targetPid = 0;
  g_attached.store(false);
  g_visible.store(false);
  return Napi::Boolean::New(env, true);
}

Napi::Value Toggle(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_attached.load()) {
    return Napi::Boolean::New(env, false);
  }
  g_visible.store(!g_visible.load());
  return Napi::Boolean::New(env, g_visible.load());
}

Napi::Value SetVisible(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsBoolean()) {
    Napi::TypeError::New(env, "visible flag is required").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (!g_attached.load()) {
    return Napi::Boolean::New(env, false);
  }
  g_visible.store(info[0].As<Napi::Boolean>().Value());
  return Napi::Boolean::New(env, true);
}

Napi::Value SetState(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "state payload is required").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::lock_guard<std::mutex> lock(g_overlayMutex);
  g_lastStateJson = info[0].As<Napi::String>().Utf8Value();
  return Napi::Boolean::New(env, true);
}

Napi::Value Status(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("attached", Napi::Boolean::New(env, g_attached.load()));
  obj.Set("visible", Napi::Boolean::New(env, g_visible.load()));
  {
    std::lock_guard<std::mutex> lock(g_overlayMutex);
    obj.Set("pid", Napi::Number::New(env, g_targetPid));
    obj.Set("stateJson", Napi::String::New(env, g_lastStateJson));
  }
  return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("attach", Napi::Function::New(env, Attach));
  exports.Set("detach", Napi::Function::New(env, Detach));
  exports.Set("toggle", Napi::Function::New(env, Toggle));
  exports.Set("setVisible", Napi::Function::New(env, SetVisible));
  exports.Set("setState", Napi::Function::New(env, SetState));
  exports.Set("status", Napi::Function::New(env, Status));
  return exports;
}

}  // namespace

NODE_API_MODULE(game_overlay, Init)
