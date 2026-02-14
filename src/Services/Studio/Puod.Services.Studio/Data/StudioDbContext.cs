using Microsoft.EntityFrameworkCore;
using Puod.Services.Studio.Models;

namespace Puod.Services.Studio.Data;

public class StudioDbContext : DbContext
{
    public StudioDbContext(DbContextOptions<StudioDbContext> options)
        : base(options)
    {
    }

    public DbSet<StudioCard> StudioCards => Set<StudioCard>();
    public DbSet<StudioDashboard> StudioDashboards => Set<StudioDashboard>();
    public DbSet<StudioDashboardCard> StudioDashboardCards => Set<StudioDashboardCard>();
    public DbSet<StudioShare> StudioShares => Set<StudioShare>();
    public DbSet<StudioCardCache> StudioCardCache => Set<StudioCardCache>();
    public DbSet<UserGroupLink> UserGroupLinks => Set<UserGroupLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StudioCard>(entity =>
        {
            entity.ToTable("studio_cards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.OwnerUserId).HasColumnName("owner_user_id");
            entity.Property(e => e.Scope).HasColumnName("scope");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.ProfileId).HasColumnName("profile_id");
            entity.Property(e => e.Title).HasColumnName("title").IsRequired().HasMaxLength(200);
            entity.Property(e => e.CardType).HasColumnName("card_type").IsRequired().HasMaxLength(100);
            entity.Property(e => e.LayoutType).HasColumnName("layout_type").IsRequired().HasMaxLength(50);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(1000);
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.IntegrationId).HasColumnName("integration_id");
            entity.Property(e => e.Query).HasColumnName("query");
            entity.Property(e => e.FieldsJson).HasColumnName("fields_json").HasColumnType("jsonb");
            entity.Property(e => e.StyleJson).HasColumnName("style_json").HasColumnType("jsonb");
            entity.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb");
            entity.Property(e => e.RefreshPolicyJson).HasColumnName("refresh_policy_json").HasColumnType("jsonb");
            entity.Property(e => e.DataSourceJson).HasColumnName("data_source_json").HasColumnType("jsonb");
            entity.Property(e => e.LastTestedAt).HasColumnName("last_tested_at");
            entity.Property(e => e.LastTestSucceeded).HasColumnName("last_test_succeeded");
            entity.Property(e => e.LastTestSignature).HasColumnName("last_test_signature").HasMaxLength(128);
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasIndex(e => e.ClientId);
            entity.HasIndex(e => e.ProfileId);
            entity.HasIndex(e => e.IntegrationId);
        });

        modelBuilder.Entity<StudioDashboard>(entity =>
        {
            entity.ToTable("studio_dashboards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.OwnerUserId).HasColumnName("owner_user_id");
            entity.Property(e => e.Scope).HasColumnName("scope");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.ProfileId).HasColumnName("profile_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired().HasMaxLength(200);
            entity.Property(e => e.LayoutType).HasColumnName("layout_type").IsRequired().HasMaxLength(50);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(1000);
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb");
            entity.Property(e => e.RefreshPolicyJson).HasColumnName("refresh_policy_json").HasColumnType("jsonb");
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            entity.HasIndex(e => e.OwnerUserId);
            entity.HasIndex(e => e.ClientId);
            entity.HasIndex(e => e.ProfileId);
        });

        modelBuilder.Entity<StudioDashboardCard>(entity =>
        {
            entity.ToTable("studio_dashboard_cards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.DashboardId).HasColumnName("dashboard_id");
            entity.Property(e => e.CardId).HasColumnName("card_id");
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(200);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(1000);
            entity.Property(e => e.ShowTitle).HasColumnName("show_title").HasDefaultValue(true);
            entity.Property(e => e.ShowDescription).HasColumnName("show_description").HasDefaultValue(true);
            entity.Property(e => e.IntegrationId).HasColumnName("integration_id");
            entity.Property(e => e.OrderIndex).HasColumnName("order_index");
            entity.Property(e => e.PositionX).HasColumnName("position_x");
            entity.Property(e => e.PositionY).HasColumnName("position_y");
            entity.Property(e => e.Width).HasColumnName("width");
            entity.Property(e => e.Height).HasColumnName("height");
            entity.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb");
            entity.Property(e => e.RefreshPolicyJson).HasColumnName("refresh_policy_json").HasColumnType("jsonb");
            entity.Property(e => e.DataSourceJson).HasColumnName("data_source_json").HasColumnType("jsonb");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            entity.HasIndex(e => e.DashboardId);
            entity.HasIndex(e => e.CardId);
            entity.HasOne<StudioDashboard>()
                .WithMany()
                .HasForeignKey(e => e.DashboardId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<StudioCard>()
                .WithMany()
                .HasForeignKey(e => e.CardId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudioShare>(entity =>
        {
            entity.ToTable("studio_shares");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TargetType).HasColumnName("target_type");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.SubjectType).HasColumnName("subject_type");
            entity.Property(e => e.SubjectId).HasColumnName("subject_id");
            entity.Property(e => e.AccessLevel).HasColumnName("access_level");
            entity.Property(e => e.SharedByUserId).HasColumnName("shared_by_user_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            entity.HasIndex(e => new { e.TargetType, e.TargetId });
            entity.HasIndex(e => new { e.SubjectType, e.SubjectId });
        });

        modelBuilder.Entity<StudioCardCache>(entity =>
        {
            entity.ToTable("studio_card_cache");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CardId).HasColumnName("card_id");
            entity.Property(e => e.RefreshedAt).HasColumnName("refreshed_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.Success).HasColumnName("success");
            entity.Property(e => e.DataJson).HasColumnName("data_json").HasColumnType("jsonb");
            entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
            entity.HasIndex(e => e.CardId);
            entity.HasOne<StudioCard>()
                .WithMany()
                .HasForeignKey(e => e.CardId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserGroupLink>(entity =>
        {
            entity.ToTable("user_groups", table => table.ExcludeFromMigrations());
            entity.HasKey(e => new { e.UserId, e.GroupId });
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.GroupId).HasColumnName("group_id");
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted");
        });
    }
}
