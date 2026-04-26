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
        CancellationToken cancellationToken = default
    )
    {
        await SendDataPushAsync(
            deviceToken,
            new Dictionary<string, string>
            {
                ["chat_id"] = chatId.ToString(),
                ["chat_title"] = title,
                ["title"] = title,
                ["message"] = message,
                ["type"] = "chat_message"
            },
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
        await SendDataPushAsync(
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

    private async Task SendDataPushAsync(
        string deviceToken,
        Dictionary<string, string> data,
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

        var response = await client.PostAsJsonAsync(
            $"https://fcm.googleapis.com/v1/projects/{_projectId}/messages:send",
            new
            {
                message = new
                {
                    token = deviceToken,
                    data,
                    android = new
                    {
                        priority = "high"
                    }
                }
            },
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
