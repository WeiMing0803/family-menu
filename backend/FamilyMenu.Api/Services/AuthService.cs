using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using FamilyMenu.Api.Data;
using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Models.Entities;
using FamilyMenu.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FamilyMenu.Api.Services;

public interface IAuthService
{
    Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    Task<UserResponse?> GetCurrentUserAsync(int userId, CancellationToken cancellationToken);
}

public sealed class AuthService(
    AppDbContext db,
    IHttpClientFactory httpClientFactory,
    IOptions<JwtOptions> jwtOptions,
    IOptions<WechatOptions> wechatOptions,
    IHostEnvironment environment,
    ILogger<AuthService> logger) : IAuthService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;
    private readonly WechatOptions _wechatOptions = wechatOptions.Value;

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var openId = await ResolveOpenIdAsync(request, cancellationToken);
        if (string.IsNullOrWhiteSpace(openId))
        {
            return null;
        }

        var user = await db.Users.SingleOrDefaultAsync(x => x.OpenId == openId, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                OpenId = openId,
                NickName = string.IsNullOrWhiteSpace(request.NickName) ? "家庭成员" : request.NickName.Trim(),
                AvatarUrl = request.AvatarUrl?.Trim()
            };
            db.Users.Add(user);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(request.NickName))
            {
                user.NickName = request.NickName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.AvatarUrl))
            {
                user.AvatarUrl = request.AvatarUrl.Trim();
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        var (token, expiresAt) = CreateToken(user);
        return new AuthResponse(token, expiresAt, UserResponse.FromEntity(user));
    }

    public async Task<UserResponse?> GetCurrentUserAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        return user is null ? null : UserResponse.FromEntity(user);
    }

    private async Task<string?> ResolveOpenIdAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Code) &&
            !string.IsNullOrWhiteSpace(_wechatOptions.AppId) &&
            !string.IsNullOrWhiteSpace(_wechatOptions.AppSecret))
        {
            try
            {
                var client = httpClientFactory.CreateClient("Wechat");
                var query = $"sns/jscode2session?appid={Uri.EscapeDataString(_wechatOptions.AppId.Trim())}&secret={Uri.EscapeDataString(_wechatOptions.AppSecret.Trim())}&js_code={Uri.EscapeDataString(request.Code.Trim())}&grant_type=authorization_code";
                using var response = await client.GetAsync(query, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogWarning("微信登录请求返回 HTTP {StatusCode}", response.StatusCode);
                    return null;
                }

                var result = await response.Content.ReadFromJsonAsync<WechatSessionResponse>(cancellationToken);
                if (!string.IsNullOrWhiteSpace(result?.OpenId))
                {
                    return result.OpenId;
                }

                logger.LogWarning("微信登录失败，微信错误码：{ErrorCode}", result?.ErrorCode);
                return null;
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning("调用微信登录接口超时");
                return null;
            }
            catch (HttpRequestException exception)
            {
                logger.LogWarning("调用微信登录接口失败，异常类型：{ExceptionType}", exception.GetType().Name);
                return null;
            }
            catch (JsonException exception)
            {
                logger.LogWarning("微信登录响应格式无效，异常类型：{ExceptionType}", exception.GetType().Name);
                return null;
            }
        }

        if (environment.IsDevelopment() && _wechatOptions.AllowDevelopmentOpenId && !string.IsNullOrWhiteSpace(request.OpenId))
        {
            return request.OpenId.Trim();
        }

        return null;
    }

    private (string Token, DateTime ExpiresAt) CreateToken(User user)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.NickName)
        };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expiresAt);
    }

    private sealed class WechatSessionResponse
    {
        [JsonPropertyName("openid")]
        public string? OpenId { get; set; }

        [JsonPropertyName("errcode")]
        public int? ErrorCode { get; set; }

        [JsonPropertyName("errmsg")]
        public string? ErrorMessage { get; set; }
    }
}
