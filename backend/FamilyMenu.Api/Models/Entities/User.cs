namespace FamilyMenu.Api.Models.Entities;

public sealed class User
{
    /// <summary>微信登录不提供昵称，新用户先用这个占位，等用户在小程序里自己设置。</summary>
    public const string DefaultNickName = "家庭成员";

    public int Id { get; set; }

    public string OpenId { get; set; } = string.Empty;

    public string NickName { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }

    public int? FamilyId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Family? Family { get; set; }
}
