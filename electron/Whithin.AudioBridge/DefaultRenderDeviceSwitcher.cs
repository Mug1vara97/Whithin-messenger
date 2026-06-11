using System.Text.Json;
using NAudio.CoreAudioApi;

namespace Whithin.AudioBridge;

/// <summary>
/// Routes system audio (Multimedia/Console) to CABLE Input while Whithin runs in VB-Cable mode.
/// Communications role stays on the physical speakers so call audio can be played there.
/// </summary>
public static class DefaultRenderDeviceSwitcher
{
    private static string? _savedMultimediaId;
    private static string? _savedCommunicationsId;
    private static string? _savedConsoleId;
    private static string? _callAudioOutputId;
    private static string? _callAudioOutputName;
    private static bool _isActive;

    private static string BackupFilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Whithin",
        "default-render-backup.json");

    public static bool IsActive => _isActive || File.Exists(BackupFilePath);

    public static DefaultRenderSwitchResult Activate(string? deviceId = null, bool enableMonitor = false)
    {
        var target = ResolveTargetDevice(deviceId);
        if (target == null)
        {
            return new DefaultRenderSwitchResult(false, null, null, null, null,
                "CABLE Input not found. Install VB-Audio Cable.");
        }

        TryLoadBackupFromDisk();

        if (!_isActive)
        {
            _savedMultimediaId = GetDefaultRenderDeviceId(Role.Multimedia);
            _savedCommunicationsId = GetDefaultRenderDeviceId(Role.Communications);
            _savedConsoleId = GetDefaultRenderDeviceId(Role.Console);
            _callAudioOutputId = ResolveCallAudioOutputId();
            _callAudioOutputName = GetDeviceFriendlyName(_callAudioOutputId);
            _isActive = true;
            PersistBackupToDisk();
            Console.WriteLine(
                $"[Soundpad] Saved default speakers: multimedia={_savedMultimediaId}, communications={_savedCommunicationsId}, callOutput=\"{_callAudioOutputName}\"");
        }

        try
        {
            SetDefaultRenderDevice(target.Id, PolicyConfigRole.Multimedia);
            SetDefaultRenderDevice(target.Id, PolicyConfigRole.Console);

            if (!string.IsNullOrWhiteSpace(_callAudioOutputId))
            {
                SetDefaultRenderDevice(_callAudioOutputId, PolicyConfigRole.Communications);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] Failed to switch default speakers: {ex.Message}");
            return new DefaultRenderSwitchResult(false, _callAudioOutputId, _callAudioOutputName, target.Id, target.Name, ex.Message);
        }

        if (enableMonitor)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(_callAudioOutputId))
                {
                    CableInputLoopbackHub.Instance.EnableMonitor(_callAudioOutputId, target.Id);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Soundpad] WARNING: CABLE monitor failed: {ex.Message}");
            }

            Console.WriteLine(
                $"[Soundpad] Default speakers switched to \"{target.Name}\" with monitor on \"{_callAudioOutputName}\"");
        }
        else
        {
            Console.WriteLine(
                $"[Soundpad] Default speakers switched to \"{target.Name}\" (monitor off; call on \"{_callAudioOutputName}\")");
        }

        return new DefaultRenderSwitchResult(true, _callAudioOutputId, _callAudioOutputName, target.Id, target.Name, null);
    }

    public static DefaultRenderSwitchResult Restore()
    {
        TryLoadBackupFromDisk();

        if (!_isActive)
        {
            return new DefaultRenderSwitchResult(true, null, null, null, null, null);
        }

        try
        {
            CableInputLoopbackHub.Instance.DisableMonitor();

            if (!string.IsNullOrWhiteSpace(_savedMultimediaId))
            {
                SetDefaultRenderDevice(_savedMultimediaId, PolicyConfigRole.Multimedia);
            }

            if (!string.IsNullOrWhiteSpace(_savedCommunicationsId))
            {
                SetDefaultRenderDevice(_savedCommunicationsId, PolicyConfigRole.Communications);
            }

            if (!string.IsNullOrWhiteSpace(_savedConsoleId))
            {
                SetDefaultRenderDevice(_savedConsoleId, PolicyConfigRole.Console);
            }

            Console.WriteLine(
                $"[Soundpad] Default speakers restored: multimedia={_savedMultimediaId}, communications={_savedCommunicationsId}");
        }
        finally
        {
            ClearState();
        }

        return new DefaultRenderSwitchResult(true, null, null, null, null, null);
    }

    public static DefaultRenderStatus GetStatus()
    {
        TryLoadBackupFromDisk();
        var cable = DeviceEnumerator.FindCableInputDevice();
        return new DefaultRenderStatus(
            _isActive,
            _callAudioOutputId,
            _callAudioOutputName,
            GetDefaultRenderDeviceId(Role.Multimedia),
            cable?.Id,
            cable?.Name);
    }

    private static string? ResolveCallAudioOutputId()
    {
        if (!IsCableLikeDevice(_savedCommunicationsId))
        {
            return _savedCommunicationsId;
        }

        if (!IsCableLikeDevice(_savedMultimediaId))
        {
            return _savedMultimediaId;
        }

        return FindFirstNonCableRenderDeviceId();
    }

    private static string? FindFirstNonCableRenderDeviceId()
    {
        foreach (var device in DeviceEnumerator.ListRenderDevices())
        {
            if (!IsCableLikeName(device.Name))
            {
                return device.Id;
            }
        }

        return null;
    }

    private static bool IsCableLikeDevice(string? deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return false;
        }

        return IsCableLikeName(GetDeviceFriendlyName(deviceId));
    }

    private static bool IsCableLikeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return false;
        }

        return name.Contains("CABLE", StringComparison.OrdinalIgnoreCase);
    }

    private static string? GetDeviceFriendlyName(string? deviceId)
    {
        if (string.IsNullOrWhiteSpace(deviceId))
        {
            return null;
        }

        try
        {
            using var enumerator = new MMDeviceEnumerator();
            return enumerator.GetDevice(deviceId).FriendlyName;
        }
        catch
        {
            return null;
        }
    }

    private static void ClearState()
    {
        _isActive = false;
        _savedMultimediaId = null;
        _savedCommunicationsId = null;
        _savedConsoleId = null;
        _callAudioOutputId = null;
        _callAudioOutputName = null;

        try
        {
            if (File.Exists(BackupFilePath))
            {
                File.Delete(BackupFilePath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not delete render backup file: {ex.Message}");
        }
    }

    private static void PersistBackupToDisk()
    {
        try
        {
            var dir = Path.GetDirectoryName(BackupFilePath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var payload = new DefaultRenderBackup(
                _savedMultimediaId,
                _savedCommunicationsId,
                _savedConsoleId,
                _callAudioOutputId,
                _callAudioOutputName);
            File.WriteAllText(BackupFilePath, JsonSerializer.Serialize(payload));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not persist render backup: {ex.Message}");
        }
    }

    private static void TryLoadBackupFromDisk()
    {
        if (_isActive)
        {
            return;
        }

        try
        {
            if (!File.Exists(BackupFilePath))
            {
                return;
            }

            var json = File.ReadAllText(BackupFilePath);
            var backup = JsonSerializer.Deserialize<DefaultRenderBackup>(json);
            if (backup == null)
            {
                return;
            }

            _savedMultimediaId = backup.MultimediaId;
            _savedCommunicationsId = backup.CommunicationsId;
            _savedConsoleId = backup.ConsoleId;
            _callAudioOutputId = backup.CallAudioOutputId;
            _callAudioOutputName = backup.CallAudioOutputName;
            _isActive = true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not load render backup: {ex.Message}");
        }
    }

    private static AudioDeviceInfo? ResolveTargetDevice(string? deviceId)
    {
        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            foreach (var device in DeviceEnumerator.ListRenderDevices())
            {
                if (string.Equals(device.Id, deviceId, StringComparison.OrdinalIgnoreCase))
                {
                    return device;
                }
            }
        }

        return DeviceEnumerator.FindCableInputDevice();
    }

    private static string? GetDefaultRenderDeviceId(Role role)
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator.GetDefaultAudioEndpoint(DataFlow.Render, role)?.ID;
    }

    private static void SetDefaultRenderDevice(string deviceId, PolicyConfigRole role)
    {
        PolicyConfigInterop.SetDefaultEndpoint(deviceId, role);
    }

    private sealed record DefaultRenderBackup(
        string? MultimediaId,
        string? CommunicationsId,
        string? ConsoleId,
        string? CallAudioOutputId,
        string? CallAudioOutputName);
}

public sealed record DefaultRenderSwitchResult(
    bool Ok,
    string? CallAudioOutputDeviceId,
    string? CallAudioOutputDeviceName,
    string? TargetDeviceId,
    string? TargetDeviceName,
    string? Error);

public sealed record DefaultRenderStatus(
    bool Active,
    string? CallAudioOutputDeviceId,
    string? CallAudioOutputDeviceName,
    string? CurrentMultimediaDeviceId,
    string? CableInputDeviceId,
    string? CableInputDeviceName);
