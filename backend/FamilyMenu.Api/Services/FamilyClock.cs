using FamilyMenu.Api.Options;
using Microsoft.Extensions.Options;

namespace FamilyMenu.Api.Services;

public interface IFamilyClock
{
    /// <summary>家庭所在时区的当天日期（不含时间），用于归属“今日点餐”。</summary>
    DateTime Today { get; }
}

public sealed class FamilyClock(IOptions<FamilyOptions> options, TimeProvider timeProvider) : IFamilyClock
{
    private readonly TimeZoneInfo _timeZone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZone);

    public DateTime Today => TimeZoneInfo.ConvertTimeFromUtc(timeProvider.GetUtcNow().UtcDateTime, _timeZone).Date;
}
