using System.Globalization;
using System.Text;

namespace WhithinMessenger.Application.Services;

/// <summary>Normalize client-uploaded voice waveform peaks (Telegram-style, stored on MediaFile).</summary>
public static class WaveformPeaksNormalizer
{
    public const int MaxPeaks = 200;

    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var parts = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 8) return null;

        var sb = new StringBuilder(parts.Length * 6);
        var count = 0;
        foreach (var part in parts)
        {
            if (count >= MaxPeaks) break;
            if (!double.TryParse(part, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            {
                continue;
            }

            var clamped = Math.Clamp(value, 0d, 1d);
            if (sb.Length > 0) sb.Append(',');
            sb.Append(clamped.ToString("0.###", CultureInfo.InvariantCulture));
            count++;
        }

        return count >= 8 ? sb.ToString() : null;
    }
}
