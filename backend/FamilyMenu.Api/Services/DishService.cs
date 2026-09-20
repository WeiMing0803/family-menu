using FamilyMenu.Api.Data;
using FamilyMenu.Api.Hubs;
using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Models.Entities;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FamilyMenu.Api.Services;

public interface IDishService
{
    Task<ServiceResult<IReadOnlyList<DishResponse>>> ListAsync(int userId, string? category, string? search, bool? favorite, CancellationToken cancellationToken);

    Task<ServiceResult<DishResponse>> CreateAsync(int userId, CreateDishRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<DishResponse>> UpdateAsync(int userId, int dishId, UpdateDishRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<bool>> DeleteAsync(int userId, int dishId, CancellationToken cancellationToken);

    Task<ServiceResult<DishResponse>> ToggleFavoriteAsync(int userId, int dishId, CancellationToken cancellationToken);
}

public sealed class DishService(AppDbContext db, IHubContext<FamilyHub> hub) : IDishService
{
    public async Task<ServiceResult<IReadOnlyList<DishResponse>>> ListAsync(int userId, string? category, string? search, bool? favorite, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<IReadOnlyList<DishResponse>>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        var query = db.Dishes.AsNoTracking().Where(x => x.FamilyId == familyId.Value);
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(x => x.Category == category.Trim());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var keyword = search.Trim();
            query = query.Where(x => x.Name.Contains(keyword) || (x.Remark != null && x.Remark.Contains(keyword)));
        }

        if (favorite.HasValue)
        {
            query = query.Where(x => x.IsFavorite == favorite.Value);
        }

        var dishes = await query.OrderByDescending(x => x.IsFavorite).ThenBy(x => x.Name).ToListAsync(cancellationToken);
        return ServiceResult<IReadOnlyList<DishResponse>>.Ok(dishes.Select(DishResponse.FromEntity).ToList());
    }

    public async Task<ServiceResult<DishResponse>> CreateAsync(int userId, CreateDishRequest request, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        if (!familyId.HasValue)
        {
            return ServiceResult<DishResponse>.Fail(StatusCodes.Status409Conflict, "请先加入家庭");
        }

        var dish = new Dish
        {
            FamilyId = familyId.Value,
            Name = request.Name.Trim(),
            Category = NormalizeCategory(request.Category),
            Remark = NormalizeOptional(request.Remark),
            ImageUrl = NormalizeOptional(request.ImageUrl),
            CreatedBy = userId
        };
        db.Dishes.Add(dish);
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(familyId.Value, "created", dish.Id, cancellationToken);
        return ServiceResult<DishResponse>.Created(DishResponse.FromEntity(dish));
    }

    public async Task<ServiceResult<DishResponse>> UpdateAsync(int userId, int dishId, UpdateDishRequest request, CancellationToken cancellationToken)
    {
        var dish = await FindDishAsync(userId, dishId, cancellationToken);
        if (dish is null)
        {
            return ServiceResult<DishResponse>.Fail(StatusCodes.Status404NotFound, "菜品不存在");
        }

        dish.Name = request.Name.Trim();
        dish.Category = NormalizeCategory(request.Category);
        dish.Remark = NormalizeOptional(request.Remark);
        dish.ImageUrl = NormalizeOptional(request.ImageUrl);
        if (request.IsFavorite.HasValue)
        {
            dish.IsFavorite = request.IsFavorite.Value;
        }

        dish.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(dish.FamilyId, "updated", dish.Id, cancellationToken);
        return ServiceResult<DishResponse>.Ok(DishResponse.FromEntity(dish));
    }

    public async Task<ServiceResult<bool>> DeleteAsync(int userId, int dishId, CancellationToken cancellationToken)
    {
        var dish = await FindDishAsync(userId, dishId, cancellationToken);
        if (dish is null)
        {
            return ServiceResult<bool>.Fail(StatusCodes.Status404NotFound, "菜品不存在");
        }

        if (await db.OrderItems.AnyAsync(x => x.DishId == dishId, cancellationToken))
        {
            return ServiceResult<bool>.Fail(StatusCodes.Status409Conflict, "该菜品已有点餐记录，不能删除");
        }

        db.Dishes.Remove(dish);
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(dish.FamilyId, "deleted", dish.Id, cancellationToken);
        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<DishResponse>> ToggleFavoriteAsync(int userId, int dishId, CancellationToken cancellationToken)
    {
        var dish = await FindDishAsync(userId, dishId, cancellationToken);
        if (dish is null)
        {
            return ServiceResult<DishResponse>.Fail(StatusCodes.Status404NotFound, "菜品不存在");
        }

        dish.IsFavorite = !dish.IsFavorite;
        dish.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await NotifyAsync(dish.FamilyId, "favoriteChanged", dish.Id, cancellationToken);
        return ServiceResult<DishResponse>.Ok(DishResponse.FromEntity(dish));
    }

    private async Task<Dish?> FindDishAsync(int userId, int dishId, CancellationToken cancellationToken)
    {
        var familyId = await GetFamilyIdAsync(userId, cancellationToken);
        return familyId.HasValue
            ? await db.Dishes.SingleOrDefaultAsync(x => x.Id == dishId && x.FamilyId == familyId.Value, cancellationToken)
            : null;
    }

    private Task<int?> GetFamilyIdAsync(int userId, CancellationToken cancellationToken) =>
        db.Users.Where(x => x.Id == userId).Select(x => x.FamilyId).SingleOrDefaultAsync(cancellationToken);

    private Task NotifyAsync(int familyId, string action, int dishId, CancellationToken cancellationToken) =>
        hub.Clients.Group(FamilyHub.GroupName(familyId)).SendAsync("DishChanged", new { action, dishId }, cancellationToken);

    private static string NormalizeCategory(string? category) =>
        string.IsNullOrWhiteSpace(category) ? "其他" : category.Trim();

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
