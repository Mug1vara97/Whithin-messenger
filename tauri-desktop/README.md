# Whithin Desktop — Tauri

Параллельная оболочка к Electron (`/electron`). **Electron не удаляем** — оба варианта живут рядом.

## Что это

Tauri 2 загружает тот же React-клиент, что и Electron:

| Режим | URL |
| --- | --- |
| `npm run dev` | `http://localhost:5173` (Vite) |
| `npm run dev:remote` | `https://whithin.ru` |
| production build | `https://whithin.ru` (или `WEB_CLIENT_URL`) |

Переопределение: `WEB_CLIENT_URL=...`

## Screen share со звуком (Windows)

1. Кастомный пикер (`chooseScreenSource`) — экраны/окна, звук, камера
2. Видео — собственная реализация `getDisplayMedia` (системный пикер Windows не
   показывается): Windows Graphics Capture (GPU, курсор, перекрытые окна) →
   SIMD‑ресайз + JPEG (`display_capture.rs`) → бинарный WebSocket на
   `127.0.0.1` → в WebView Web Worker декодирует через `ImageDecoder`
   (WebCodecs) и пишет `VideoFrame` в `MediaStreamTrackGenerator`. Разрешение и
   fps берутся из constraints (по умолчанию до 1280×720, ideal 60 fps →
   ограничено 60). Fallback‑цепочка: worker → main‑thread generator →
   `canvas.captureStream` → polling `whithin-asset://`; при отсутствии WGC —
   GDI‑захват в тот же пайплайн.
3. Звук — WASAPI process loopback / exclude-self по выбору из кастомного пикера

## Требования (Windows)

1. **Rust** — `rustup` (stable)
2. **WebView2** — обычно уже есть на Win10/11
3. **MSVC Build Tools** — Visual Studio C++ workload (как для native Node-модулей)
4. Node.js 20+
5. Windows 10+ (для process loopback audio)

## Запуск

```bash
# терминал 1 — клиент
cd WhithinMessenger.Client
npm run dev

# терминал 2 — Tauri
cd tauri-desktop
npm install
npm run icon          # один раз: иконки из app-icon.png
npm run dev           # localhost:5173
# или (прод, без локального Vite; сам поднимает MSVC env)
npm run dev:remote    # https://whithin.ru
```

`dev:remote` подменяет `devUrl` и через `scripts/with-msvc.ps1` берёт VS 2022 Build Tools
(у VS 18 Community часто нет `msvcrt.lib`).

Если окружение уже настроено (x64 Native Tools), можно:
`npm run dev:remote:raw`

Сборка установщика:

```bash
cd tauri-desktop
npm run build
```

Артефакты: `src-tauri/target/release/bundle/`

## Electron vs Tauri (сейчас)

| | Electron (`/electron`) | Tauri (`/tauri-desktop`) |
| --- | --- | --- |
| UI | React (тот же клиент) | React (тот же клиент) |
| Shell | Chromium | системный WebView |
| Screen share + звук | desktopCapturer + process-audio-capture | пикер + WGC→WebCodecs MediaStream + WASAPI |
| Трей / оверлеи / нотификации | уже есть | ещё нет |
| E2E keychain | TODO | TODO |

## План дальше

1. Трей + нотификации (`tauri-plugin-notification`)
2. Deep links / protocol `whithin://`
3. Оверлеи звонка
4. Safe storage для E2E-ключей
