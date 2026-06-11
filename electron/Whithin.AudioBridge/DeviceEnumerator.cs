using NAudio.CoreAudioApi;

namespace Whithin.AudioBridge;

public static class DeviceEnumerator
{
    public static IReadOnlyList<AudioDeviceInfo> ListCaptureDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        var devices = new List<AudioDeviceInfo>();
        var defaultId = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Multimedia)?.ID;

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
        {
            devices.Add(new AudioDeviceInfo(device.ID, device.FriendlyName, device.ID == defaultId));
        }

        return devices;
    }

    public static IReadOnlyList<AudioDeviceInfo> ListRenderDevices()
    {
        using var enumerator = new MMDeviceEnumerator();
        var devices = new List<AudioDeviceInfo>();
        var defaultId = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia)?.ID;

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            devices.Add(new AudioDeviceInfo(device.ID, device.FriendlyName, device.ID == defaultId));
        }

        return devices;
    }

    public static bool IsCableOutputDevice(string? deviceName) =>
        !string.IsNullOrWhiteSpace(deviceName)
        && deviceName.Contains("CABLE Output", StringComparison.OrdinalIgnoreCase);

    public static MMDevice? FindCaptureDevice(string? deviceId)
    {
        using var enumerator = new MMDeviceEnumerator();

        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            try
            {
                var explicitDevice = enumerator.GetDevice(deviceId);
                if (explicitDevice != null && IsCableOutputDevice(explicitDevice.FriendlyName))
                {
                    Console.WriteLine(
                        $"[Soundpad] WARNING: bridge capture cannot use \"{explicitDevice.FriendlyName}\" — using physical mic instead.");
                    return FindPhysicalCaptureDevice(enumerator, null);
                }

                return explicitDevice;
            }
            catch
            {
                return FindPhysicalCaptureDevice(enumerator, null);
            }
        }

        return FindPhysicalCaptureDevice(enumerator, null);
    }

    private static MMDevice? FindPhysicalCaptureDevice(MMDeviceEnumerator enumerator, string? preferredDeviceId)
    {
        if (!string.IsNullOrWhiteSpace(preferredDeviceId))
        {
            try
            {
                var preferred = enumerator.GetDevice(preferredDeviceId);
                if (preferred != null && !IsCableOutputDevice(preferred.FriendlyName))
                {
                    return preferred;
                }
            }
            catch
            {
                // fall through
            }
        }

        var savedPhysicalId = DefaultCaptureDeviceSwitcher.SavedPhysicalCaptureDeviceId;
        if (!string.IsNullOrWhiteSpace(savedPhysicalId))
        {
            try
            {
                var saved = enumerator.GetDevice(savedPhysicalId);
                if (saved != null && !IsCableOutputDevice(saved.FriendlyName))
                {
                    return saved;
                }
            }
            catch
            {
                // fall through
            }
        }

        var communicationsDefault = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
        if (communicationsDefault != null && !IsCableOutputDevice(communicationsDefault.FriendlyName))
        {
            return communicationsDefault;
        }

        var multimediaDefault = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Multimedia);
        if (multimediaDefault != null && !IsCableOutputDevice(multimediaDefault.FriendlyName))
        {
            return multimediaDefault;
        }

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
        {
            if (!IsCableOutputDevice(device.FriendlyName))
            {
                return device;
            }
        }

        return multimediaDefault ?? communicationsDefault;
    }

    public static AudioDeviceInfo? FindCableOutputDevice()
    {
        foreach (var device in ListCaptureDevices())
        {
            if (device.Name.Contains("CABLE Output", StringComparison.OrdinalIgnoreCase))
            {
                return device;
            }
        }

        return null;
    }

    public static AudioDeviceInfo? FindCableInputDevice()
    {
        foreach (var device in ListRenderDevices())
        {
            if (device.Name.Contains("CABLE Input", StringComparison.OrdinalIgnoreCase))
            {
                return device;
            }
        }

        return null;
    }

    public static MMDevice? FindRenderDevice(string? deviceId)
    {
        using var enumerator = new MMDeviceEnumerator();
        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            try
            {
                return enumerator.GetDevice(deviceId);
            }
            catch
            {
                return null;
            }
        }

        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        {
            if (device.FriendlyName.Contains("CABLE Input", StringComparison.OrdinalIgnoreCase))
            {
                return device;
            }
        }

        return null;
    }
}
