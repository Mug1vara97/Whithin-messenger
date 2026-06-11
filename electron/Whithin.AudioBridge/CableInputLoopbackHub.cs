using System.Collections.Concurrent;
using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace Whithin.AudioBridge;

/// <summary>
/// Single WASAPI loopback on CABLE Input, fan-out to:
/// 1) physical speakers (so the user hears system/game audio)
/// 2) screen-share PCM stream (participants hear demo, not call echo)
/// </summary>
public sealed class CableInputLoopbackHub : IDisposable
{
    private const int PcmSampleRate = 48000;
    private const int PcmChannels = 2;

    private static readonly Lazy<CableInputLoopbackHub> Shared = new(() => new CableInputLoopbackHub());

    public static CableInputLoopbackHub Instance => Shared.Value;

    private readonly object _gate = new();
    private readonly ConcurrentQueue<byte[]> _screenSharePcm = new();

    private WasapiLoopbackCapture? _capture;
    private WasapiOut? _monitorOutput;
    private BufferedWaveProvider? _monitorBuffer;
    private string? _cableDeviceId;
    private string? _monitorDeviceId;
    private bool _monitorEnabled;
    private bool _screenShareEnabled;

    public bool IsCaptureRunning
    {
        get
        {
            lock (_gate)
            {
                return _capture != null;
            }
        }
    }

    public int ScreenShareSampleRate => PcmSampleRate;

    public int ScreenShareChannels => PcmChannels;

    public void EnableMonitor(string monitorRenderDeviceId, string? cableRenderDeviceId = null)
    {
        lock (_gate)
        {
            _monitorEnabled = true;
            _monitorDeviceId = monitorRenderDeviceId;
            if (!string.IsNullOrWhiteSpace(cableRenderDeviceId))
            {
                _cableDeviceId = cableRenderDeviceId;
            }

            EnsureCaptureLocked();
            EnsureMonitorLocked();
        }
    }

    public void DisableMonitor()
    {
        lock (_gate)
        {
            _monitorEnabled = false;
            _monitorDeviceId = null;
            StopMonitorLocked();
            StopCaptureIfIdleLocked();
        }
    }

    public void EnableScreenShare(string? cableRenderDeviceId = null)
    {
        lock (_gate)
        {
            _screenShareEnabled = true;
            if (!string.IsNullOrWhiteSpace(cableRenderDeviceId))
            {
                _cableDeviceId = cableRenderDeviceId;
            }

            while (_screenSharePcm.TryDequeue(out _))
            {
            }

            EnsureCaptureLocked();
        }
    }

    public void DisableScreenShare()
    {
        lock (_gate)
        {
            _screenShareEnabled = false;
            while (_screenSharePcm.TryDequeue(out _))
            {
            }

            StopCaptureIfIdleLocked();
        }
    }

    public async Task StreamScreenSharePcmAsync(Stream output, CancellationToken cancellationToken)
    {
        var silence = new byte[PcmSampleRate * PcmChannels * 2 / 20];
        while (!cancellationToken.IsCancellationRequested)
        {
            lock (_gate)
            {
                if (!_screenShareEnabled)
                {
                    break;
                }
            }

            if (_screenSharePcm.TryDequeue(out var chunk))
            {
                await output.WriteAsync(chunk, cancellationToken);
                continue;
            }

            await output.WriteAsync(silence, cancellationToken);
            await Task.Delay(10, cancellationToken);
        }
    }

    private void EnsureCaptureLocked()
    {
        if (_capture != null)
        {
            return;
        }

        var cableDevice = DeviceEnumerator.FindRenderDevice(_cableDeviceId)
            ?? throw new InvalidOperationException("CABLE Input not found.");

        _cableDeviceId = cableDevice.ID;
        _capture = new WasapiLoopbackCapture(cableDevice);
        _capture.DataAvailable += OnDataAvailable;
        _capture.StartRecording();

        Console.WriteLine(
            $"[Soundpad] CABLE Input loopback hub started on \"{cableDevice.FriendlyName}\" ({_capture.WaveFormat.SampleRate}Hz/{_capture.WaveFormat.Channels}ch)");
    }

    private void EnsureMonitorLocked()
    {
        if (!_monitorEnabled || string.IsNullOrWhiteSpace(_monitorDeviceId) || _capture == null)
        {
            return;
        }

        if (_monitorOutput != null)
        {
            return;
        }

        using var enumerator = new MMDeviceEnumerator();
        var monitorDevice = enumerator.GetDevice(_monitorDeviceId);
        _monitorBuffer = new BufferedWaveProvider(_capture.WaveFormat)
        {
            BufferDuration = TimeSpan.FromSeconds(3),
            DiscardOnBufferOverflow = true,
        };

        _monitorOutput = new WasapiOut(monitorDevice, AudioClientShareMode.Shared, false, 50);
        _monitorOutput.Init(_monitorBuffer);
        _monitorOutput.Play();

        Console.WriteLine($"[Soundpad] CABLE monitor playback on \"{monitorDevice.FriendlyName}\"");
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs args)
    {
        if (args.BytesRecorded <= 0 || _capture == null)
        {
            return;
        }

        lock (_gate)
        {
            if (_monitorEnabled && _monitorBuffer != null)
            {
                _monitorBuffer.AddSamples(args.Buffer, 0, args.BytesRecorded);
            }
        }

        if (_screenShareEnabled)
        {
            var pcm = ConvertToScreenSharePcm(args.Buffer, args.BytesRecorded, _capture.WaveFormat);
            if (pcm.Length > 0)
            {
                _screenSharePcm.Enqueue(pcm);
            }
        }
    }

    private static byte[] ConvertToScreenSharePcm(byte[] buffer, int bytesRecorded, WaveFormat sourceFormat)
    {
        if (sourceFormat.Encoding == WaveFormatEncoding.IeeeFloat)
        {
            return ConvertFloatToInt16Pcm(buffer, bytesRecorded, sourceFormat.Channels);
        }

        if (sourceFormat.Encoding == WaveFormatEncoding.Pcm &&
            sourceFormat.BitsPerSample == 16 &&
            sourceFormat.SampleRate == PcmSampleRate &&
            sourceFormat.Channels == PcmChannels)
        {
            var copy = new byte[bytesRecorded];
            Buffer.BlockCopy(buffer, 0, copy, 0, bytesRecorded);
            return copy;
        }

        return Array.Empty<byte>();
    }

    private static byte[] ConvertFloatToInt16Pcm(byte[] buffer, int bytesRecorded, int channels)
    {
        var floatCount = bytesRecorded / sizeof(float);
        var frameCount = floatCount / Math.Max(channels, 1);
        var output = new byte[frameCount * PcmChannels * sizeof(short)];

        for (var frame = 0; frame < frameCount; frame++)
        {
            for (var channel = 0; channel < PcmChannels; channel++)
            {
                var sourceChannel = channel < channels ? channel : 0;
                var sampleIndex = frame * channels + sourceChannel;
                var sample = BitConverter.ToSingle(buffer, sampleIndex * sizeof(float));
                sample = Math.Clamp(sample, -1f, 1f);
                var intSample = (short)(sample * short.MaxValue);
                var outputIndex = (frame * PcmChannels + channel) * sizeof(short);
                BitConverter.TryWriteBytes(output.AsSpan(outputIndex, sizeof(short)), intSample);
            }
        }

        return output;
    }

    private void StopMonitorLocked()
    {
        if (_monitorOutput != null)
        {
            try
            {
                _monitorOutput.Stop();
            }
            catch
            {
                // ignored
            }

            _monitorOutput.Dispose();
            _monitorOutput = null;
        }

        _monitorBuffer = null;
    }

    private void StopCaptureIfIdleLocked()
    {
        if (_monitorEnabled || _screenShareEnabled || _capture == null)
        {
            return;
        }

        try
        {
            _capture.DataAvailable -= OnDataAvailable;
            _capture.StopRecording();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] CABLE loopback hub stop warning: {ex.Message}");
        }
        finally
        {
            _capture.Dispose();
            _capture = null;
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            _monitorEnabled = false;
            _screenShareEnabled = false;
            StopMonitorLocked();

            if (_capture != null)
            {
                try
                {
                    _capture.DataAvailable -= OnDataAvailable;
                    _capture.StopRecording();
                }
                catch
                {
                    // ignored
                }

                _capture.Dispose();
                _capture = null;
            }

            while (_screenSharePcm.TryDequeue(out _))
            {
            }
        }
    }
}
