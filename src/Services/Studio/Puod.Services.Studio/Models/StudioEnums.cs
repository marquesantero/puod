namespace Puod.Services.Studio.Models;

public enum StudioScope
{
    Client = 1,
    Company = 2
}

public enum StudioCardStatus
{
    Draft = 1,
    Published = 2,
    Archived = 3
}

public enum StudioDashboardStatus
{
    Draft = 1,
    Published = 2,
    Archived = 3
}

public enum StudioRefreshMode
{
    Inherit = 1,
    Manual = 2,
    Interval = 3
}

public enum StudioShareTarget
{
    Card = 1,
    Dashboard = 2
}

public enum StudioShareSubject
{
    User = 1,
    Group = 2
}

public enum StudioShareAccess
{
    View = 1,
    Edit = 2
}
