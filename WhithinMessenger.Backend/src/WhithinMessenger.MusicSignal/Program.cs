using WhithinMessenger.MusicSignal;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<MusicPresenceStore>();
builder.Services.AddSingleton<SyncRelayStore>();
builder.Services.AddControllers();
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 1024 * 1024;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true)
              .AllowCredentials());
});

var app = builder.Build();

app.UseCors();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "music-signal" }));
app.MapControllers();
app.MapHub<MusicSyncHub>("/musicsynchub");

app.Run();
