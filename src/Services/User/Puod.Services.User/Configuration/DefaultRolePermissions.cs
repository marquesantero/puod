using Puod.Services.User.Models;

namespace Puod.Services.User.Configuration;

/// <summary>
/// Default permission mappings for predefined roles
/// </summary>
public static class DefaultRolePermissions
{
    /// <summary>
    /// Get default permissions for a role name
    /// </summary>
    public static List<string> GetDefaultPermissions(string roleName)
    {
        return roleName switch
        {
            // Client-Level Roles
            ClientRoles.ClientAdmin => ClientAdminPermissions,
            ClientRoles.ClientManager => ClientManagerPermissions,
            ClientRoles.ClientAnalyst => ClientAnalystPermissions,
            ClientRoles.ClientCardDesigner => ClientCardDesignerPermissions,
            "Client Security Admin" => ClientSecurityAdminPermissions,
            "Client Contributor" => ClientContributorPermissions,
            "Client Viewer" => ClientViewerPermissions,

            // Company-Level Roles
            CompanyRoles.CompanyAdmin => CompanyAdminPermissions,
            CompanyRoles.CompanyManager => CompanyManagerPermissions,
            CompanyRoles.CardStudioAdmin => CompanyCardStudioAdminPermissions,
            CompanyRoles.CardEditor => CompanyCardEditorPermissions,
            CompanyRoles.CardViewer => CompanyCardViewerPermissions,
            CompanyRoles.IntegrationManager => CompanyIntegrationManagerPermissions,
            CompanyRoles.Analyst => CompanyAnalystPermissions,
            CompanyRoles.Viewer => CompanyViewerPermissions,
            "Company Owner" => CompanyOwnerPermissions,
            "Company Contributor" => CompanyContributorPermissions,
            "Company Viewer" => CompanyViewerPermissions,

            _ => new List<string>()
        };
    }

    // Client-Level Role Permissions
    private static List<string> ClientAdminPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CompanySettingsEdit,

        SystemPermissions.SecurityUsersView,
        SystemPermissions.SecurityUsersManage,
        SystemPermissions.SecurityRolesManage,
        SystemPermissions.SecurityGroupsManage,

        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport,

        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute,

        SystemPermissions.MonitoringView,
        SystemPermissions.MonitoringAlertsManage,

        SystemPermissions.CompanyAuditView
    };

    private static List<string> ClientManagerPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CompanySettingsEdit,

        SystemPermissions.SecurityUsersView,
        SystemPermissions.SecurityUsersManage,

        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport,

        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute,

        SystemPermissions.MonitoringView
    };

    private static List<string> ClientAnalystPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CardsView,
        SystemPermissions.MonitoringView
    };

    private static List<string> ClientCardDesignerPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport
    };

    private static List<string> ClientSecurityAdminPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.SecurityUsersView,
        SystemPermissions.SecurityUsersManage,
        SystemPermissions.SecurityRolesManage,
        SystemPermissions.SecurityGroupsManage
    };

    private static List<string> ClientContributorPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsExport
    };

    private static List<string> ClientViewerPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CardsView
    };

    // Company-Level Role Permissions
    private static List<string> CompanyOwnerPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CompanySettingsEdit,
        SystemPermissions.CompanyCreate,

        SystemPermissions.SecurityUsersView,
        SystemPermissions.SecurityUsersManage,
        SystemPermissions.SecurityRolesManage,

        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport,

        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute,

        SystemPermissions.MonitoringView,
        SystemPermissions.MonitoringAlertsManage,

        SystemPermissions.CompanyAuditView
    };

    private static List<string> CompanyAdminPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CompanySettingsEdit,
        SystemPermissions.CompanyCreate,

        SystemPermissions.SecurityUsersView,
        SystemPermissions.SecurityUsersManage,
        SystemPermissions.SecurityRolesManage,

        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport,

        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute,

        SystemPermissions.MonitoringView,
        SystemPermissions.MonitoringAlertsManage,

        SystemPermissions.CompanyAuditView
    };

    private static List<string> CompanyManagerPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CompanySettingsEdit,

        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute
    };

    private static List<string> CompanyCardStudioAdminPermissions => new()
    {
        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsDelete,
        SystemPermissions.CardsExport
    };

    private static List<string> CompanyCardEditorPermissions => new()
    {
        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsExport
    };

    private static List<string> CompanyCardViewerPermissions => new()
    {
        SystemPermissions.CardsView
    };

    private static List<string> CompanyIntegrationManagerPermissions => new()
    {
        SystemPermissions.IntegrationsView,
        SystemPermissions.IntegrationsCreate,
        SystemPermissions.IntegrationsEdit,
        SystemPermissions.IntegrationsDelete,
        SystemPermissions.IntegrationsExecute
    };

    private static List<string> CompanyAnalystPermissions => new()
    {
        SystemPermissions.CompanyView,
        SystemPermissions.CardsView,
        SystemPermissions.MonitoringView
    };

    private static List<string> CompanyContributorPermissions => new()
    {
        SystemPermissions.CardsView,
        SystemPermissions.CardsCreate,
        SystemPermissions.CardsEdit,
        SystemPermissions.CardsExport
    };

    private static List<string> CompanyViewerPermissions => new()
    {
        SystemPermissions.CardsView
    };
}
