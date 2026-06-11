using System.Collections.Concurrent;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace Whithin.AudioBridge;

/// <summary>
/// Mixes microphone capture with soundpad samples into a WASAPI render device (e.g. VB-Cable Input).
/// </summary>
public sealed class AudioMixerBridge : IDisposable
{
    private readonly object _gate = new();
    private WasapiCapture? _capture;
    private WasapiOut? _output;
    private MixingSampleProvider? _mixer;
    private SoundpadSampleProvider? _soundpad;
    private MMDevice? _captureDevice;
    private MMDevice? _renderDevice;
    private WaveFormat? _mixerFormat;
    private bool _running;

    public bool IsRunning
    {
        get
        {
            lock (_gate)
            {
                return _running;
            }
        }
    }

    public string? CaptureDeviceName => _captureDevice?.FriendlyName;
    public string? RenderDeviceName => _renderDevice?.FriendlyName;

    public void Start(string? captureDeviceId, string? renderDeviceId)
    {
        lock (_gate)
        {
            StopInternal();

            _captureDevice = DeviceEnumerator.FindCaptureDevice(captureDeviceId)
                ?? throw new InvalidOperationException("Microphone device not found.");

            _renderDevice = DeviceEnumerator.FindRenderDevice(renderDeviceId)
                ?? throw new InvalidOperationException(
                    "VB-Cable render device not found. Install VB-Audio Cable and select \"CABLE Input\".");

            _mixerFormat = BridgeAudioFormat.CreateMixerFormat(_renderDevice);

            _capture = new WasapiCapture(_captureDevice);
            _soundpad = new SoundpadSampleProvider(_mixerFormat);
            _mixer = new MixingSampleProvider(_mixerFormat)
            {
                ReadFully = true,
            };
            _mixer.AddMixerInput(_soundpad);

            var micProvider = new MicrophoneSampleProvider(_capture, _mixerFormat);
            _mixer.AddMixerInput(micProvider);

            var stereoOut = new MonoToStereoSampleProvider(_mixer);

            _output = new WasapiOut(_renderDevice, AudioClientShareMode.Shared, false, 50);
            _output.Init(stereoOut);
            _capture.StartRecording();
            _output.Play();
            _running = true;

            Console.WriteLine(
                $"[Soundpad] Bridge started: mic=\"{_captureDevice.FriendlyName}\" ({_capture.WaveFormat.SampleRate}Hz/{_capture.WaveFormat.Channels}ch) -> render=\"{_renderDevice.FriendlyName}\" mixer={_mixerFormat.SampleRate}Hz mono -> output={stereoOut.WaveFormat.SampleRate}Hz stereo playback={_output.PlaybackState}");
        }
    }

    public void Stop()
    {
        lock (_gate)
        {
            StopInternal();
        }
    }

    public SoundpadPlayInfo PlayFile(string filePath, float volume)
    {
        lock (_gate)
        {
            if (!_running || _soundpad == null || _output == null)
            {
                throw new InvalidOperationException("Audio bridge is not running. Enable the bridge in soundpad settings.");
            }

            var clampedVolume = Math.Clamp(volume, 0f, 2f);
            var info = _soundpad.EnqueueFile(filePath, clampedVolume);
            Console.WriteLine(
                $"[Soundpad] PlayFile: path=\"{filePath}\" samples={info.SampleCount} durationSec={info.DurationSeconds:F2} volume={clampedVolume} playback={_output.PlaybackState}");
            return info;
        }
    }

    public void StopPlayback()
    {
        lock (_gate)
        {
            _soundpad?.Clear();
        }
    }

    private void StopInternal()
    {
        _running = false;
        try
        {
            _capture?.StopRecording();
        }
        catch
        {
            // ignored
        }

        try
        {
            _output?.Stop();
        }
        catch
        {
            // ignored
        }

        _capture?.Dispose();
        _output?.Dispose();
        _capture = null;
        _output = null;
        _mixer = null;
        _soundpad = null;
        _captureDevice = null;
        _renderDevice = null;
        _mixerFormat = null;
    }

    public void Dispose()
    {
        Stop();
    }
}

internal sealed class QueuedCaptureSampleProvider : ISampleProvider
{
    private readonly WaveFormat _waveFormat;
    private readonly ConcurrentQueue<float> _samples = new();

    public QueuedCaptureSampleProvider(WaveFormat sourceFormat)
    {
        _waveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sourceFormat.SampleRate, 1);
    }

    public WaveFormat WaveFormat => _waveFormat;

    public void Enqueue(float sample) => _samples.Enqueue(sample);

    public int Read(float[] buffer, int offset, int count)
    {
        var read = 0;
        while (read < count && _samples.TryDequeue(out var sample))
        {
            buffer[offset + read] = sample;
            read++;
        }

        return read;
    }
}

internal sealed class MicrophoneSampleProvider : ISampleProvider, IDisposable
{
    private readonly WasapiCapture _capture;
    private readonly QueuedCaptureSampleProvider _queue;
    private readonly WdlResamplingSampleProvider _resampler;
    private readonly WaveFormat _outputFormat;
    private bool _disposed;

    public MicrophoneSampleProvider(WasapiCapture capture, WaveFormat outputFormat)
    {
        _capture = capture;
        _outputFormat = outputFormat;
        _queue = new QueuedCaptureSampleProvider(capture.WaveFormat);
        _resampler = new WdlResamplingSampleProvider(_queue, outputFormat.SampleRate);
        _capture.DataAvailable += OnDataAvailable;
    }

    public WaveFormat WaveFormat => _outputFormat;

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        if (e.BytesRecorded <= 0)
        {
            return;
        }

        var sourceFormat = _capture.WaveFormat;
        var frameCount = e.BytesRecorded / (sourceFormat.BitsPerSample / 8) / sourceFormat.Channels;

        for (var i = 0; i < frameCount; i++)
        {
            float sample = 0f;
            if (sourceFormat.Encoding == WaveFormatEncoding.IeeeFloat)
            {
                var offset = i * sourceFormat.Channels * 4;
                if (offset + 4 <= e.BytesRecorded)
                {
                    sample = BitConverter.ToSingle(e.Buffer, offset);
                }
            }
            else if (sourceFormat.BitsPerSample == 16)
            {
                var offset = i * sourceFormat.Channels * 2;
                if (offset + 2 <= e.BytesRecorded)
                {
                    sample = BitConverter.ToInt16(e.Buffer, offset) / 32768f;
                }
            }

            if (sourceFormat.Channels > 1)
            {
                float sum = sample;
                for (var ch = 1; ch < sourceFormat.Channels; ch++)
                {
                    var offset = (i * sourceFormat.Channels + ch) * (sourceFormat.BitsPerSample / 8);
                    if (sourceFormat.BitsPerSample == 16 && offset + 2 <= e.BytesRecorded)
                    {
                        sum += BitConverter.ToInt16(e.Buffer, offset) / 32768f;
                    }
                    else if (sourceFormat.Encoding == WaveFormatEncoding.IeeeFloat && offset + 4 <= e.BytesRecorded)
                    {
                        sum += BitConverter.ToSingle(e.Buffer, offset);
                    }
                }

                sample = sum / sourceFormat.Channels;
            }

            _queue.Enqueue(sample);
        }
    }

    public int Read(float[] buffer, int offset, int count)
    {
        var read = _resampler.Read(buffer, offset, count);
        for (var i = read; i < count; i++)
        {
            buffer[offset + i] = 0f;
        }

        return count;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _capture.DataAvailable -= OnDataAvailable;
    }
}

internal sealed class SoundpadSampleProvider : ISampleProvider
{
    private readonly WaveFormat _waveFormat;
    private readonly object _gate = new();
    private float[] _buffer = Array.Empty<float>();
    private int _position;
    private float _volume = 1f;
    private long _samplesDelivered;
    private bool _deliveryLogged;

    public SoundpadSampleProvider(WaveFormat waveFormat)
    {
        _waveFormat = waveFormat;
    }

    public WaveFormat WaveFormat => _waveFormat;

    public SoundpadPlayInfo EnqueueFile(string filePath, float volume)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("Sound file not found.", filePath);
        }

        var fileInfo = new FileInfo(filePath);
        using var reader = new AudioFileReader(filePath);
        Console.WriteLine(
            $"[Soundpad] Decoding: \"{filePath}\" size={fileInfo.Length} sourceRate={reader.WaveFormat.SampleRate} channels={reader.WaveFormat.Channels} targetRate={_waveFormat.SampleRate}");

        var resampler = new WdlResamplingSampleProvider(reader, _waveFormat.SampleRate);
        ISampleProvider mono = resampler.WaveFormat.Channels > 1
            ? new StereoToMonoSampleProvider(resampler)
            : resampler;

        var samples = new List<float>();
        var chunk = new float[_waveFormat.SampleRate];
        int read;
        while ((read = mono.Read(chunk, 0, chunk.Length)) > 0)
        {
            for (var i = 0; i < read; i++)
            {
                samples.Add(chunk[i]);
            }
        }

        if (samples.Count == 0)
        {
            Console.WriteLine($"[Soundpad] WARNING: decoded 0 samples from \"{filePath}\"");
        }
        else
        {
            var peak = 0f;
            for (var i = 0; i < samples.Count; i++)
            {
                peak = Math.Max(peak, Math.Abs(samples[i]));
            }

            Console.WriteLine($"[Soundpad] Decoded peak={peak:F4} samples={samples.Count} at {_waveFormat.SampleRate}Hz");
        }

        lock (_gate)
        {
            _buffer = samples.ToArray();
            _position = 0;
            _volume = volume;
            _samplesDelivered = 0;
            _deliveryLogged = false;
        }

        return new SoundpadPlayInfo(samples.Count, samples.Count / (float)_waveFormat.SampleRate, filePath);
    }

    public void Clear()
    {
        lock (_gate)
        {
            _buffer = Array.Empty<float>();
            _position = 0;
        }
    }

    public int Read(float[] buffer, int offset, int count)
    {
        lock (_gate)
        {
            var nonZero = 0;
            for (var i = 0; i < count; i++)
            {
                if (_position < _buffer.Length)
                {
                    var sample = _buffer[_position] * _volume;
                    buffer[offset + i] = sample;
                    if (Math.Abs(sample) > 0.0001f)
                    {
                        nonZero++;
                    }

                    _position++;
                    _samplesDelivered++;
                }
                else
                {
                    buffer[offset + i] = 0f;
                }
            }

            if (nonZero > 0 && !_deliveryLogged)
            {
                _deliveryLogged = true;
                Console.WriteLine($"[Soundpad] Soundpad Read: first audio chunk {nonZero}/{count} non-zero samples");
            }

            return count;
        }
    }
}

public sealed record SoundpadPlayInfo(int SampleCount, float DurationSeconds, string FilePath);
