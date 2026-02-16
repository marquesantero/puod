using Microsoft.EntityFrameworkCore;
using Puod.Services.Monitoring.Data;
using Puod.Services.Monitoring.Services;
using Puod.Services.Monitoring.Workers;

var builder = WebApplication.CreateBuilder(args);

// 1. Add services to the container.
builder.Services.AddDbContext<MonitoringDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptionsAction: sqlOptions =>
        {
            // As per TimescaleDB documentation, this is recommended for optimal performance.
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(30),
                errorCodesToAdd: null);
        }));

builder.Services.AddHostedService<MetricProcessorWorker>();

// Register metrics services
builder.Services.AddScoped<IAirflowMetricsService, AirflowMetricsService>();
builder.Services.AddScoped<IAdfMetricsService, AdfMetricsService>();

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new Asp.Versioning.UrlSegmentApiVersionReader();
})
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PUOD Monitoring Service", Version = "v1" });
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

app.MapControllers();

app.MapGet("/health", () => new
{
    status = "healthy",
    service = "monitoring",
    timestamp = DateTime.UtcNow
});

// 4. Run the application.
app.Run();
