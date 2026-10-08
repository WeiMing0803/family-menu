using System.Reflection;
using FamilyMenu.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace FamilyMenu.Api.Data;

public static class DatabaseInitializer
{
    public static async Task MigrateAsync(AppDbContext db, ILogger logger, CancellationToken cancellationToken = default)
    {
        await BaselineLegacyDatabaseAsync(db, logger, cancellationToken);

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation("执行数据库迁移：{Migrations}", string.Join(", ", pending));
        }

        await db.Database.MigrateAsync(cancellationToken);
    }

    // 早期版本用 EnsureCreated 建库：有业务表，但没有迁移历史表，直接 Migrate 会重复建表。
    // 这类库的结构与 InitialCreate 一致（最多缺 Families.MaxMembers 列），补齐后登记为已执行即可。
    private static async Task BaselineLegacyDatabaseAsync(AppDbContext db, ILogger logger, CancellationToken cancellationToken)
    {
        var tables = await db.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM sqlite_master WHERE type = 'table'")
            .ToListAsync(cancellationToken);
        if (!tables.Contains("Families") || tables.Contains(HistoryRepository.DefaultTableName))
        {
            return;
        }

        var initialMigration = db.Database.GetMigrations().First();
        var history = db.GetService<IHistoryRepository>();
        var productVersion = typeof(DbContext).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()!
            .InformationalVersion
            .Split('+')[0];

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var familyColumns = await db.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Families')")
            .ToListAsync(cancellationToken);
        if (!familyColumns.Contains(nameof(Family.MaxMembers)))
        {
            await db.Database.ExecuteSqlRawAsync(
                $"ALTER TABLE Families ADD COLUMN MaxMembers INTEGER NOT NULL DEFAULT {Family.MinMemberLimit}",
                cancellationToken);
        }

        await db.Database.ExecuteSqlRawAsync(history.GetCreateIfNotExistsScript(), cancellationToken);
        await db.Database.ExecuteSqlRawAsync(
            history.GetInsertScript(new HistoryRow(initialMigration, productVersion)),
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation("已将旧版 EnsureCreated 数据库登记为迁移 {Migration}", initialMigration);
    }
}
