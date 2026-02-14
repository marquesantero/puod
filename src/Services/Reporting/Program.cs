using Hangfire;
using Hangfire.PostgreSql;
using Puod.Services.Reporting.Models;
using Puod.Services.Reporting.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Add services to the container.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddHangfire(config =>
    config.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
          .UseSimpleAssemblyNameTypeSerializer()
          .UseRecommendedSerializerSettings()
          .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = 2;
    options.Queues = new[] { "reports", "default" };
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PUOD Reporting Service", Version = "v1" });
});

builder.Services.AddScoped<IReportGenerator, ExcelReportGenerator>();
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});


// 2. Build the application.
var app = builder.Build();


// 3. Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    // In a real-world scenario, this dashboard should be secured.
    Authorization = new[] { new AllowAllDashboardAuthorizationFilter() }
});

app.MapControllers();
app.MapGet("/health", () => new
{
    status = "healthy",
    service = "reporting",
    timestamp = DateTime.UtcNow
});

app.MapPost("/reports/generate", (ReportRequest request, IBackgroundJobClient jobClient, IReportGenerator generator) =>
{
    // For MVP we generate synchronously and also enqueue an async job as an example.
    var jobId = jobClient.Enqueue<IReportGenerator>(g => g.GenerateAsync(request, CancellationToken.None));
    return Results.Ok(new { JobId = jobId });
});

app.MapPost("/reports/generate-now", async (ReportRequest request, IReportGenerator generator) =>
{
    var result = await generator.GenerateAsync(request);
    return Results.File(result.Content, result.ContentType, result.FileName);
});


// 4. Run the application.
app.Run();

internal sealed class AllowAllDashboardAuthorizationFilter : Hangfire.Dashboard.IDashboardAuthorizationFilter
{
    public bool Authorize(Hangfire.Dashboard.DashboardContext context)
    {
        return true;
    }
}
