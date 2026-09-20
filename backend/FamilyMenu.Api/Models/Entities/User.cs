namespace FamilyMenu.Api.Models.Entities;

public sealed class User
{
    public int Id { get; set; }

    public string OpenId { get; set; } = string.Empty;

    public string NickName { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public int? FamilyId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Family? Family { get; set; }
}
