using System.ComponentModel.DataAnnotations;
using FamilyMenu.Api.Models.Entities;

namespace FamilyMenu.Api.Models.Dtos;

public sealed class LoginRequest : IValidatableObject
{
    [StringLength(256, MinimumLength = 1)]
    [RegularExpression(@"^\S+$", ErrorMessage = "Code 不能包含空白字符")]
    public string? Code { get; set; }

    [StringLength(100, MinimumLength = 1)]
    [RegularExpression(@"^\S+$", ErrorMessage = "OpenId 不能包含空白字符")]
    public string? OpenId { get; set; }

    [StringLength(100)]
    public string? NickName { get; set; }

    [Url]
    [StringLength(500)]
    public string? AvatarUrl { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Code) && string.IsNullOrWhiteSpace(OpenId))
        {
            yield return new ValidationResult("必须提供微信 Code", [nameof(Code), nameof(OpenId)]);
        }
    }
}

public sealed record UserResponse(
    int Id,
    string NickName,
    string? AvatarUrl,
    int? FamilyId,
    DateTime CreatedAt)
{
    public static UserResponse FromEntity(User user) =>
        new(user.Id, user.NickName, user.AvatarUrl, user.FamilyId, user.CreatedAt);
}

public sealed record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);
