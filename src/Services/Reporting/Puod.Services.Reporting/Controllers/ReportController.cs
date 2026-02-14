using Hangfire;
using Microsoft.AspNetCore.Mvc;
using Puod.Services.Reporting.Models;
using Puod.Services.Reporting.Services;

namespace Puod.Services.Reporting.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportController : ControllerBase
{
    private readonly IReportGenerator _reportGenerator;
    private readonly IBackgroundJobClient _backgroundJobClient;

    public ReportController(
        IReportGenerator reportGenerator,
        IBackgroundJobClient backgroundJobClient)
    {
        _reportGenerator = reportGenerator;
        _backgroundJobClient = backgroundJobClient;
    }

    /// <summary>
    /// Gera relatório de forma síncrona
    /// </summary>
    [HttpPost("generate")]
    public async Task<ActionResult<ReportResult>> GenerateReport([FromBody] ReportRequest request)
    {
        try
        {
            var result = await _reportGenerator.GenerateAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Enfileira geração de relatório assíncrona via Hangfire
    /// </summary>
    [HttpPost("generate-async")]
    public IActionResult GenerateReportAsync([FromBody] ReportRequest request)
    {
        var jobId = _backgroundJobClient.Enqueue<IReportGenerator>(
            x => x.GenerateReportAsync(request, CancellationToken.None));

        return Accepted(new
        {
            jobId,
            message = "Report generation queued",
            statusUrl = $"/api/report/status/{jobId}"
        });
    }

    /// <summary>
    /// Consulta status de um job Hangfire
    /// </summary>
    [HttpGet("status/{jobId}")]
    public IActionResult GetJobStatus(string jobId)
    {
        var monitoringApi = JobStorage.Current.GetMonitoringApi();
        var jobDetails = monitoringApi.JobDetails(jobId);

        if (jobDetails == null)
            return NotFound(new { message = "Job not found" });

        return Ok(new
        {
            jobId,
            state = jobDetails.History[0].StateName,
            createdAt = jobDetails.CreatedAt,
            history = jobDetails.History.Select(h => new
            {
                state = h.StateName,
                createdAt = h.CreatedAt
            })
        });
    }

    /// <summary>
    /// Agenda geração recorrente de relatório
    /// </summary>
    [HttpPost("schedule")]
    public IActionResult ScheduleReport(
        [FromBody] ReportRequest request,
        [FromQuery] string cronExpression)
    {
        var recurringId = $"report-{Guid.NewGuid()}";
        RecurringJob.AddOrUpdate<IReportGenerator>(
            recurringId,
            x => x.GenerateReportAsync(request, CancellationToken.None),
            cronExpression);

        return Ok(new
        {
            message = "Report scheduled successfully",
            cronExpression,
            recurringId
        });
    }
}
