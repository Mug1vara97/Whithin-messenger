using System.Net.Http.Headers;
using System.Net.Http.Json;
using Google.Apis.Auth.OAuth2;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Api.Services;

public class FirebasePushSender : IFirebasePushSender
{
    private static readonly string[] Scopes = ["https://www.googleapis.com/auth/firebase.messaging"];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<FirebasePushSender> _logger;
    private GoogleCredential? _credential;
    private string? _projectId;

    public FirebasePushSender(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<FirebasePushSender> logger
    )
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
        TryInitialize();
    }

    public async Task SendChatNotificationAsync(
        string deviceToken,
        Guid chatId,
        string title,
        string message,
        string? messageType = null,
        string? previewText = null,
        string? thumbnailUrl = null,
        CancellationToken cancellationToken = default
    )
    {
        var data = new Dictionary<string, string>
        {
            ["chat_id"] = chatId.ToString(),
            ["chat_title"] = TruncateDataValue(title),
            ["title"] = TruncateDataValue(title),
            ["message"] = TruncateDataValue(message),
            ["type"] = "chat_message"
        };

        if (!string.IsNullOrWhiteSpace(messageType))
        {
            data["message_type"] = messageType.Trim();
        }

        if (!string.IsNullOrWhiteSpace(previewText))
        {
            data["preview_text"] = TruncateDataValue(previewText.Trim());
        }

        if (!string.IsNullOrWhiteSpace(thumbnailUrl))
        {
            data["thumbnail_url"] = TruncateDataValue(thumbnailUrl.Trim());
        }

        var displayBody = !string.IsNullOrWhiteSpace(previewText)
            ? previewText.Trim()
            : message;
        displayBody = TruncateDataValue(displayBody);

        await SendPushAsync(
            deviceToken,
            data,
            notificationTitle: title,
            notificationBody: displayBody,
            androidNotificationChannelId: ChatNotificationChannelId,
            cancellationToken
        );
    }

    public async Task SendIncomingCallNotificationAsync(
        string deviceToken,
        Guid chatId,
        Guid callerId,
        string callerName,
        CancellationToken cancellationToken = default
    )
    {
        await SendDataOnlyPushAsync(
            deviceToken,
            new Dictionary<string, string>
            {
                ["type"] = "incoming_call",
                ["chat_id"] = chatId.ToString(),
                ["room_id"] = chatId.ToString(),
                ["caller_id"] = callerId.ToString(),
                ["caller_name"] = callerName,
                ["title"] = "Incoming call",
                ["message"] = $"{callerName} is calling you"
            },
            cancellationToken
        );
    }

    public async Task SendFriendRequestNotificationAsync(
        string deviceToken,
        Guid requestId,
        Guid senderId,
        string senderUsername,
        CancellationToken cancellationToken = default
    )
    {
        var displayName = string.IsNullOrWhiteSpace(senderUsername) ? "Пользователь" : senderUsername.Trim();
        var title = "Запрос в друзья";
        var message = $"{displayName} хочет добавить вас в друзья";

        await SendPushAsync(
            deviceToken,
            new Dictionary<string, string>
            {
                ["type"] = "friend_request",
                ["request_id"] = requestId.ToString(),
                ["sender_id"] = senderId.ToString(),
                ["sender_username"] = displayName,
                ["title"] = title,
                ["message"] = message
            },
            notificationTitle: title,
            notificationBody: message,
            androidNotificationChannelId: FriendRequestNotificationChannelId,
            cancellationToken
        );
    }

    private const string ChatNotificationChannelId = "chat_messages_v3";
    private const string FriendRequestNotificationChannelId = "friend_requests_v1";

    /// <summary>
    /// Data-only push — used for incoming calls (custom full-screen UI on Android).
    /// </summary>
    private async Task SendDataOnlyPushAsync(
        string deviceToken,
        Dictionary<string, string> data,
        CancellationToken cancellationToken = default
    )
    {
        await SendPushAsync(
            deviceToken,
            data,
            notificationTitle: null,
            notificationBody: null,
            androidNotificationChannelId: null,
            cancellationToken
        );
    }

    /// <summary>
    /// Notification + data push — system tray when app is killed/background; data for in-app handling.
    /// </summary>
    private async Task SendPushAsync(
        string deviceToken,
        Dictionary<string, string> data,
        string? notificationTitle,
        string? notificationBody,
        string? androidNotificationChannelId,
        CancellationToken cancellationToken = default
    )
    {
        if (_credential == null || string.IsNullOrWhiteSpace(_projectId))
        {
            _logger.LogDebug("Firebase is not configured, push notification skipped");
            return;
        }

        var accessToken = await _credential.UnderlyingCredential.GetAccessTokenForRequestAsync(
            null,
            cancellationToken
        );

        var client = _httpClientFactory.CreateClient(nameof(FirebasePushSender));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var hasNotification =
            !string.IsNullOrWhiteSpace(notificationTitle) &&
            !string.IsNullOrWhiteSpace(androidNotificationChannelId);

        object messagePayload = hasNotification
            ? new
            {
                token = deviceToken,
                notification = new
                {
                    title = notificationTitle,
                    body = notificationBody ?? string.Empty,
                },
                data,
                android = new
                {
                    priority = "high",
                    direct_boot_ok = true,
                    notification = new
                    {
                        channel_id = androidNotificationChannelId,
                        sound = "default",
                        notification_priority = "PRIORITY_HIGH",
                        default_vibrate_timings = true,
                        default_sound = true,
                    },
                },
            }
            : new
            {
                token = deviceToken,
                data,
                android = new
                {
                    priority = "high",
                    direct_boot_ok = true,
                },
            };

        // Chat/friend: notification+data so Android shows tray notification when app is killed.
        // Calls stay data-only for custom IncomingCallActivity / full-screen intent.
        var response = await client.PostAsJsonAsync(
            $"https://fcm.googleapis.com/v1/projects/{_projectId}/messages:send",
            new { message = messagePayload },
            cancellationToken
        );

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning(
                "FCM send failed with status {StatusCode}. Response: {Body}",
                response.StatusCode,
                errorBody
            );
        }
    }

    private static string TruncateDataValue(string value, int maxLength = 512)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private void TryInitialize()
    {
        var serviceAccountPath = _configuration["Firebase:ServiceAccountJsonPath"];
        _projectId = _configuration["Firebase:ProjectId"];

        if (string.IsNullOrWhiteSpace(serviceAccountPath) || string.IsNullOrWhiteSpace(_projectId))
        {
            _logger.LogWarning("Firebase settings are missing. Set Firebase:ProjectId and Firebase:ServiceAccountJsonPath");
            return;
        }

        if (!Path.IsPathRooted(serviceAccountPath))
        {
            serviceAccountPath = Path.GetFullPath(
                Path.Combine(AppContext.BaseDirectory, serviceAccountPath)
            );
        }

        if (!File.Exists(serviceAccountPath))
        {
            _logger.LogWarning("Firebase service account file not found: {Path}", serviceAccountPath);
            return;
        }

        _credential = GoogleCredential
            .FromFile(serviceAccountPath)
            .CreateScoped(Scopes);
    }
}
