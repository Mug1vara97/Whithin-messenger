using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Google.Apis.Auth.OAuth2;
using WhithinMessenger.Application.Services;

namespace WhithinMessenger.Api.Services;

public class FirebasePushSender : IFirebasePushSender
{
    private static readonly string[] Scopes = ["https://www.googleapis.com/auth/firebase.messaging"];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = null,
    };

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
        string? senderUsername = null,
        string? senderAvatarUrl = null,
        string? senderAvatarColor = null,
        string? serverName = null,
        Guid? serverId = null,
        string? notificationType = null,
        Guid? senderId = null,
        int encryptionVersion = 0,
        string? encryptedMessageContent = null,
        CancellationToken cancellationToken = default
    )
    {
        var data = new Dictionary<string, string>
        {
            ["chat_id"] = chatId.ToString(),
            ["chat_title"] = TruncateDataValue(title),
            ["title"] = TruncateDataValue(title),
            ["message"] = TruncateDataValue(message),
            ["type"] = string.IsNullOrWhiteSpace(notificationType) ? "chat_message" : notificationType.Trim(),
        };

        if (!string.IsNullOrWhiteSpace(messageType))
        {
            // FCM rejects reserved/invalid data keys like "message_type".
            data["msg_type"] = messageType.Trim();
        }

        if (!string.IsNullOrWhiteSpace(previewText))
        {
            data["preview_text"] = TruncateDataValue(previewText.Trim());
        }

        if (!string.IsNullOrWhiteSpace(thumbnailUrl))
        {
            data["thumbnail_url"] = TruncateDataValue(thumbnailUrl.Trim());
        }

        if (!string.IsNullOrWhiteSpace(senderUsername))
        {
            data["sender_username"] = TruncateDataValue(senderUsername.Trim());
        }

        if (!string.IsNullOrWhiteSpace(senderAvatarUrl))
        {
            data["sender_avatar"] = TruncateDataValue(senderAvatarUrl.Trim());
        }

        if (!string.IsNullOrWhiteSpace(senderAvatarColor))
        {
            data["sender_avatar_color"] = TruncateDataValue(senderAvatarColor.Trim());
        }

        if (!string.IsNullOrWhiteSpace(serverName))
        {
            data["server_name"] = TruncateDataValue(serverName.Trim());
        }

        if (serverId.HasValue && serverId.Value != Guid.Empty)
        {
            data["server_id"] = serverId.Value.ToString();
        }

        if (encryptionVersion > 0 && !string.IsNullOrWhiteSpace(encryptedMessageContent))
        {
            data["encryption_version"] = encryptionVersion.ToString();
            data["encrypted_payload"] = TruncateDataValue(encryptedMessageContent.Trim());
        }

        if (senderId.HasValue && senderId.Value != Guid.Empty)
        {
            data["sender_id"] = senderId.Value.ToString();
        }

        // Data-only: Android always calls onMessageReceived → our MessagingStyle (Discord-like).
        // System plain notification is NOT used.
        await SendDataOnlyPushAsync(deviceToken, data, cancellationToken);
    }

    public async Task SendIncomingCallNotificationAsync(
        string deviceToken,
        Guid chatId,
        Guid callerId,
        string callerName,
        string? callerAvatar = null,
        string? callerAvatarColor = null,
        CancellationToken cancellationToken = default
    )
    {
        var displayName = string.IsNullOrWhiteSpace(callerName) ? "Пользователь" : callerName.Trim();
        var title = "Входящий звонок";
        var message = $"{displayName} звонит вам";

        var data = new Dictionary<string, string>
        {
            ["type"] = "incoming_call",
            ["chat_id"] = chatId.ToString(),
            ["room_id"] = chatId.ToString(),
            ["caller_id"] = callerId.ToString(),
            ["caller_name"] = displayName,
            ["title"] = title,
            ["message"] = message,
        };

        if (!string.IsNullOrWhiteSpace(callerAvatar))
        {
            data["caller_avatar"] = callerAvatar.Trim();
        }

        if (!string.IsNullOrWhiteSpace(callerAvatarColor))
        {
            data["caller_avatar_color"] = callerAvatarColor.Trim();
        }

        await SendDataOnlyPushAsync(deviceToken, data, cancellationToken);
    }

    public async Task SendIncomingCallDismissedAsync(
        string deviceToken,
        Guid chatId,
        string reason,
        CancellationToken cancellationToken = default
    )
    {
        var data = new Dictionary<string, string>
        {
            ["type"] = "call_dismissed",
            ["chat_id"] = chatId.ToString(),
            ["room_id"] = chatId.ToString(),
            ["reason"] = string.IsNullOrWhiteSpace(reason) ? "dismissed" : reason.Trim(),
        };

        await SendDataOnlyPushAsync(deviceToken, data, cancellationToken);
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

    private const string ChatNotificationChannelId = "chat_messages_v4";
    private const string FriendRequestNotificationChannelId = "friend_requests_v1";

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

        FcmMessage messagePayload = hasNotification
            ? FcmMessage.WithNotification(
                token: deviceToken,
                title: notificationTitle!,
                body: notificationBody ?? string.Empty,
                data: data,
                channelId: androidNotificationChannelId!
            )
            : FcmMessage.DataOnly(token: deviceToken, data: data);

        var response = await client.PostAsJsonAsync(
            $"https://fcm.googleapis.com/v1/projects/{_projectId}/messages:send",
            new FcmSendRequest { message = messagePayload },
            JsonOptions,
            cancellationToken
        );

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogWarning(
                "FCM send failed. Status={StatusCode}, Type={Type}, HasNotification={HasNotification}, TokenPrefix={TokenPrefix}, Response={Body}",
                response.StatusCode,
                data.GetValueOrDefault("type"),
                hasNotification,
                TruncateToken(deviceToken),
                errorBody
            );
        }
        else
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogInformation(
                "FCM push accepted. Type={Type}, HasNotification={HasNotification}, TokenPrefix={TokenPrefix}, Response={Body}",
                data.GetValueOrDefault("type"),
                hasNotification,
                TruncateToken(deviceToken),
                responseBody
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

    private static string TruncateToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return "(empty)";
        }

        return token.Length <= 12 ? token : token[..12] + "...";
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

    private sealed class FcmSendRequest
    {
        public FcmMessage message { get; init; } = null!;
    }

    private sealed class FcmMessage
    {
        public string token { get; init; } = null!;
        public FcmNotification? notification { get; init; }
        public Dictionary<string, string> data { get; init; } = null!;
        public FcmAndroidConfig? android { get; init; }

        public static FcmMessage WithNotification(
            string token,
            string title,
            string body,
            Dictionary<string, string> data,
            string channelId
        )
        {
            return new FcmMessage
            {
                token = token,
                notification = new FcmNotification { title = title, body = body },
                data = data,
                android = new FcmAndroidConfig
                {
                    priority = "high",
                    direct_boot_ok = true,
                    notification = new FcmAndroidNotification
                    {
                        channel_id = channelId,
                        click_action = "com.whithin.voice.OPEN_CHAT",
                    },
                },
            };
        }

        public static FcmMessage DataOnly(string token, Dictionary<string, string> data)
        {
            return new FcmMessage
            {
                token = token,
                data = data,
                android = new FcmAndroidConfig
                {
                    priority = "high",
                    direct_boot_ok = true,
                },
            };
        }
    }

    private sealed class FcmNotification
    {
        public string title { get; init; } = null!;
        public string body { get; init; } = null!;
    }

    private sealed class FcmAndroidConfig
    {
        public string priority { get; init; } = null!;
        public bool direct_boot_ok { get; init; }
        public FcmAndroidNotification? notification { get; init; }
    }

    private sealed class FcmAndroidNotification
    {
        public string channel_id { get; init; } = null!;
        public string? click_action { get; init; }
    }
}
