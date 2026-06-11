using System.Text.Json;
using NAudio.CoreAudioApi;

namespace Whithin.AudioBridge;

/// <summary>
/// Temporarily sets CABLE Output as the Windows default capture device while Whithin is running.
/// Saves Multimedia and Communications roles separately and restores them on exit.
/// </summary>
public static class DefaultCaptureDeviceSwitcher
{
    private static string? _savedMultimediaId;
    private static string? _savedCommunicationsId;
    private static string? _savedConsoleId;
    private static bool _isActive;

    private static string BackupFilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "Whithin",
        "default-capture-backup.json");

    public static bool IsActive => _isActive || File.Exists(BackupFilePath);

    public static DefaultCaptureSwitchResult Activate(string? deviceId = null)
    {
        var target = ResolveTargetDevice(deviceId);
        if (target == null)
        {
            return new DefaultCaptureSwitchResult(false, null, null, "CABLE Output not found. Install VB-Audio Cable.");
        }

        TryLoadBackupFromDisk();

        if (!_isActive)
        {
            _savedMultimediaId = GetDefaultCaptureDeviceId(Role.Multimedia);
            _savedCommunicationsId = GetDefaultCaptureDeviceId(Role.Communications);
            _savedConsoleId = GetDefaultCaptureDeviceId(Role.Console);
            _isActive = true;
            PersistBackupToDisk();
            Console.WriteLine(
                $"[Soundpad] Saved default mics: multimedia={_savedMultimediaId}, communications={_savedCommunicationsId}");
        }

        try
        {
            SetDefaultCaptureDevice(target.Id, PolicyConfigRole.Multimedia);
            SetDefaultCaptureDevice(target.Id, PolicyConfigRole.Communications);
            SetDefaultCaptureDevice(target.Id, PolicyConfigRole.Console);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] Failed to switch default mics: {ex.Message}");
            return new DefaultCaptureSwitchResult(false, _savedMultimediaId, target.Id, ex.Message);
        }

        Console.WriteLine($"[Soundpad] Default mics switched to \"{target.Name}\"");
        return new DefaultCaptureSwitchResult(true, _savedMultimediaId, target.Id, null);
    }

    public static DefaultCaptureSwitchResult Restore()
    {
        TryLoadBackupFromDisk();

        if (!_isActive)
        {
            return new DefaultCaptureSwitchResult(true, null, null, null);
        }

        try
        {
            if (!string.IsNullOrWhiteSpace(_savedMultimediaId))
            {
                SetDefaultCaptureDevice(_savedMultimediaId, PolicyConfigRole.Multimedia);
            }

            if (!string.IsNullOrWhiteSpace(_savedCommunicationsId))
            {
                SetDefaultCaptureDevice(_savedCommunicationsId, PolicyConfigRole.Communications);
            }

            if (!string.IsNullOrWhiteSpace(_savedConsoleId))
            {
                SetDefaultCaptureDevice(_savedConsoleId, PolicyConfigRole.Console);
            }

            Console.WriteLine(
                $"[Soundpad] Default mics restored: multimedia={_savedMultimediaId}, communications={_savedCommunicationsId}");
        }
        finally
        {
            ClearState();
        }

        return new DefaultCaptureSwitchResult(true, null, null, null);
    }

    public static DefaultCaptureStatus GetStatus()
    {
        TryLoadBackupFromDisk();
        var cable = DeviceEnumerator.FindCableOutputDevice();
        return new DefaultCaptureStatus(
            _isActive,
            _savedMultimediaId,
            GetDefaultCaptureDeviceId(Role.Multimedia),
            cable?.Id,
            cable?.Name);
    }

    /// <summary>
    /// Physical mic saved before switching Windows default to CABLE Output (bridge capture must use this).
    /// </summary>
    public static string? SavedPhysicalCaptureDeviceId
    {
        get
        {
            TryLoadBackupFromDisk();
            return _savedMultimediaId;
        }
    }

    private static void ClearState()
    {
        _isActive = false;
        _savedMultimediaId = null;
        _savedCommunicationsId = null;
        _savedConsoleId = null;

        try
        {
            if (File.Exists(BackupFilePath))
            {
                File.Delete(BackupFilePath);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not delete backup file: {ex.Message}");
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

            var payload = new DefaultCaptureBackup(
                _savedMultimediaId,
                _savedCommunicationsId,
                _savedConsoleId);
            File.WriteAllText(BackupFilePath, JsonSerializer.Serialize(payload));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not persist backup: {ex.Message}");
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
            var backup = JsonSerializer.Deserialize<DefaultCaptureBackup>(json);
            if (backup == null)
            {
                return;
            }

            _savedMultimediaId = backup.MultimediaId;
            _savedCommunicationsId = backup.CommunicationsId;
            _savedConsoleId = backup.ConsoleId;
            _isActive = true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Soundpad] WARNING: could not load backup: {ex.Message}");
        }
    }

    private static AudioDeviceInfo? ResolveTargetDevice(string? deviceId)
    {
        if (!string.IsNullOrWhiteSpace(deviceId))
        {
            foreach (var device in DeviceEnumerator.ListCaptureDevices())
            {
                if (string.Equals(device.Id, deviceId, StringComparison.OrdinalIgnoreCase))
                {
                    return device;
                }
            }
        }

        return DeviceEnumerator.FindCableOutputDevice();
    }

    private static string? GetDefaultCaptureDeviceId(Role role)
    {
        using var enumerator = new MMDeviceEnumerator();
        return enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, role)?.ID;
    }

    private static void SetDefaultCaptureDevice(string deviceId, PolicyConfigRole role)
    {
        PolicyConfigInterop.SetDefaultEndpoint(deviceId, role);
    }

    private sealed record DefaultCaptureBackup(
        string? MultimediaId,
        string? CommunicationsId,
        string? ConsoleId);
}

public sealed record DefaultCaptureSwitchResult(bool Ok, string? PreviousDeviceId, string? TargetDeviceId, string? Error);

public sealed record DefaultCaptureStatus(
    bool Active,
    string? SavedDeviceId,
    string? CurrentDeviceId,
    string? CableOutputDeviceId,
    string? CableOutputDeviceName);
