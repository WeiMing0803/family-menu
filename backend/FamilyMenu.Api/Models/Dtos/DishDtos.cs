using System.ComponentModel.DataAnnotations;
using FamilyMenu.Api.Models.Entities;

namespace FamilyMenu.Api.Models.Dtos;

public class CreateDishRequest
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    [RegularExpression(@".*\S.*", ErrorMessage = "菜名不能只包含空白字符")]
    public string Name { get; set; } = string.Empty;

    [StringLength(30)]
    public string? Category { get; set; }

    [StringLength(500)]
    public string? Remark { get; set; }

    [Url]
    [StringLength(500)]
    public string? ImageUrl { get; set; }
}

public sealed class UpdateDishRequest : CreateDishRequest
{
    public bool? IsFavorite { get; set; }
}

public sealed record DishResponse(
    int Id,
    string Name,
    string Category,
    string? Remark,
    string? ImageUrl,
    bool IsFavorite,
    int CreatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static DishResponse FromEntity(Dish dish) =>
        new(dish.Id, dish.Name, dish.Category, dish.Remark, dish.ImageUrl, dish.IsFavorite,
            dish.CreatedBy, dish.CreatedAt, dish.UpdatedAt);
}
