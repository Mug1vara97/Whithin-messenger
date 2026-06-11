using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace Whithin.AudioBridge;

internal static class BridgeAudioFormat
{
  /// <summary>
  /// VB-Cable and most VoIP stacks expect 48 kHz. Some Realtek mics report 192 kHz which breaks virtual cables.
  /// </summary>
  public static WaveFormat CreateMixerFormat(MMDevice renderDevice)
  {
    var sampleRate = ResolveSampleRate(renderDevice);
    return WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, 1);
  }

  public static int ResolveSampleRate(MMDevice renderDevice)
  {
    if (renderDevice.FriendlyName.Contains("CABLE", StringComparison.OrdinalIgnoreCase))
    {
      return 48000;
    }

    try
    {
      var mix = renderDevice.AudioClient.MixFormat;
      if (mix.SampleRate is 44100 or 48000)
      {
        return mix.SampleRate;
      }

      Console.WriteLine(
        $"[Soundpad] WARNING: render mix format {mix.SampleRate}Hz unsupported, using 48000Hz");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"[Soundpad] WARNING: could not read mix format: {ex.Message}");
    }

    return 48000;
  }
}
