namespace Puod.Services.User.Configuration;

public static class SystemPermissions
{
    public const string CardsView = "Cards.View";
    public const string CardsCreate = "Cards.Create";
    public const string CardsEdit = "Cards.Edit";
    public const string CardsDelete = "Cards.Delete";
    public const string CardsExport = "Cards.Export";

    public const string IntegrationsView = "Integrations.View";
    public const string IntegrationsCreate = "Integrations.Create";
    public const string IntegrationsEdit = "Integrations.Edit";
    public const string IntegrationsDelete = "Integrations.Delete";
    public const string IntegrationsExecute = "Integrations.Execute";

    public const string SecurityUsersView = "Security.Users.View";
    public const string SecurityUsersManage = "Security.Users.Manage";
    public const string SecurityGroupsManage = "Security.Groups.Manage";
    public const string SecurityRolesManage = "Security.Roles.Manage";

    public const string CompanyView = "Company.View";
    public const string CompanySettingsEdit = "Company.Settings.Edit";
    public const string CompanyCreate = "Company.Create";
    public const string CompanyAuditView = "Company.Audit.View";

    public const string MonitoringView = "Monitoring.View";
    public const string MonitoringAlertsManage = "Monitoring.Alerts.Manage";

    public static readonly List<(string Id, string Category, string Description)> All = new()
    {
        // --- Card Studio ---
        (CardsView, "Card Studio", "View dashboards and cards"),
        (CardsCreate, "Card Studio", "Create new cards"),
        (CardsEdit, "Card Studio", "Edit configuration of existing cards"),
        (CardsDelete, "Card Studio", "Delete cards"),
        (CardsExport, "Card Studio", "Export card data or layout"),

        // --- Integrations ---
        (IntegrationsView, "Integrations", "View configured integrations list"),
        (IntegrationsCreate, "Integrations", "Add new integrations (ADF, Airflow, API)"),
        (IntegrationsEdit, "Integrations", "Edit integration settings and credentials"),
        (IntegrationsDelete, "Integrations", "Remove integrations"),
        (IntegrationsExecute, "Integrations", "Manually trigger integration sync"),

        // --- Security (IAM) ---
        (SecurityUsersView, "Security", "View users list"),
        (SecurityUsersManage, "Security", "Import, create, edit, and deactivate users"),
        (SecurityGroupsManage, "Security", "Manage user groups"),
        (SecurityRolesManage, "Security", "Manage roles and permission assignments"),

        // --- Company (Tenant) ---
        (CompanyView, "Company", "View company details"),
        (CompanySettingsEdit, "Company", "Edit company settings and auth profiles"),
        (CompanyCreate, "Company", "Create new companies"),
        (CompanyAuditView, "Company", "Access audit logs"),

        // --- Monitoring ---
        (MonitoringView, "Monitoring", "Access real-time monitoring data"),
        (MonitoringAlertsManage, "Monitoring", "Configure alert rules")
    };
}
