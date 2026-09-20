using System.ComponentModel.DataAnnotations;
using FamilyMenu.Api.Models.Entities;

namespace FamilyMenu.Api.Models.Dtos;

public sealed class CreateFamilyRequest
{
    [StringLength(100)]
    public string? Name { get; set; }
}

public sealed class JoinFamilyRequest
{
    [Required]
    [StringLength(6, MinimumLength = 6)]
    [RegularExpression("^[A-Za-z2-9]{6}$", ErrorMessage = "邀请码格式不正确")]
    public string InviteCode { get; set; } = string.Empty;
}

public sealed record FamilyResponse(
    int Id,
    string Name,
    string InviteCode,
    DateTime CreatedAt,
    int MemberCount)
{
    public static FamilyResponse FromEntity(Family family) =>
        new(family.Id, family.Name, family.InviteCode, family.CreatedAt, family.Members.Count);
}

public sealed record MemberResponse(
    int Id,
    string NickName,
    string? AvatarUrl,
    DateTime CreatedAt)
{
    public static MemberResponse FromEntity(User user) =>
        new(user.Id, user.NickName, user.AvatarUrl, user.CreatedAt);
}
