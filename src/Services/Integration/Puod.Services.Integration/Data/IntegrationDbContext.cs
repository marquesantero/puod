using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Data;

public class IntegrationDbContext : DbContext
{
    public IntegrationDbContext(DbContextOptions<IntegrationDbContext> options) : base(options) { }

    public DbSet<Models.Integration> Integrations => Set<Models.Integration>();
    public DbSet<ScheduledMonitor> ScheduledMonitors => Set<ScheduledMonitor>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Models.Integration>(entity =>
        {
            entity.ToTable("integrations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProfileId).HasColumnName("profile_id");
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.OwnerType).HasColumnName("owner_type");
            entity.Property(e => e.CompanyIds).HasColumnName("company_ids");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Name).HasColumnName("name");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Type).HasColumnName("type");
            entity.Property(e => e.ConfigJson).HasColumnName("config_json");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
            entity.Property(e => e.DeletedBy).HasColumnName("deleted_by");
            entity.Property(e => e.Name).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Type).IsRequired();
            entity.Property(e => e.Status).IsRequired();
            entity.Property(e => e.OwnerType).IsRequired();
            entity.Property(e => e.CompanyIds)
                .HasColumnType("bigint[]")
                .HasDefaultValueSql("'{}'::bigint[]")
                .IsRequired();
            entity.Property(e => e.ConfigJson).HasColumnType("text");
            entity.Ignore("Configuration");
            entity.Ignore("IsActive");
            entity.Ignore("LastSyncAt");

            var ownerTypeConverter = new ValueConverter<OwnerType, string>(
                value => value.ToString(),
                value => Enum.Parse<OwnerType>(value, true));
            entity.Property(e => e.OwnerType).HasConversion(ownerTypeConverter);

            var statusConverter = new ValueConverter<IntegrationStatus, string>(
                value => value.ToString(),
                value => Enum.Parse<IntegrationStatus>(value, true));
            entity.Property(e => e.Status).HasConversion(statusConverter);

            var typeConverter = new ValueConverter<ConnectorType, string>(
                value => value.ToString(),
                value => Enum.Parse<ConnectorType>(value, true));
            entity.Property(e => e.Type).HasConversion(typeConverter);

            var companyIdsComparer = new ValueComparer<List<long>>(
                (left, right) => left.SequenceEqual(right),
                value => value.Aggregate(0, (acc, v) => HashCode.Combine(acc, v)),
                value => value.ToList());
            entity.Property(e => e.CompanyIds).Metadata.SetValueComparer(companyIdsComparer);
            entity.HasIndex(e => e.ProfileId);
            entity.HasIndex(e => e.ClientId);
            entity.HasIndex(e => new { e.ProfileId, e.IsDeleted });
        });

        modelBuilder.Entity<ScheduledMonitor>(entity =>
        {
            entity.ToTable("scheduled_monitors");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ResourceType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.ResourceId).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Configuration).HasColumnType("jsonb");
            entity.HasIndex(e => e.IntegrationId);
            entity.HasIndex(e => new { e.IntegrationId, e.IsActive });
            entity.HasIndex(e => new { e.NextPollAt, e.IsActive });
            entity.HasOne(e => e.Integration)
                .WithMany()
                .HasForeignKey(e => e.IntegrationId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
