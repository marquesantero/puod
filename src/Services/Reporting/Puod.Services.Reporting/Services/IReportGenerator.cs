using Puod.Services.Reporting.Models;

namespace Puod.Services.Reporting.Services;

public interface IReportGenerator
{
    Task<ReportResult> GenerateAsync(ReportRequest request, CancellationToken cancellationToken = default);
    Task GenerateReportAsync(ReportRequest request, CancellationToken cancellationToken = default);
}
