using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamilyMenu.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/orders")]
public sealed class OrdersController(IOrderService orderService) : FamilyMenuControllerBase
{
    [HttpGet("today")]
    public async Task<ActionResult<OrderResponse>> Today(CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await orderService.GetTodayAsync(UserId.Value, cancellationToken));
    }

    [HttpPost("items")]
    public async Task<ActionResult<OrderResponse>> AddItem(AddOrderItemRequest request, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await orderService.AddItemAsync(UserId.Value, request, cancellationToken));
    }

    [HttpPut("items/{id:int}")]
    public async Task<ActionResult<OrderResponse>> UpdateItem(int id, UpdateOrderItemRequest request, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await orderService.UpdateItemAsync(UserId.Value, id, request, cancellationToken));
    }

    [HttpDelete("items/{id:int}")]
    public async Task<IActionResult> DeleteItem(int id, CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToNoContentResult(await orderService.DeleteItemAsync(UserId.Value, id, cancellationToken));
    }

    [HttpPost("clear")]
    public async Task<IActionResult> Clear(CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToNoContentResult(await orderService.ClearTodayAsync(UserId.Value, cancellationToken));
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<OrderResponse>>> History(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        if (!UserId.HasValue)
        {
            return UnauthorizedProblem();
        }

        return ToActionResult(await orderService.HistoryAsync(UserId.Value, from, to, cancellationToken));
    }
}
