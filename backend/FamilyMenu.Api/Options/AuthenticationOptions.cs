namespace FamilyMenu.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "FamilyMenu.Api";

    public string Audience { get; set; } = "FamilyMenu.MiniProgram";

    public string Secret { get; set; } = string.Empty;

    public int ExpirationMinutes { get; set; } = 10080;
}

public sealed class WechatOptions
{
    public const string SectionName = "Wechat";

    public string AppId { get; set; } = string.Empty;

    public string AppSecret { get; set; } = string.Empty;

    public bool AllowDevelopmentOpenId { get; set; }
}

public sealed class CorsOptions
{
    public const string SectionName = "Cors";

    public string[] AllowedOrigins { get; set; } = [];
}
