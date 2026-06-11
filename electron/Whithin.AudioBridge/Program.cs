namespace Whithin.AudioBridge;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        var port = 38473;
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--port" && int.TryParse(args[i + 1], out var parsed))
            {
                port = parsed;
            }
        }

        using var server = new BridgeHttpServer();
        server.Start(port);

        var exit = new ManualResetEventSlim(false);
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            exit.Set();
        };

        AppDomain.CurrentDomain.ProcessExit += (_, _) => exit.Set();
        exit.Wait();
    }
}
