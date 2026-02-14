namespace Puod.Services.User.Models;

/// <summary>
/// Platform-level system roles that apply globally across all clients and companies
/// These roles are stored in User.Roles array
/// </summary>
public static class SystemRoles
{
    /// <summary>
    /// Platform administrator with full access to everything
    /// Can manage all clients, companies, and system settings
    /// </summary>
    public const string PlatformAdmin = "Platform Admin";

    /// <summary>
    /// Platform support role for technical support operations
    /// Can view all data but has limited modification permissions
    /// </summary>
    public const string PlatformSupport = "Platform Support";

    /// <summary>
    /// Regular user (default role)
    /// </summary>
    public const string User = "user";

    /// <summary>
    /// All built-in platform roles
    /// </summary>
    public static readonly string[] BuiltInRoles = new[]
    {
        PlatformAdmin,
        PlatformSupport,
        User
    };

    /// <summary>
    /// Check if a role is a built-in platform role
    /// </summary>
    public static bool IsBuiltIn(string role) => BuiltInRoles.Contains(role);

    /// <summary>
    /// Check if a role is a platform admin role
    /// </summary>
    public static bool IsPlatformAdmin(string role) => role == PlatformAdmin;
}

/// <summary>
/// Client-level roles - apply to all companies within a client
/// These roles are stored in UserTenantRole table with ClientId set
/// </summary>
public static class ClientRoles
{
    /// <summary>
    /// Client administrator with full access to client and all companies
    /// Can manage users, roles, companies, and all resources
    /// </summary>
    public const string ClientAdmin = "Client Admin";

    /// <summary>
    /// Client manager with elevated permissions
    /// Can manage users and most resources but limited security permissions
    /// </summary>
    public const string ClientManager = "Client Manager";

    /// <summary>
    /// Client analyst - read-only access to company data and monitoring
    /// Can view companies, cards, and monitoring dashboards
    /// </summary>
    public const string ClientAnalyst = "Client Analyst";

    /// <summary>
    /// Client card designer - specialized role for card creation and editing
    /// Can create, edit, delete, and export cards across all companies
    /// </summary>
    public const string ClientCardDesigner = "Client Card Designer";

    /// <summary>
    /// All built-in client roles
    /// </summary>
    public static readonly string[] BuiltInRoles = new[]
    {
        ClientAdmin,
        ClientManager,
        ClientAnalyst,
        ClientCardDesigner
    };

    /// <summary>
    /// Roles that have admin-level permissions at client level
    /// </summary>
    public static readonly string[] AdminRoles = new[]
    {
        ClientAdmin
    };

    /// <summary>
    /// Check if a role is a built-in client role
    /// </summary>
    public static bool IsBuiltIn(string role) => BuiltInRoles.Contains(role);

    /// <summary>
    /// Check if a role has admin permissions at client level
    /// </summary>
    public static bool IsAdminRole(string role) => AdminRoles.Contains(role);
}

/// <summary>
/// Company-level roles - apply to specific companies
/// These roles are stored in UserTenantRole table with ProfileId set
/// </summary>
public static class CompanyRoles
{
    /// <summary>
    /// Company administrator with full access to the company
    /// Can manage users, roles, and all company resources
    /// </summary>
    public const string CompanyAdmin = "Company Admin";

    /// <summary>
    /// Company manager with elevated permissions
    /// Can manage integrations and company settings
    /// </summary>
    public const string CompanyManager = "Company Manager";

    /// <summary>
    /// Card Studio administrator - full access to card management
    /// Can create, edit, delete, and export cards
    /// </summary>
    public const string CardStudioAdmin = "Card Studio Admin";

    /// <summary>
    /// Card editor - can create and edit cards
    /// Cannot delete cards
    /// </summary>
    public const string CardEditor = "Card Editor";

    /// <summary>
    /// Card viewer - read-only access to cards
    /// Can only view cards
    /// </summary>
    public const string CardViewer = "Card Viewer";

    /// <summary>
    /// Integration manager - manages integrations
    /// Can create, edit, delete, and execute integrations
    /// </summary>
    public const string IntegrationManager = "Integration Manager";

    /// <summary>
    /// Analyst - read-only access to company data and monitoring
    /// Can view company info, cards, and monitoring
    /// </summary>
    public const string Analyst = "Analyst";

    /// <summary>
    /// Viewer - minimal read-only access
    /// Can view company info, cards, and monitoring
    /// </summary>
    public const string Viewer = "Viewer";

    /// <summary>
    /// All built-in company roles
    /// </summary>
    public static readonly string[] BuiltInRoles = new[]
    {
        CompanyAdmin,
        CompanyManager,
        CardStudioAdmin,
        CardEditor,
        CardViewer,
        IntegrationManager,
        Analyst,
        Viewer
    };

    /// <summary>
    /// Roles that have admin-level permissions at company level
    /// </summary>
    public static readonly string[] AdminRoles = new[]
    {
        CompanyAdmin
    };

    /// <summary>
    /// Check if a role is a built-in company role
    /// </summary>
    public static bool IsBuiltIn(string role) => BuiltInRoles.Contains(role);

    /// <summary>
    /// Check if a role has admin permissions at company level
    /// </summary>
    public static bool IsAdminRole(string role) => AdminRoles.Contains(role);
}
