using FamilyMenu.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace FamilyMenu.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Family> Families => Set<Family>();

    public DbSet<Dish> Dishes => Set<Dish>();

    public DbSet<Order> Orders => Set<Order>();

    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OpenId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.NickName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.AvatarUrl).HasMaxLength(500);
            entity.HasIndex(x => x.OpenId).IsUnique();
            entity.HasOne(x => x.Family)
                .WithMany(x => x.Members)
                .HasForeignKey(x => x.FamilyId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Family>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
            entity.Property(x => x.InviteCode).HasMaxLength(6).IsRequired();
            entity.HasIndex(x => x.InviteCode).IsUnique();
        });

        modelBuilder.Entity<Dish>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Category).HasMaxLength(30).IsRequired();
            entity.Property(x => x.Remark).HasMaxLength(500);
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.HasIndex(x => new { x.FamilyId, x.Category });
            entity.HasOne(x => x.Family).WithMany(x => x.Dishes).HasForeignKey(x => x.FamilyId);
            entity.HasOne(x => x.Creator).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => new { x.FamilyId, x.OrderDate });
            entity.HasOne(x => x.Family).WithMany(x => x.Orders).HasForeignKey(x => x.FamilyId);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Remark).HasMaxLength(500);
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.HasIndex(x => x.OrderId);
            entity.HasOne(x => x.Order).WithMany(x => x.Items).HasForeignKey(x => x.OrderId);
            entity.HasOne(x => x.Dish).WithMany(x => x.OrderItems).HasForeignKey(x => x.DishId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.AddedByUser).WithMany().HasForeignKey(x => x.AddedBy).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
