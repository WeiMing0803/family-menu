using System.Security.Claims;
using FamilyMenu.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FamilyMenu.Api.Hubs;

[Authorize]
public sealed class FamilyHub(AppDbContext db, ILogger<FamilyHub> logger) : Hub
{
    public static string GroupName(int familyId) => $"family_{familyId}";

    public override async Task OnConnectedAsync()
    {
        var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out var userId))
        {
            Context.Abort();
            return;
        }

        var familyId = await db.Users
            .Where(x => x.Id == userId)
            .Select(x => x.FamilyId)
            .SingleOrDefaultAsync(Context.ConnectionAborted);
        if (!familyId.HasValue)
        {
            logger.LogInformation("用户 {UserId} 连接 SignalR 时尚未加入家庭", userId);
            await Clients.Caller.SendAsync("FamilyUnavailable", new { message = "请先加入家庭" }, Context.ConnectionAborted);
        }
        else
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(familyId.Value), Context.ConnectionAborted);
        }

        await base.OnConnectedAsync();
    }
}
