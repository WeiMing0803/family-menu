namespace FamilyMenu.Api.Models.Entities;

public static class OrderStatuses
{
    public const string Active = "Active";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
}

public sealed class Order
{
    public int Id { get; set; }

    public int FamilyId { get; set; }

    public DateTime OrderDate { get; set; }

    public string Status { get; set; } = OrderStatuses.Active;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Family? Family { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}
