using System.ComponentModel.DataAnnotations;
using FamilyMenu.Api.Models.Entities;

namespace FamilyMenu.Api.Models.Dtos;

public sealed class AddOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int DishId { get; set; }

    [Range(1, 99)]
    public int Quantity { get; set; } = 1;

    [StringLength(500)]
    public string? Remark { get; set; }
}

public sealed class UpdateOrderItemRequest
{
    [Range(1, 99)]
    public int? Quantity { get; set; }

    [StringLength(500)]
    public string? Remark { get; set; }

    [RegularExpression("^(Pending|Done|Cancelled)$")]
    public string? Status { get; set; }
}

public sealed record OrderItemResponse(
    int Id,
    int DishId,
    string DishName,
    string Category,
    int Quantity,
    string? Remark,
    string Status,
    int AddedBy,
    DateTime CreatedAt)
{
    public static OrderItemResponse FromEntity(OrderItem item) =>
        new(item.Id, item.DishId, item.Dish?.Name ?? string.Empty, item.Dish?.Category ?? string.Empty,
            item.Quantity, item.Remark, item.Status, item.AddedBy, item.CreatedAt);
}

public sealed record OrderResponse(
    int? Id,
    DateTime OrderDate,
    string Status,
    DateTime? CreatedAt,
    IReadOnlyList<OrderItemResponse> Items)
{
    public static OrderResponse FromEntity(Order order) =>
        new(order.Id, order.OrderDate, order.Status, order.CreatedAt,
            order.Items.Select(OrderItemResponse.FromEntity).ToList());

    public static OrderResponse Empty(DateTime orderDate) =>
        new(null, orderDate, OrderStatuses.Active, null, Array.Empty<OrderItemResponse>());
}
