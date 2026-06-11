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

    public static MMDevice? FindCaptureDevice(string? deviceId)
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

        return enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications)
               ?? enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Multimedia);
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
