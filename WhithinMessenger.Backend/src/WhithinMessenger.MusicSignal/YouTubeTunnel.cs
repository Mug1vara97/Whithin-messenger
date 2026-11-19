using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Http.Features;

namespace WhithinMessenger.MusicSignal;

/// <summary>
/// TCP tunnel to YouTube for the desktop music player: some ISPs in Russia block googlevideo
/// in ways the client can't get around, while the server reaches it directly. The client upgrades
/// the HTTP/1.1 request and speaks TLS to Google through the tunnel, so only encrypted bytes pass here.
/// </summary>
public static class YouTubeTunnel
{
    public const string Protocol = "whithin-yt-tunnel";

    private static readonly string[] Domains =
    {
        "youtube.com",
        "googlevideo.com",
        "ytimg.com",
        "ggpht.com",
        "googleusercontent.com",
        "youtube-nocookie.com",
        "youtu.be",
        "youtubei.googleapis.com",
    };

    private static readonly SemaphoreSlim Slots = new(256);
    private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(10);

    public static bool IsAllowed(string host)
    {
        host = host.TrimEnd('.').ToLowerInvariant();
        return host.Length > 0
               && host.All(c => char.IsAsciiLetterOrDigit(c) || c is '.' or '-')
               && Domains.Any(d => host == d || host.EndsWith("." + d, StringComparison.Ordinal));
    }

    public static async Task HandleAsync(HttpContext context)
    {
        var host = context.Request.Query["host"].ToString();
        if (!IsAllowed(host))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var upgrade = context.Features.Get<IHttpUpgradeFeature>();
        if (upgrade is not { IsUpgradableRequest: true } ||
            !string.Equals(context.Request.Headers.Upgrade, Protocol, StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status426UpgradeRequired;
            return;
        }

        if (!await Slots.WaitAsync(0))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            return;
        }

        try
        {
            Socket? socket;
            using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted))
            {
                timeout.CancelAfter(ConnectTimeout);
                socket = await ConnectAsync(host, timeout.Token);
            }
            if (socket is null)
            {
                context.Response.StatusCode = StatusCodes.Status502BadGateway;
                return;
            }

            await using var server = new NetworkStream(socket, ownsSocket: true);
            context.Response.Headers.Upgrade = Protocol;
            await using var client = await upgrade.UpgradeAsync();
            await Task.WhenAny(client.CopyToAsync(server), server.CopyToAsync(client));
        }
        finally
        {
            Slots.Release();
        }
    }

    /// <summary>
    /// IPv6 first: the hosting network filters part of Google's IPv4 addresses the same way ISPs do.
    /// </summary>
    private static async Task<Socket?> ConnectAsync(string host, CancellationToken token)
    {
        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(host, token);
        }
        catch (Exception)
        {
            return null;
        }

        foreach (var address in addresses.OrderBy(a => a.AddressFamily == AddressFamily.InterNetworkV6 ? 0 : 1).Take(4))
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(address, 443, token);
                return socket;
            }
            catch (Exception)
            {
                socket.Dispose();
                if (token.IsCancellationRequested) return null;
            }
        }
        return null;
    }
}
