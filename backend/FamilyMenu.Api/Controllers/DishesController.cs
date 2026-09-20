using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyMenu.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dishes")]
public sealed class DishesController(IDishService dishService) : FamilyMenuControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DishResponse>>> List(
        [FromQuery] string? category,
        [FromQuery] string? search,
        [FromQuery] bool? favorite,
        CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        var result = await dishService.ListAsync(UserId.Value, category, search, favorite, cancellationToken);
        return ToActionResult(result);
    }

    [HttpPost]
    public async Task<ActionResult<DishResponse>> Create(CreateDishRequest request, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await dishService.CreateAsync(UserId.Value, request, cancellationToken));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DishResponse>> Update(int id, UpdateDishRequest request, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await dishService.UpdateAsync(UserId.Value, id, request, cancellationToken));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToNoContentResult(await dishService.DeleteAsync(UserId.Value, id, cancellationToken));
    }

    [HttpPut("{id:int}/favorite")]
    public async Task<ActionResult<DishResponse>> ToggleFavorite(int id, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await dishService.ToggleFavoriteAsync(UserId.Value, id, cancellationToken));
    }
}
