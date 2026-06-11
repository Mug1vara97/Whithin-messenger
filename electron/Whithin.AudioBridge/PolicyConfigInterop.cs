using System.Runtime.InteropServices;

namespace Whithin.AudioBridge;

/// <summary>
/// Undocumented Windows PolicyConfig COM API for setting the default audio endpoint.
/// CLSID / interface GUIDs from PolicyConfig.h (see EarTrumpet, AudioEndPointController).
/// </summary>
internal static class PolicyConfigInterop
{
    private static readonly Guid PolicyConfigClientClsid = new("870af99c-171d-4f9e-af0d-e63df40c2bc9");
    private static readonly Guid PolicyConfigVistaClientClsid = new("294935CE-F637-4E7C-A41B-AB255460B862");
    private static readonly Guid IPolicyConfigWin7Iid = new("F8679F50-850A-41CF-9C72-430F290290C8");
    private static readonly Guid IPolicyConfigVistaIid = new("568b9108-44bf-40b4-9006-86afe5b5a620");

    private const uint CLSCTX_ALL = 23;

    public static void SetDefaultEndpoint(string deviceId, PolicyConfigRole role)
    {
        RunOnStaThread(() =>
        {
            Exception? last = null;

            foreach (var attempt in new Func<IPolicyConfigWin7>[]
                     {
                         CreatePolicyConfigClient,
                         CreatePolicyConfigVistaClient,
                         CreatePolicyConfigViaCoCreate,
                     })
            {
                try
                {
                    var policy = attempt();
                    policy.SetDefaultEndpoint(deviceId, role);
                    return;
                }
                catch (Exception ex)
                {
                    last = ex;
                    Console.WriteLine($"[Soundpad] PolicyConfig attempt failed: {ex.Message}");
                }
            }

            throw new InvalidOperationException(
                "Could not set default audio capture device via PolicyConfig COM.",
                last);
        });
    }

    private static void RunOnStaThread(Action action)
    {
        if (Thread.CurrentThread.GetApartmentState() == ApartmentState.STA)
        {
            action();
            return;
        }

        Exception? captured = null;
        var thread = new Thread(() =>
        {
            try
            {
                action();
            }
            catch (Exception ex)
            {
                captured = ex;
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        thread.Join();

        if (captured != null)
        {
            throw captured;
        }
    }

    private static IPolicyConfigWin7 CreatePolicyConfigClient()
    {
        return (IPolicyConfigWin7)new PolicyConfigClient();
    }

    private static IPolicyConfigWin7 CreatePolicyConfigVistaClient()
    {
        var vista = (IPolicyConfigVista)new PolicyConfigVistaClient();
        return new PolicyConfigVistaAdapter(vista);
    }

    private static IPolicyConfigWin7 CreatePolicyConfigViaCoCreate()
    {
        foreach (var clsid in new[] { PolicyConfigClientClsid, PolicyConfigVistaClientClsid })
        {
            var hr = CoCreateInstance(clsid, IntPtr.Zero, CLSCTX_ALL, IPolicyConfigWin7Iid, out var ptr);
            if (hr < 0 || ptr == IntPtr.Zero)
            {
                continue;
            }

            try
            {
                return (IPolicyConfigWin7)Marshal.GetObjectForIUnknown(ptr)!;
            }
            finally
            {
                Marshal.Release(ptr);
            }
        }

        throw new COMException("CoCreateInstance failed for PolicyConfig clients.");
    }

    [DllImport("ole32.dll", ExactSpelling = true)]
    private static extern int CoCreateInstance(
        in Guid rclsid,
        IntPtr pUnkOuter,
        uint dwClsContext,
        in Guid riid,
        out IntPtr ppv);

    [ComImport]
    [Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
    private class PolicyConfigClient
    {
    }

    [ComImport]
    [Guid("294935CE-F637-4E7C-A41B-AB255460B862")]
    private class PolicyConfigVistaClient
    {
    }

    [ComImport]
    [Guid("F8679F50-850A-41CF-9C72-430F290290C8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPolicyConfigWin7
    {
        void Unused1();
        void Unused2();
        void Unused3();
        void Unused4();
        void Unused5();
        void Unused6();
        void Unused7();
        void Unused8();
        void GetPropertyValue(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            ref PROPERTYKEY pkey,
            ref PropVariant pv);
        void SetPropertyValue(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            ref PROPERTYKEY pkey,
            ref PropVariant pv);
        void SetDefaultEndpoint(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            PolicyConfigRole eRole);
        void SetEndpointVisibility(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            [MarshalAs(UnmanagedType.I2)] short isVisible);
    }

    [ComImport]
    [Guid("568b9108-44bf-40b4-9006-86afe5b5a620")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPolicyConfigVista
    {
        void Unused1();
        void Unused2();
        void Unused3();
        void Unused4();
        void Unused5();
        void Unused6();
        void Unused7();
        void Unused8();
        void GetPropertyValue(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            ref PROPERTYKEY pkey,
            ref PropVariant pv);
        void SetPropertyValue(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            ref PROPERTYKEY pkey,
            ref PropVariant pv);
        void SetDefaultEndpoint(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            PolicyConfigRole eRole);
        void SetEndpointVisibility(
            [MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId,
            [MarshalAs(UnmanagedType.I2)] short isVisible);
    }

    private sealed class PolicyConfigVistaAdapter(IPolicyConfigVista inner) : IPolicyConfigWin7
    {
        public void Unused1() => inner.Unused1();
        public void Unused2() => inner.Unused2();
        public void Unused3() => inner.Unused3();
        public void Unused4() => inner.Unused4();
        public void Unused5() => inner.Unused5();
        public void Unused6() => inner.Unused6();
        public void Unused7() => inner.Unused7();
        public void Unused8() => inner.Unused8();
        public void GetPropertyValue(string wszDeviceId, ref PROPERTYKEY pkey, ref PropVariant pv) =>
            inner.GetPropertyValue(wszDeviceId, ref pkey, ref pv);
        public void SetPropertyValue(string wszDeviceId, ref PROPERTYKEY pkey, ref PropVariant pv) =>
            inner.SetPropertyValue(wszDeviceId, ref pkey, ref pv);
        public void SetDefaultEndpoint(string wszDeviceId, PolicyConfigRole eRole) =>
            inner.SetDefaultEndpoint(wszDeviceId, eRole);
        public void SetEndpointVisibility(string wszDeviceId, short isVisible) =>
            inner.SetEndpointVisibility(wszDeviceId, isVisible);
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit, Pack = 8, Size = 24)]
    private struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
    }
}

internal enum PolicyConfigRole
{
    Console = 0,
    Multimedia = 1,
    Communications = 2,
}
