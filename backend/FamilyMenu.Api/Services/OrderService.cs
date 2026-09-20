using FamilyMenu.Api.Data;
using FamilyMenu.Api.Hubs;
using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Models.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FamilyMenu.Api.Services;

public interface IOrderService
{
    Task<ServiceResult<OrderResponse>> GetTodayAsync(int userId, CancellationToken cancellationToken);

    Task<ServiceResult<OrderResponse>> AddItemAsync(int userId, AddOrderItemRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<OrderResponse>> UpdateItemAsync(int userId, int itemId, UpdateOrderItemRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<bool>> DeleteItemAsync(int userId, int itemId, CancellationToken cancellationToken);

    Task<ServiceResult<bool>> ClearTodayAsync(int userId, CancellationToken cancellationToken);

    Task<ServiceResult<IReadOnlyList<OrderResponse>>> HistoryAsync(int userId, DateTime? from, DateTime? to, CancellationToken cancellationToken);
}

public sealed class OrderService(AppDbContext db, IHubContext<FamilyHub> hub) : IOrderService
{
    public async Task<ServiceResult<OrderResponse>> GetTodayAsync(int userId, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<OrderResponse>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        var today = UtcToday();
        var order = await FindOrderAsync(familyId.Value, today, cancellationToken);
        return ServiceResult<OrderResponse>.Ok(order is null ? OrderResponse.Empty(today) : OrderResponse.FromEntity(order));
    }

    public async Task<ServiceResult<OrderResponse>> AddItemAsync(int userId, AddOrderItemRequest request, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<OrderResponse>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        var dish = await db.Dishes.SingleOrDefaultAsync(x => x.Id == request.DishId && x.FamilyId == familyId.Value, cancellationToken);
        if (dish is null)
        {
            return ServiceResult<OrderResponse>.Fail(StatusCodes.Status404NotFound, "菜品不存在或不属于当前家庭");
        }

        var today = UtcToday();
        var order = await FindOrderAsync(familyId.Value, today, cancellationToken);
        if (order is null)
        {
            order = new Order { FamilyId = familyId.Value, OrderDate = today, Status = OrderStatuses.Active };
            db.Orders.Add(order);
        }

        var item = new OrderItem
        {
            DishId = dish.Id,
            Quantity = request.Quantity,
            Remark = NormalizeOptional(request.Remark),
            AddedBy = userId,
            Status = OrderItemStatuses.Pending
        };
        order.Items.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(familyId.Value, "itemAdded", item.Id, cancellationToken);
        return ServiceResult<OrderResponse>.Created(OrderResponse.FromEntity(order));
    }

    public async Task<ServiceResult<OrderResponse>> UpdateItemAsync(int userId, int itemId, UpdateOrderItemRequest request, CancellationToken cancellationToken)
    {
        var item = await FindItemAsync(userId, itemId, cancellationToken);
        if (item is null || item.Order is null)
        {
            return ServiceResult<OrderResponse>.Fail(StatusCodes.Status404NotFound, "点餐项不存在");
        }

        if (request.Quantity.HasValue)
        {
            item.Quantity = request.Quantity.Value;
        }

        if (request.Remark is not null)
        {
            item.Remark = NormalizeOptional(request.Remark);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            item.Status = request.Status;
        }

        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(item.Order.FamilyId, "itemUpdated", item.Id, cancellationToken);
        var order = await FindOrderByIdAsync(item.OrderId, cancellationToken);
        return ServiceResult<OrderResponse>.Ok(OrderResponse.FromEntity(order!));
    }

    public async Task<ServiceResult<bool>> DeleteItemAsync(int userId, int itemId, CancellationToken cancellationToken)
    {
        var item = await FindItemAsync(userId, itemId, cancellationToken);
        if (item is null || item.Order is null)
        {
            return ServiceResult<bool>.Fail(StatusCodes.Status404NotFound, "点餐项不存在");
        }

        var familyId = item.Order.FamilyId;
        db.OrderItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(familyId, "itemDeleted", itemId, cancellationToken);
        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<bool>> ClearTodayAsync(int userId, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<bool>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        var order = await FindOrderAsync(familyId.Value, UtcToday(), cancellationToken);
        if (order is null)
        {
            return ServiceResult<bool>.Ok(true);
        }

        order.Status = OrderStatuses.Cancelled;
        foreach (var item in order.Items)
        {
            item.Status = OrderItemStatuses.Cancelled;
        }

        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(familyId.Value, "cleared", order.Id, cancellationToken);
        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<IReadOnlyList<OrderResponse>>> HistoryAsync(int userId, DateTime? from, DateTime? to, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<IReadOnlyList<OrderResponse>>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
        {
            return ServiceResult<IReadOnlyList<OrderResponse>>.Fail(StatusCodes.Status400BadRequest, "起始日期不能晚于结束日期");
        }

        var query = db.Orders
            .AsNoTracking()
            .Include(x => x.Items)
            .ThenInclude(x => x.Dish)
            .Where(x => x.FamilyId == familyId.Value);
        if (from.HasValue)
        {
            query = query.Where(x => x.OrderDate >= from.Value.Date);
        }

        if (to.HasValue)
        {
            query = query.Where(x => x.OrderDate <= to.Value.Date);
        }

        var orders = await query.OrderByDescending(x => x.OrderDate).Take(100).ToListAsync(cancellationToken);
        return ServiceResult<IReadOnlyList<OrderResponse>>.Ok(orders.Select(OrderResponse.FromEntity).ToList());
    }

    private async Task<Order?> FindOrderAsync(int familyId, DateTime date, CancellationToken cancellationToken) =>
        await db.Orders
            .Include(x => x.Items)
            .ThenInclude(x => x.Dish)
            .SingleOrDefaultAsync(x => x.FamilyId == familyId && x.OrderDate == date && x.Status == OrderStatuses.Active, cancellationToken);

    private async Task<Order?> FindOrderByIdAsync(int orderId, CancellationToken cancellationToken) =>
        await db.Orders
            .Include(x => x.Items)
            .ThenInclude(x => x.Dish)
            .SingleOrDefaultAsync(x => x.Id == orderId, cancellationToken);

    private async Task<OrderItem?> FindItemAsync(int userId, int itemId, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        return familyId.HasValue
            ? await db.OrderItems.Include(x => x.Order).ThenInclude(x => x!.Family).Include(x => x.Dish)
                .SingleOrDefaultAsync(x => x.Id == itemId && x.Order!.FamilyId == familyId.Value, cancellationToken)
            : null;
    }

    private Task<int?> GetFamilyIdAsync(int userId, CancellationToken cancellationToken) =>
        db.Users.Where(x => x.Id == userId).Select(x => x.FamilyId).SingleOrDefaultAsync(cancellationToken);

    private Task NotifyAsync(int familyId, string action, int resourceId, CancellationToken cancellationToken) =>
        hub.Clients.Group(FamilyHub.GroupName(familyId)).SendAsync("OrderChanged", new { action, resourceId }, cancellationToken);

    private static DateTime UtcToday() => DateTime.UtcNow.Date;

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
