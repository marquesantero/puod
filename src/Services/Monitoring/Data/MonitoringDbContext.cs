using Microsoft.EntityFrameworkCore;
using Puod.Services.Monitoring.Models;

namespace Puod.Services.Monitoring.Data;

public class MonitoringDbContext : DbContext
{
    public MonitoringDbContext(DbContextOptions<MonitoringDbContext> options)
        : base(options)
    {
    }

    public DbSet<MetricSnapshot> Metrics { get; set; }
    public DbSet<Alert> Alerts { get; set; }
    public DbSet<AlertRule> AlertRules { get; set; }
    public DbSet<AirflowDagRun> AirflowDagRuns { get; set; }
    public DbSet<AirflowTaskInstance> AirflowTaskInstances { get; set; }
    public DbSet<AdfPipelineRun> AdfPipelineRuns { get; set; }
    public DbSet<AdfActivityRun> AdfActivityRuns { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure the composite primary key for MetricSnapshot
        modelBuilder.Entity<MetricSnapshot>()
            .HasKey(m => new { m.Timestamp, m.ProfileId, m.Source, m.MetricName });

        // Configure the jsonb columns
        modelBuilder.Entity<AlertRule>()
            .Property(e => e.Channels)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Alert>()
            .Property(e => e.Metadata)
            .HasColumnType("jsonb");
            
        modelBuilder.Entity<MetricSnapshot>()
            .Property(e => e.Tags)
            .HasColumnType("jsonb");

        // Configure Airflow models
        modelBuilder.Entity<AirflowDagRun>(entity =>
        {
            entity.ToTable("airflow_dag_runs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Configuration).HasColumnType("jsonb");
            entity.HasIndex(e => e.IntegrationId);
            entity.HasIndex(e => new { e.DagId, e.ExecutionDate });
            entity.HasIndex(e => e.State);
            entity.HasIndex(e => e.UpdatedAt);
            entity.HasMany(e => e.TaskInstances)
                .WithOne(t => t.DagRun)
                .HasForeignKey(t => t.DagRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AirflowTaskInstance>(entity =>
        {
            entity.ToTable("airflow_task_instances");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ExecutorConfig).HasColumnType("jsonb");
            entity.HasIndex(e => e.DagRunId);
            entity.HasIndex(e => new { e.DagId, e.TaskId, e.ExecutionDate });
            entity.HasIndex(e => e.State);
        });

        // Configure ADF models
        modelBuilder.Entity<AdfPipelineRun>(entity =>
        {
            entity.ToTable("adf_pipeline_runs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Parameters).HasColumnType("jsonb");
            entity.Property(e => e.Annotations).HasColumnType("jsonb");
            entity.HasIndex(e => e.IntegrationId);
            entity.HasIndex(e => new { e.PipelineName, e.RunStart });
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.UpdatedAt);
            entity.HasMany(e => e.ActivityRuns)
                .WithOne(a => a.PipelineRun)
                .HasForeignKey(a => a.PipelineRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AdfActivityRun>(entity =>
        {
            entity.ToTable("adf_activity_runs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Error).HasColumnType("jsonb");
            entity.Property(e => e.Input).HasColumnType("jsonb");
            entity.Property(e => e.Output).HasColumnType("jsonb");
            entity.HasIndex(e => e.PipelineRunId);
            entity.HasIndex(e => new { e.PipelineName, e.ActivityName });
            entity.HasIndex(e => e.Status);
        });
    }
}
