using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyMenu.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/family")]
public sealed class FamilyController(IFamilyService familyService) : FamilyMenuControllerBase
{
    [HttpPost("create")]
    public async Task<ActionResult<FamilyResponse>> Create(CreateFamilyRequest request, CancellationToken cancellationToken)
    {
        return await ExecuteAsync(() => familyService.CreateAsync(UserId!.Value, request, cancellationToken));
    }

    [HttpPost("join")]
    public async Task<ActionResult<FamilyResponse>> Join(JoinFamilyRequest request, CancellationToken cancellationToken)
    {
        return await ExecuteAsync(() => familyService.JoinAsync(UserId!.Value, request, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<FamilyResponse>> Get(CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        var family = await familyService.GetCurrentFamilyAsync(UserId.Value, cancellationToken);
        return family is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "未加入家庭", detail: "当前用户尚未加入家庭")
            : Ok(family);
    }

    [HttpGet("members")]
    public async Task<ActionResult<IReadOnlyList<MemberResponse>>> Members(CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        var members = await familyService.GetMembersAsync(UserId.Value, cancellationToken);
        return Ok(members);
    }
}
