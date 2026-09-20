using System.Security.Claims;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FamilyMenu.Api.Controllers;

public abstract class FamilyMenuControllerBase : ControllerBase
{
    protected int? UserId
    {
        get
        {
            var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(claimValue, out var userId) ? userId : null;
        }
    }

    protected ActionResult<T> ToActionResult<T>(ServiceResult<T> result) =>
        result.Success
            ? new ObjectResult(result.Value) { StatusCode = result.StatusCode }
            : Problem(statusCode: result.StatusCode, title: "请求失败", detail: result.Error);

    protected IActionResult ToNoContentResult(ServiceResult<bool> result) =>
        result.Success
            ? NoContent()
            : Problem(statusCode: result.StatusCode, title: "请求失败", detail: result.Error);

    protected async Task<ActionResult<T>> ExecuteAsync<T>(Func<Task<ServiceResult<T>>> action) =>
        ToActionResult(await action());

    protected ActionResult UnauthorizedProblem() =>
        Problem(statusCode: StatusCodes.Status401Unauthorized, title: "未授权", detail: "登录已失效或用户不存在");
}
