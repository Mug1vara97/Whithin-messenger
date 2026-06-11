using System.Net;
using System.Text;
using System.Text.Json;

namespace Whithin.AudioBridge;

public sealed class BridgeHttpServer : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly AudioMixerBridge _bridge = new();
    private readonly HttpListener _listener = new();
    private readonly CancellationTokenSource _cts = new();
    private Task? _listenTask;
    private CancellationTokenSource? _screenShareStreamCts;

    public int Port { get; private set; }

    public void Start(int port)
    {
        Port = port;
        _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        try
        {
            _listener.Start();
        }
        catch (HttpListenerException ex)
        {
            throw new InvalidOperationException(
                $"Port {port} is already in use. Close other Whithin.AudioBridge.exe instances and restart Whithin.",
                ex);
        }

        _listenTask = Task.Run(() => ListenLoopAsync(_cts.Token));
        Console.WriteLine($"{{\"event\":\"ready\",\"port\":{port}}}");
    }

    private async Task ListenLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            HttpListenerContext context;
            try
            {
                context = await _listener.GetContextAsync().WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error);
                continue;
            }

            _ = Task.Run(() => HandleRequestAsync(context), cancellationToken);
        }
    }

    private async Task HandleRequestAsync(HttpListenerContext context)
    {
        try
        {
            var request = context.Request;
            var response = context.Response;
            var path = request.Url?.AbsolutePath?.TrimEnd('/') ?? string.Empty;

            Console.WriteLine($"[Soundpad] HTTP {request.HttpMethod} {path}");

            switch ($"{request.HttpMethod} {path}")
            {
                case "GET /devices":
                    await WriteJsonAsync(response, new
                    {
                        inputs = DeviceEnumerator.ListCaptureDevices(),
                        outputs = DeviceEnumerator.ListRenderDevices(),
                    });
                    break;

                case "GET /status":
                    await WriteJsonAsync(response, new
                    {
                        running = _bridge.IsRunning,
                        captureDevice = _bridge.CaptureDeviceName,
                        renderDevice = _bridge.RenderDeviceName,
                    });
                    break;

                case "POST /bridge/start":
                {
                    var body = await ReadBodyAsync(request);
                    var payload = JsonSerializer.Deserialize<StartBridgeRequest>(body, JsonOptions);
                    _bridge.Start(payload?.CaptureDeviceId, payload?.RenderDeviceId);
                    await WriteJsonAsync(response, new { ok = true });
                    break;
                }

                case "POST /bridge/stop":
                    _bridge.Stop();
                    await WriteJsonAsync(response, new { ok = true });
                    break;

                case "POST /play":
                {
                    var body = await ReadBodyAsync(request);
                    var payload = JsonSerializer.Deserialize<PlayRequest>(body, JsonOptions);
                    if (string.IsNullOrWhiteSpace(payload?.FilePath))
                    {
                        response.StatusCode = 400;
                        await WriteJsonAsync(response, new { ok = false, error = "filePath is required" });
                        break;
                    }

                    var playInfo = _bridge.PlayFile(payload.FilePath, payload.Volume ?? 1f);
                    await WriteJsonAsync(response, new
                    {
                        ok = true,
                        sampleCount = playInfo.SampleCount,
                        durationSeconds = playInfo.DurationSeconds,
                        filePath = playInfo.FilePath,
                    });
                    break;
                }

                case "POST /play/stop":
                    _bridge.StopPlayback();
                    await WriteJsonAsync(response, new { ok = true });
                    break;

                case "GET /default-capture/status":
                {
                    var status = DefaultCaptureDeviceSwitcher.GetStatus();
                    await WriteJsonAsync(response, new
                    {
                        active = status.Active,
                        savedDeviceId = status.SavedDeviceId,
                        currentDeviceId = status.CurrentDeviceId,
                        cableOutputDeviceId = status.CableOutputDeviceId,
                        cableOutputDeviceName = status.CableOutputDeviceName,
                    });
                    break;
                }

                case "POST /default-capture/activate":
                {
                    var body = await ReadBodyAsync(request);
                    var payload = string.IsNullOrWhiteSpace(body)
                        ? null
                        : JsonSerializer.Deserialize<ActivateDefaultCaptureRequest>(body, JsonOptions);
                    var result = DefaultCaptureDeviceSwitcher.Activate(payload?.DeviceId);
                    if (!result.Ok)
                    {
                        response.StatusCode = 400;
                        await WriteJsonAsync(response, new { ok = false, error = result.Error });
                        break;
                    }

                    await WriteJsonAsync(response, new
                    {
                        ok = true,
                        previousDeviceId = result.PreviousDeviceId,
                        targetDeviceId = result.TargetDeviceId,
                    });
                    break;
                }

                case "POST /default-capture/restore":
                {
                    var result = DefaultCaptureDeviceSwitcher.Restore();
                    await WriteJsonAsync(response, new { ok = result.Ok });
                    break;
                }

                case "GET /default-render/status":
                {
                    var status = DefaultRenderDeviceSwitcher.GetStatus();
                    await WriteJsonAsync(response, new
                    {
                        active = status.Active,
                        callAudioOutputDeviceId = status.CallAudioOutputDeviceId,
                        callAudioOutputDeviceName = status.CallAudioOutputDeviceName,
                        currentMultimediaDeviceId = status.CurrentMultimediaDeviceId,
                        cableInputDeviceId = status.CableInputDeviceId,
                        cableInputDeviceName = status.CableInputDeviceName,
                    });
                    break;
                }

                case "POST /default-render/activate":
                {
                    var body = await ReadBodyAsync(request);
                    var payload = string.IsNullOrWhiteSpace(body)
                        ? null
                        : JsonSerializer.Deserialize<ActivateDefaultRenderRequest>(body, JsonOptions);
                    var result = DefaultRenderDeviceSwitcher.Activate(payload?.DeviceId);
                    if (!result.Ok)
                    {
                        response.StatusCode = 400;
                        await WriteJsonAsync(response, new { ok = false, error = result.Error });
                        break;
                    }

                    await WriteJsonAsync(response, new
                    {
                        ok = true,
                        callAudioOutputDeviceId = result.CallAudioOutputDeviceId,
                        callAudioOutputDeviceName = result.CallAudioOutputDeviceName,
                        targetDeviceId = result.TargetDeviceId,
                        targetDeviceName = result.TargetDeviceName,
                    });
                    break;
                }

                case "POST /default-render/restore":
                {
                    var result = DefaultRenderDeviceSwitcher.Restore();
                    await WriteJsonAsync(response, new { ok = result.Ok });
                    break;
                }

                case "POST /screen-share-loopback/start":
                {
                    var body = await ReadBodyAsync(request);
                    var payload = string.IsNullOrWhiteSpace(body)
                        ? null
                        : JsonSerializer.Deserialize<ScreenShareLoopbackRequest>(body, JsonOptions);
                    CableInputLoopbackHub.Instance.EnableScreenShare(payload?.RenderDeviceId);
                    await WriteJsonAsync(response, new
                    {
                        ok = true,
                        sampleRate = CableInputLoopbackHub.Instance.ScreenShareSampleRate,
                        channels = CableInputLoopbackHub.Instance.ScreenShareChannels,
                        deviceName = DeviceEnumerator.FindCableInputDevice()?.Name,
                    });
                    break;
                }

                case "POST /screen-share-loopback/stop":
                    _screenShareStreamCts?.Cancel();
                    CableInputLoopbackHub.Instance.DisableScreenShare();
                    await WriteJsonAsync(response, new { ok = true });
                    break;

                case "GET /screen-share-loopback/stream":
                {
                    CableInputLoopbackHub.Instance.EnableScreenShare();

                    AddCorsHeaders(response);
                    response.StatusCode = 200;
                    response.ContentType = "application/octet-stream";
                    response.SendChunked = true;
                    response.AddHeader("X-Audio-Sample-Rate", CableInputLoopbackHub.Instance.ScreenShareSampleRate.ToString());
                    response.AddHeader("X-Audio-Channels", CableInputLoopbackHub.Instance.ScreenShareChannels.ToString());
                    response.AddHeader("X-Audio-Format", "pcm-s16le");

                    _screenShareStreamCts?.Cancel();
                    _screenShareStreamCts = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token);
                    try
                    {
                        await CableInputLoopbackHub.Instance.StreamScreenSharePcmAsync(
                            response.OutputStream,
                            _screenShareStreamCts.Token);
                    }
                    catch (OperationCanceledException)
                    {
                        // expected when client disconnects or capture stops
                    }
                    finally
                    {
                        response.OutputStream.Close();
                    }

                    break;
                }

                default:
                    response.StatusCode = 404;
                    await WriteJsonAsync(response, new { ok = false, error = "not found" });
                    break;
            }
        }
        catch (Exception error)
        {
            try
            {
                context.Response.StatusCode = 500;
                await WriteJsonAsync(context.Response, new { ok = false, error = error.Message });
            }
            catch
            {
                // ignored
            }
        }
    }

    private static async Task<string> ReadBodyAsync(HttpListenerRequest request)
    {
        using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
        return await reader.ReadToEndAsync();
    }

    private static void AddCorsHeaders(HttpListenerResponse response)
    {
        response.AddHeader("Access-Control-Allow-Origin", "*");
        response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.AddHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    private static async Task WriteJsonAsync(HttpListenerResponse response, object payload)
    {
        AddCorsHeaders(response);
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        response.ContentType = "application/json; charset=utf-8";
        response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes);
        response.OutputStream.Close();
    }

    public void Dispose()
    {
        _cts.Cancel();
        _screenShareStreamCts?.Cancel();
        CableInputLoopbackHub.Instance.DisableMonitor();
        CableInputLoopbackHub.Instance.DisableScreenShare();
        _bridge.Dispose();
        _listener.Stop();
        _listener.Close();
    }

    private sealed record StartBridgeRequest(string? CaptureDeviceId, string? RenderDeviceId);

    private sealed record PlayRequest(string? FilePath, float? Volume);

    private sealed record ActivateDefaultCaptureRequest(string? DeviceId);

    private sealed record ActivateDefaultRenderRequest(string? DeviceId);

    private sealed record ScreenShareLoopbackRequest(string? RenderDeviceId);
}
