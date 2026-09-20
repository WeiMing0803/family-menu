namespace FamilyMenu.Api.Models.Entities;

public static class OrderItemStatuses
{
    public const string Pending = "Pending";
    public const string Done = "Done";
    public const string Cancelled = "Cancelled";
}

public sealed class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }

    public int DishId { get; set; }

    public int Quantity { get; set; } = 1;

    public string? Remark { get; set; }

    public string Status { get; set; } = OrderItemStatuses.Pending;

    public int AddedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Order? Order { get; set; }

    public Dish? Dish { get; set; }

    public User? AddedByUser { get; set; }
}
