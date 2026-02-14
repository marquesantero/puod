using System.Linq.Expressions;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Puod.Services.User.Models;

namespace Puod.Services.User.Data;

public class PuodDbContext : DbContext
{
    private readonly ICurrentUserProvider? _currentUserProvider;
    private static readonly JsonSerializerOptions RolesJsonOptions = new();
    private static readonly JsonSerializerOptions DetailsJsonOptions = new();

    public PuodDbContext(DbContextOptions<PuodDbContext> options, ICurrentUserProvider? currentUserProvider = null) : base(options)
    {
        _currentUserProvider = currentUserProvider;
    }

    public DbSet<Models.User> Users => Set<Models.User>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuthProfile> AuthProfiles => Set<AuthProfile>();
    public DbSet<UserTenantRole> UserTenantRoles => Set<UserTenantRole>();
    public DbSet<ClientUserCompanyAvailability> ClientUserCompanyAvailability => Set<ClientUserCompanyAvailability>();
    public DbSet<IntegrationConnection> Integrations => Set<IntegrationConnection>();
    public DbSet<SetupState> SetupStates => Set<SetupState>();
    public DbSet<SetupStepState> SetupStepStates => Set<SetupStepState>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<UserGroup> UserGroups => Set<UserGroup>();
    public DbSet<GroupTenantRole> GroupTenantRoles => Set<GroupTenantRole>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Models.User>()
            .HasIndex(u => new { u.Email, u.IsDeleted })
            .IsUnique();

        var rolesConverter = new ValueConverter<List<string>, string>(
            value => JsonSerializer.Serialize(value, RolesJsonOptions),
            value => string.IsNullOrWhiteSpace(value)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(value, RolesJsonOptions) ?? new List<string>());

        var rolesComparer = new ValueComparer<List<string>>(
            (left, right) => (left ?? new List<string>()).SequenceEqual(right ?? new List<string>()),
            value => (value ?? new List<string>()).Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
            value => (value ?? new List<string>()).ToList());

        var detailsConverter = new ValueConverter<Dictionary<string, object>?, string?>(
            value => value == null ? null : JsonSerializer.Serialize(value, DetailsJsonOptions),
            value => string.IsNullOrWhiteSpace(value)
                ? null
                : JsonSerializer.Deserialize<Dictionary<string, object>>(value, DetailsJsonOptions));

        var detailsComparer = new ValueComparer<Dictionary<string, object>?>(
            (left, right) => JsonSerializer.Serialize(left, DetailsJsonOptions) ==
                             JsonSerializer.Serialize(right, DetailsJsonOptions),
            value => (value == null ? 0 : JsonSerializer.Serialize(value, DetailsJsonOptions).GetHashCode()),
            value => value == null
                ? null
                : JsonSerializer.Deserialize<Dictionary<string, object>>(
                    JsonSerializer.Serialize(value, DetailsJsonOptions),
                    DetailsJsonOptions));

        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<Models.User>()
                .Property(u => u.Roles)
                .HasColumnType("text[]");

            modelBuilder.Entity<AuthProfile>()
                .Property(ap => ap.Domains)
                .HasColumnType("text[]");
        }
        else
        {
            modelBuilder.Entity<Models.User>()
                .Property(u => u.Roles)
                .HasConversion(rolesConverter)
                .Metadata.SetValueComparer(rolesComparer);

            modelBuilder.Entity<AuthProfile>()
                .Property(ap => ap.Domains)
                .HasConversion(rolesConverter)
                .Metadata.SetValueComparer(rolesComparer);
        }

        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<AuditLog>()
                .Property(a => a.Details)
                .HasColumnType("jsonb");
        }
        else
        {
            modelBuilder.Entity<AuditLog>()
                .Property(a => a.Details)
                .HasConversion(detailsConverter)
                .Metadata.SetValueComparer(detailsComparer);
        }

        modelBuilder.Entity<Models.User>()
            .HasMany(u => u.RefreshTokens)
            .WithOne(r => r.User!)
            .HasForeignKey(r => r.UserId);

        modelBuilder.Entity<Models.User>()
            .HasMany(u => u.AuditLogs)
            .WithOne(a => a.User!)
            .HasForeignKey(a => a.UserId);

        modelBuilder.Entity<Models.User>()
            .HasOne(u => u.Client)
            .WithMany(c => c.Users)
            .HasForeignKey(u => u.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        // UserTenantRole configuration
        modelBuilder.Entity<UserTenantRole>()
            .HasOne(utr => utr.User)
            .WithMany(u => u.UserTenantRoles)
            .HasForeignKey(utr => utr.UserId);

        modelBuilder.Entity<UserTenantRole>()
            .HasOne(utr => utr.Client)
            .WithMany()
            .HasForeignKey(utr => utr.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserTenantRole>()
            .HasOne(utr => utr.Profile)
            .WithMany(p => p.UserTenantRoles)
            .HasForeignKey(utr => utr.ProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserTenantRole>()
            .HasOne(utr => utr.Role)
            .WithMany()
            .HasForeignKey(utr => utr.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserTenantRole>()
            .HasIndex(utr => new { utr.UserId, utr.ClientId, utr.RoleId });

        modelBuilder.Entity<UserTenantRole>()
            .HasIndex(utr => new { utr.UserId, utr.ProfileId, utr.RoleId });

        // Define converters for long lists (used by CompanyIds lists)
        var longListConverter = new ValueConverter<List<long>, string>(
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null),
            value => string.IsNullOrWhiteSpace(value)
                ? new List<long>()
                : JsonSerializer.Deserialize<List<long>>(value, (JsonSerializerOptions?)null) ?? new List<long>());

        var longListComparer = new ValueComparer<List<long>>(
            (left, right) => (left ?? new List<long>()).SequenceEqual(right ?? new List<long>()),
            value => (value ?? new List<long>()).Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
            value => (value ?? new List<long>()).ToList());

        // Configure CompanyIds for UserTenantRole
        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<UserTenantRole>()
                .Property(utr => utr.CompanyIds)
                .HasColumnType("bigint[]");
        }
        else
        {
            modelBuilder.Entity<UserTenantRole>()
                .Property(utr => utr.CompanyIds)
                .HasConversion(longListConverter)
                .Metadata.SetValueComparer(longListComparer);
        }

        // ClientUserCompanyAvailability configuration
        modelBuilder.Entity<ClientUserCompanyAvailability>()
            .HasKey(cuca => new { cuca.UserId, cuca.ClientId, cuca.CompanyId });

        modelBuilder.Entity<ClientUserCompanyAvailability>()
            .HasOne(cuca => cuca.User)
            .WithMany()
            .HasForeignKey(cuca => cuca.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ClientUserCompanyAvailability>()
            .HasOne(cuca => cuca.Client)
            .WithMany()
            .HasForeignKey(cuca => cuca.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ClientUserCompanyAvailability>()
            .HasOne(cuca => cuca.Company)
            .WithMany()
            .HasForeignKey(cuca => cuca.CompanyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SetupState>()
            .HasIndex(state => new { state.Key, state.IsDeleted })
            .IsUnique();

        modelBuilder.Entity<SetupStepState>()
            .HasIndex(step => new { step.StepId, step.IsDeleted })
            .IsUnique();

        var tierConverter = new ValueConverter<SubscriptionTier, string>(
            value => value.ToString().ToLowerInvariant(),
            value => (SubscriptionTier)Enum.Parse(typeof(SubscriptionTier), value, true));

        modelBuilder.Entity<Profile>()
            .Property(p => p.Tier)
            .HasConversion(tierConverter)
            .HasColumnType("varchar(50)");

        modelBuilder.Entity<Profile>()
            .HasIndex(p => new { p.Slug, p.IsDeleted })
            .IsUnique();

        // Client configuration
        modelBuilder.Entity<Client>()
            .Property(c => c.Tier)
            .HasConversion(tierConverter)
            .HasColumnType("varchar(50)");

        modelBuilder.Entity<Client>()
            .HasIndex(c => new { c.Slug, c.IsDeleted })
            .IsUnique();

        modelBuilder.Entity<Client>()
            .HasIndex(c => new { c.Name, c.IsDeleted });

        // Profile-Client relationship
        modelBuilder.Entity<Profile>()
            .HasOne(p => p.Client)
            .WithMany(c => c.Companies)
            .HasForeignKey(p => p.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Role>()
            .HasIndex(r => new { r.ClientId, r.ProfileId, r.Name, r.IsDeleted })
            .IsUnique();

        modelBuilder.Entity<Role>()
            .HasOne(r => r.Client)
            .WithMany()
            .HasForeignKey(r => r.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Role>()
            .HasOne(r => r.Profile)
            .WithMany()
            .HasForeignKey(r => r.ProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RolePermission>()
            .HasKey(rp => new { rp.RoleId, rp.PermissionId });

        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Role)
            .WithMany()
            .HasForeignKey(rp => rp.RoleId);

        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Permission)
            .WithMany()
            .HasForeignKey(rp => rp.PermissionId);

        modelBuilder.Entity<RolePermission>()
            .HasQueryFilter(rp => rp.Role == null || !rp.Role.IsDeleted);

        var integrationTypeConverter = new ValueConverter<IntegrationType, string>(
            value => value.ToString().ToLowerInvariant(),
            value => (IntegrationType)Enum.Parse(typeof(IntegrationType), value, true));

        var integrationStatusConverter = new ValueConverter<IntegrationStatus, string>(
            value => value.ToString().ToLowerInvariant(),
            value => (IntegrationStatus)Enum.Parse(typeof(IntegrationStatus), value, true));

        modelBuilder.Entity<IntegrationConnection>()
            .Property(i => i.Type)
            .HasConversion(integrationTypeConverter)
            .HasColumnType("varchar(50)");

        modelBuilder.Entity<IntegrationConnection>()
            .Property(i => i.Status)
            .HasConversion(integrationStatusConverter)
            .HasColumnType("varchar(20)");

        modelBuilder.Entity<IntegrationConnection>()
            .HasIndex(i => new { i.ProfileId, i.Name, i.IsDeleted })
            .IsUnique();

        // OwnerType enum converter
        var ownerTypeConverter = new ValueConverter<OwnerType, string>(
            value => value.ToString().ToLowerInvariant(),
            value => (OwnerType)Enum.Parse(typeof(OwnerType), value, true));

        // IntegrationConnection configuration
        modelBuilder.Entity<IntegrationConnection>()
            .Property(ic => ic.OwnerType)
            .HasConversion(ownerTypeConverter)
            .HasColumnType("varchar(20)");

        // Configure CompanyIds for IntegrationConnection
        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<IntegrationConnection>()
                .Property(ic => ic.CompanyIds)
                .HasColumnType("bigint[]");
        }
        else
        {
            modelBuilder.Entity<IntegrationConnection>()
                .Property(ic => ic.CompanyIds)
                .HasConversion(longListConverter)
                .Metadata.SetValueComparer(longListComparer);
        }

        // AuthProfile configuration
        var authProviderTypeConverter = new ValueConverter<AuthProviderType, string>(
            value => value.ToString().ToLowerInvariant(),
            value => (AuthProviderType)Enum.Parse(typeof(AuthProviderType), value, true));

        modelBuilder.Entity<AuthProfile>()
            .Property(ap => ap.ProviderType)
            .HasConversion(authProviderTypeConverter)
            .HasColumnType("varchar(50)");

        modelBuilder.Entity<AuthProfile>()
            .Property(ap => ap.OwnerType)
            .HasConversion(ownerTypeConverter)
            .HasColumnType("varchar(20)");

        // Configure CompanyIds for AuthProfile
        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<AuthProfile>()
                .Property(ap => ap.CompanyIds)
                .HasColumnType("bigint[]");
        }
        else
        {
            modelBuilder.Entity<AuthProfile>()
                .Property(ap => ap.CompanyIds)
                .HasConversion(longListConverter)
                .Metadata.SetValueComparer(longListComparer);
        }

        // Group configuration
        var groupTypeConverter = new ValueConverter<GroupType, int>(
            value => (int)value,
            value => (GroupType)value);

        modelBuilder.Entity<Group>()
            .Property(g => g.Type)
            .HasConversion(groupTypeConverter);

        modelBuilder.Entity<Group>()
            .HasIndex(g => new { g.ProfileId, g.Name, g.IsDeleted })
            .IsUnique();

        modelBuilder.Entity<Group>()
            .HasOne(g => g.Profile)
            .WithMany()
            .HasForeignKey(g => g.ProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        // UserGroup configuration
        modelBuilder.Entity<UserGroup>()
            .HasKey(ug => new { ug.UserId, ug.GroupId });

        modelBuilder.Entity<UserGroup>()
            .HasOne(ug => ug.User)
            .WithMany()
            .HasForeignKey(ug => ug.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserGroup>()
            .HasOne(ug => ug.Group)
            .WithMany(g => g.UserGroups)
            .HasForeignKey(ug => ug.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserGroup>()
            .HasIndex(ug => ug.GroupId);

        // GroupTenantRole configuration
        modelBuilder.Entity<GroupTenantRole>()
            .HasOne(gtr => gtr.Group)
            .WithMany(g => g.GroupTenantRoles)
            .HasForeignKey(gtr => gtr.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<GroupTenantRole>()
            .HasOne(gtr => gtr.Client)
            .WithMany()
            .HasForeignKey(gtr => gtr.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupTenantRole>()
            .HasOne(gtr => gtr.Profile)
            .WithMany()
            .HasForeignKey(gtr => gtr.ProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupTenantRole>()
            .HasOne(gtr => gtr.Role)
            .WithMany()
            .HasForeignKey(gtr => gtr.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<GroupTenantRole>()
            .HasIndex(gtr => new { gtr.GroupId, gtr.ClientId, gtr.RoleId });

        modelBuilder.Entity<GroupTenantRole>()
            .HasIndex(gtr => new { gtr.GroupId, gtr.ProfileId, gtr.RoleId });

        modelBuilder.Entity<GroupTenantRole>()
            .HasIndex(gtr => gtr.RoleId);

        // Configure CompanyIds for GroupTenantRole
        if (Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            modelBuilder.Entity<GroupTenantRole>()
                .Property(gtr => gtr.CompanyIds)
                .HasColumnType("bigint[]");
        }
        else
        {
            modelBuilder.Entity<GroupTenantRole>()
                .Property(gtr => gtr.CompanyIds)
                .HasConversion(longListConverter)
                .Metadata.SetValueComparer(longListComparer);
        }

        ApplySoftDeleteFilters(modelBuilder);
    }

    public override int SaveChanges()
    {
        ApplyAuditInfo();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditInfo();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyAuditInfo()
    {
        var now = DateTime.UtcNow;
        var userId = _currentUserProvider?.UserId;

        foreach (var entry in ChangeTracker.Entries<IAuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAt == default)
                {
                    entry.Entity.CreatedAt = now;
                }
                entry.Entity.UpdatedAt = now;
                if (userId.HasValue)
                {
                    entry.Entity.CreatedBy = userId.Value;
                    entry.Entity.UpdatedBy = userId.Value;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                if (userId.HasValue)
                {
                    entry.Entity.UpdatedBy = userId.Value;
                }
            }
        }

        foreach (var entry in ChangeTracker.Entries<ISoftDelete>())
        {
            if (entry.State == EntityState.Deleted)
            {
                entry.State = EntityState.Modified;
                entry.Entity.IsDeleted = true;
                entry.Entity.DeletedAt = now;
                if (userId.HasValue)
                {
                    entry.Entity.DeletedBy = userId.Value;
                }
            }
        }
    }

    private static void ApplySoftDeleteFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            if (!typeof(ISoftDelete).IsAssignableFrom(clrType))
            {
                continue;
            }

            var parameter = Expression.Parameter(clrType, "e");
            var prop = Expression.Property(parameter, nameof(ISoftDelete.IsDeleted));
            var body = Expression.Equal(prop, Expression.Constant(false));
            var lambda = Expression.Lambda(body, parameter);
            modelBuilder.Entity(clrType).HasQueryFilter(lambda);
        }
    }
}
