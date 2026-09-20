namespace FamilyMenu.Api.Models.Entities;

public sealed class Dish
{
    public int Id { get; set; }

    public int FamilyId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Category { get; set; } = "其他";

    public string? Remark { get; set; }

    public string? ImageUrl { get; set; }

    public bool IsFavorite { get; set; }

    public int CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Family? Family { get; set; }

    public User? Creator { get; set; }

    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
