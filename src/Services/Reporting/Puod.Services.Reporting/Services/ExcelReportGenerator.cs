using ClosedXML.Excel;
using Puod.Services.Reporting.Models;

namespace Puod.Services.Reporting.Services;

public class ExcelReportGenerator : IReportGenerator
{
    public async Task<ReportResult> GenerateAsync(ReportRequest request, CancellationToken cancellationToken = default)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Report");

        worksheet.Cell("A1").Value = request.Title;
        worksheet.Cell("A2").Value = $"Generated at {DateTime.UtcNow:u}";

        if (request.Parameters != null && request.Parameters.Count > 0)
        {
            worksheet.Cell("A4").Value = "Parameters";
            var row = 5;
            foreach (var param in request.Parameters)
            {
                worksheet.Cell(row, 1).Value = param.Key;
                worksheet.Cell(row, 2).Value = param.Value?.ToString() ?? string.Empty;
                row++;
            }
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var fileName = $"report_{Guid.NewGuid():N}.xlsx";
        return await Task.FromResult(new ReportResult(fileName, stream.ToArray()));
    }

    public async Task GenerateReportAsync(ReportRequest request, CancellationToken cancellationToken = default)
    {
        _ = await GenerateAsync(request, cancellationToken);
    }
}
