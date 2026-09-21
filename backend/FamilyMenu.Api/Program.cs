using System.Text;
using System.Threading.RateLimiting;
using FamilyMenu.Api.Data;
using FamilyMenu.Api.Hubs;
using FamilyMenu.Api.Options;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var knownProxyAddresses = builder.Configuration
    .GetSection("ForwardedHeaders:KnownProxies")
    .Get<string[]>() ?? [];
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
    foreach (var value in knownProxyAddresses)
    {
        if (System.Net.IPAddress.TryParse(value, out var address))
        {
            options.KnownProxies.Add(address);
        }
    }
});

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(options => !string.IsNullOrWhiteSpace(options.Secret) && options.Secret.Length >= 32,
        "Jwt:Secret 至少需要 32 个字符，请通过 User Secrets 或 Jwt__Secret 环境变量配置")
    .Validate(options => !options.Secret.Contains("replace-this-development-secret", StringComparison.OrdinalIgnoreCase),
        "Jwt:Secret 不能使用示例密钥")
    .Validate(options => options.ExpirationMinutes is > 0 and <= 43200,
        "Jwt:ExpirationMinutes 必须在 1 到 43200 分钟之间")
    .ValidateOnStart();
builder.Services.AddOptions<WechatOptions>()
    .Bind(builder.Configuration.GetSection(WechatOptions.SectionName))
    .Validate(options => builder.Environment.IsDevelopment() ||
        (!string.IsNullOrWhiteSpace(options.AppId) && !string.IsNullOrWhiteSpace(options.AppSecret)),
        "生产环境必须配置 Wechat:AppId 和 Wechat:AppSecret")
    .Validate(options => builder.Environment.IsDevelopment() || !options.AllowDevelopmentOpenId,
        "AllowDevelopmentOpenId 只能在 Development 环境启用")
    .ValidateOnStart();
builder.Services.AddOptions<CorsOptions>()
    .Bind(builder.Configuration.GetSection(CorsOptions.SectionName))
    .Validate(options => builder.Environment.IsDevelopment() || (options.AllowedOrigins?.Length ?? 0) > 0,
        "生产环境必须配置至少一个 Cors:AllowedOrigins")
    .Validate(options => options.AllowedOrigins?.All(IsValidOrigin) ?? false,
        "Cors:AllowedOrigins 必须是有效的 origin，例如 https://menu.example.com")
    .ValidateOnStart();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=family.db"));
builder.Services.AddHttpClient("Wechat", client =>
{
    client.BaseAddress = new Uri("https://api.weixin.qq.com/");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddSignalR();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance = context.HttpContext.Request.Path;
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth-login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var corsSettings = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
var allowedOrigins = corsSettings.AllowedOrigins ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

var jwtSettings = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("缺少 Jwt 配置");
if (string.IsNullOrWhiteSpace(jwtSettings.Secret) ||
    jwtSettings.Secret.Length < 32 ||
    jwtSettings.Secret.Contains("replace-this-development-secret", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("Jwt:Secret 未配置或不安全，请通过 User Secrets 或 Jwt__Secret 环境变量设置至少 32 个字符的随机密钥");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/family"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IFamilyService, FamilyService>();
builder.Services.AddScoped<IDishService, DishService>();
builder.Services.AddScoped<IOrderService, OrderService>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<FamilyHub>("/hubs/family");
app.MapHealthChecks("/health");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.Run();

static bool IsValidOrigin(string origin)
{
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) ||
        string.IsNullOrWhiteSpace(uri.Host) ||
        uri.AbsolutePath != "/" ||
        !string.IsNullOrEmpty(uri.Query) ||
        !string.IsNullOrEmpty(uri.Fragment))
    {
        return false;
    }

    return uri.Scheme == Uri.UriSchemeHttps || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
           uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
}
