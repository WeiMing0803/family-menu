namespace FamilyMenu.Api.Models.Entities;

public sealed class Family
{
    public int Id { get; set; }

    public string Name { get; set; } = "我们的家";

    public string InviteCode { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Members { get; set; } = new List<User>();

    public ICollection<Dish> Dishes { get; set; } = new List<Dish>();

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
