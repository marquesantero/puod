namespace Puod.Services.Reporting.Models;

public record ReportRequest(string Title, Dictionary<string, object>? Parameters);

public record ReportResult(string FileName, byte[] Content, string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
