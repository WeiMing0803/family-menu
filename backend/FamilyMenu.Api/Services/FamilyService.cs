using System.Security.Cryptography;
using FamilyMenu.Api.Data;
using FamilyMenu.Api.Models.Dtos;
using FamilyMenu.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace FamilyMenu.Api.Services;

public interface IFamilyService
{
    Task<ServiceResult<FamilyResponse>> CreateAsync(int userId, CreateFamilyRequest request, CancellationToken cancellationToken);

    Task<ServiceResult<FamilyResponse>> JoinAsync(int userId, JoinFamilyRequest request, CancellationToken cancellationToken);

    Task<FamilyResponse?> GetCurrentFamilyAsync(int userId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MemberResponse>> GetMembersAsync(int userId, CancellationToken cancellationToken);
}

public sealed class FamilyService(AppDbContext db) : IFamilyService
{
    private const int MaxMembers = 2;
    private const string InviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public async Task<ServiceResult<FamilyResponse>> CreateAsync(int userId, CreateFamilyRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status401Unauthorized, "用户不存在或登录已失效");
        }

        if (user.FamilyId.HasValue)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status409Conflict, "当前用户已经加入家庭");
        }

        var family = new Family
        {
            Name = string.IsNullOrWhiteSpace(request.Name) ? "我们的家" : request.Name.Trim(),
            InviteCode = await CreateInviteCodeAsync(cancellationToken)
        };
        family.Members.Add(user);
        db.Families.Add(family);
        await db.SaveChangesAsync(cancellationToken);

        return ServiceResult<FamilyResponse>.Created(FamilyResponse.FromEntity(family));
    }

    public async Task<ServiceResult<FamilyResponse>> JoinAsync(int userId, JoinFamilyRequest request, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status401Unauthorized, "用户不存在或登录已失效");
        }

        if (user.FamilyId.HasValue)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status409Conflict, "当前用户已经加入家庭");
        }

        var inviteCode = request.InviteCode.Trim().ToUpperInvariant();
        var family = await db.Families.Include(x => x.Members).SingleOrDefaultAsync(x => x.InviteCode == inviteCode, cancellationToken);
        if (family is null)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status404NotFound, "邀请码不存在");
        }

        if (family.Members.Count >= MaxMembers)
        {
            return ServiceResult<FamilyResponse>.Fail(StatusCodes.Status409Conflict, "该家庭成员已满");
        }

        family.Members.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        return ServiceResult<FamilyResponse>.Ok(FamilyResponse.FromEntity(family));
    }

    public async Task<FamilyResponse?> GetCurrentFamilyAsync(int userId, CancellationToken cancellationToken)
    {
        var familyId = await db.Users
            .AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => x.FamilyId)
            .SingleOrDefaultAsync(cancellationToken);
        if (!familyId.HasValue)
        {
            return null;
        }

        var family = await db.Families
            .AsNoTracking()
            .Include(x => x.Members)
            .SingleOrDefaultAsync(x => x.Id == familyId.Value, cancellationToken);
        return family is null ? null : FamilyResponse.FromEntity(family);
    }

    public async Task<IReadOnlyList<MemberResponse>> GetMembersAsync(int userId, CancellationToken cancellationToken)
    {
        var familyId = await db.Users.Where(x => x.Id == userId).Select(x => x.FamilyId).SingleOrDefaultAsync(cancellationToken);
        if (!familyId.HasValue)
        {
            return Array.Empty<MemberResponse>();
        }

        return await db.Users
            .AsNoTracking()
            .Where(x => x.FamilyId == familyId.Value)
            .OrderBy(x => x.Id)
            .Select(x => new MemberResponse(x.Id, x.NickName, x.AvatarUrl, x.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    private async Task<string> CreateInviteCodeAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var buffer = RandomNumberGenerator.GetBytes(6);
            var code = new string(buffer.Select(value => InviteAlphabet[value % InviteAlphabet.Length]).ToArray());
            if (!await db.Families.AnyAsync(x => x.InviteCode == code, cancellationToken))
            {
                return code;
            }
        }

        throw new InvalidOperationException("无法生成唯一家庭邀请码");
    }
}
