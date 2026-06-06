namespace WhithinMessenger.Application.Options;

public class EmailSettings
{
    public const string SectionName = "Email";

    public bool Enabled { get; set; } = true;

    public string SmtpHost { get; set; } = string.Empty;

    public int SmtpPort { get; set; } = 587;

    public string? SmtpUser { get; set; }

    public string? SmtpPassword { get; set; }

    /// <summary>STARTTLS when true; none for local Mailpit.</summary>
    public bool UseSsl { get; set; } = true;

    public string FromAddress { get; set; } = "noreply@whithin.ru";

    public string FromName { get; set; } = "Whithin";

    public string FrontendBaseUrl { get; set; } = "https://whithin.ru";
}
