using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FamilyMenu.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : FamilyMenuControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("auth-login")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await authService.LoginAsync(request, cancellationToken);
        return result is null
            ? Problem(statusCode: StatusCodes.Status401Unauthorized,
                title: "登录失败",
                detail: "请提供有效的微信 code；仅 Development 环境允许使用 openId")
            : Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        var user = await authService.GetCurrentUserAsync(UserId.Value, cancellationToken);
        return user is null ? UnauthorizedProblem() : Ok(user);
    }
}
