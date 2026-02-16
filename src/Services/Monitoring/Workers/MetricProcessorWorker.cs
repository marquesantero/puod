using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Puod.Services.Monitoring.Data;
using Puod.Services.Monitoring.Models;
using Puod.Shared.Contracts.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Puod.Services.Monitoring.Workers;

public class MetricProcessorWorker : BackgroundService
{
    private readonly ILogger<MetricProcessorWorker> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;
    private IConnection? _rabbitConnection;
    private IModel? _channel;

    private const int MaxRetryAttempts = 5;
    private static readonly TimeSpan InitialRetryDelay = TimeSpan.FromSeconds(2);

    public MetricProcessorWorker(
        ILogger<MetricProcessorWorker> logger,
        IServiceProvider serviceProvider,
        IConfiguration configuration)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Metric processor worker starting...");

        await ConnectWithRetryAsync(stoppingToken);

        if (_rabbitConnection == null || !_rabbitConnection.IsOpen)
        {
            _logger.LogCritical("Failed to connect to RabbitMQ after all retry attempts. Worker will not process messages.");
            return;
        }

        try
        {
            _channel = _rabbitConnection.CreateModel();

            _channel.ExchangeDeclare("puod.metrics", ExchangeType.Topic, durable: true);

            var queueName = _channel.QueueDeclare("metrics.processing", durable: true, exclusive: false, autoDelete: false).QueueName;

            _channel.QueueBind(queue: queueName, exchange: "puod.metrics", routingKey: "metrics.*");

            _channel.BasicQos(0, 1, false);

            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.Received += OnMessageReceived;

            _channel.BasicConsume(queue: queueName, autoAck: false, consumer: consumer);

            _logger.LogInformation("Metric processor worker started. Listening for messages on queue '{QueueName}'...", queueName);

            // Keep the worker alive until cancellation is requested
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Metric processor worker is stopping due to cancellation.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting up RabbitMQ channel and consumer.");
        }
    }

    private async Task ConnectWithRetryAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = _configuration["RabbitMQ:Host"] ?? "localhost",
            UserName = _configuration["RabbitMQ:Username"] ?? "guest",
            Password = _configuration["RabbitMQ:Password"] ?? "guest",
            VirtualHost = _configuration["RabbitMQ:VirtualHost"] ?? "/",
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(10),
            RequestedHeartbeat = TimeSpan.FromSeconds(30)
        };

        var portStr = _configuration["RabbitMQ:Port"];
        if (int.TryParse(portStr, out var port))
        {
            factory.Port = port;
        }

        for (int attempt = 1; attempt <= MaxRetryAttempts; attempt++)
        {
            stoppingToken.ThrowIfCancellationRequested();

            try
            {
                _logger.LogInformation(
                    "Attempting to connect to RabbitMQ at {Host}:{Port} (attempt {Attempt}/{Max})...",
                    factory.HostName, factory.Port, attempt, MaxRetryAttempts);

                _rabbitConnection = factory.CreateConnection();

                _rabbitConnection.ConnectionShutdown += (sender, args) =>
                    _logger.LogWarning("RabbitMQ connection shut down. Reason: {Reason}", args.ReplyText);

                _logger.LogInformation("Successfully connected to RabbitMQ.");
                return;
            }
            catch (Exception ex)
            {
                var delay = InitialRetryDelay * Math.Pow(2, attempt - 1); // 2s, 4s, 8s, 16s, 32s
                _logger.LogWarning(ex,
                    "Failed to connect to RabbitMQ (attempt {Attempt}/{Max}). Retrying in {Delay}s...",
                    attempt, MaxRetryAttempts, delay.TotalSeconds);

                if (attempt < MaxRetryAttempts)
                {
                    await Task.Delay(delay, stoppingToken);
                }
            }
        }

        _logger.LogCritical(
            "Could not connect to RabbitMQ after {Max} attempts. Host: {Host}:{Port}",
            MaxRetryAttempts, factory.HostName, factory.Port);
    }

    private async Task OnMessageReceived(object sender, BasicDeliverEventArgs ea)
    {
        var body = ea.Body.ToArray();
        var message = Encoding.UTF8.GetString(body);

        try
        {
            var metricEvent = JsonSerializer.Deserialize<MetricIngestedEvent>(message);
            if (metricEvent == null)
            {
                _logger.LogWarning("Failed to deserialize message: {Message}", message);
                _channel?.BasicAck(ea.DeliveryTag, false);
                return;
            }

            _logger.LogInformation("Processing metric '{MetricName}' from source '{Source}'...", metricEvent.MetricName, metricEvent.Source);

            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

            var entity = new MetricSnapshot
            {
                Timestamp = metricEvent.Timestamp,
                ProfileId = metricEvent.ProfileId,
                Source = metricEvent.Source,
                MetricName = metricEvent.MetricName,
                Value = metricEvent.Value,
                Tags = metricEvent.Tags
            };

            dbContext.Metrics.Add(entity);
            await dbContext.SaveChangesAsync();

            // Placeholder for future alert evaluation logic
            var activeRules = await dbContext.AlertRules.Where(r => r.ProfileId == metricEvent.ProfileId && r.IsActive).ToListAsync();
            _logger.LogDebug("Active alert rules evaluated: {Count}", activeRules.Count);

            _channel?.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message: {Message}", message);
            _channel?.BasicNack(ea.DeliveryTag, false, true); // Requeue the message
            await Task.Delay(5000, CancellationToken.None); // Wait before processing the next message
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Metric processor worker is stopping...");

        _channel?.Close();
        _channel?.Dispose();
        _rabbitConnection?.Close();
        _rabbitConnection?.Dispose();

        _channel = null;
        _rabbitConnection = null;

        await base.StopAsync(cancellationToken);
    }

    public override void Dispose()
    {
        _channel?.Dispose();
        _rabbitConnection?.Dispose();
        base.Dispose();
    }
}
