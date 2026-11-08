namespace WhithinMessenger.Application.Services;

/// <summary>
/// Temporary kill-switch for end-to-end encryption across API + list previews.
/// Keep in sync with Android <c>E2eConstants.TEMP_DISABLED</c> and web <c>E2E_TEMP_DISABLED</c>.
/// </summary>
public static class E2eFeatureFlags
{
    public const bool TempDisabled = true;
}
