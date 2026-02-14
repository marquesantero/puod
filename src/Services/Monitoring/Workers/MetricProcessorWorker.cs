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
    private readonly IConnection _rabbitConnection;
    private IModel? _channel;

    public MetricProcessorWorker(ILogger<MetricProcessorWorker> logger, IServiceProvider serviceProvider, IConfiguration configuration)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;

        var factory = new ConnectionFactory
        {
            HostName = configuration["RabbitMQ:HostName"],
            UserName = configuration["RabbitMQ:UserName"],
            Password = configuration["RabbitMQ:Password"],
            VirtualHost = configuration["RabbitMQ:VirtualHost"] ?? "/",
            DispatchConsumersAsync = true
        };
        _rabbitConnection = factory.CreateConnection();
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        stoppingToken.ThrowIfCancellationRequested();

        _channel = _rabbitConnection.CreateModel();

        _channel.ExchangeDeclare("puod.metrics", ExchangeType.Topic, durable: true);
        
        var queueName = _channel.QueueDeclare("metrics.processing", durable: true, exclusive: false, autoDelete: false).QueueName;
        
        _channel.QueueBind(queue: queueName, exchange: "puod.metrics", routingKey: "metrics.*");

        _channel.BasicQos(0, 1, false);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.Received += OnMessageReceived;

        _channel.BasicConsume(queue: queueName, autoAck: false, consumer: consumer);

        _logger.LogInformation("Metric processor worker started. Listening for messages on queue '{QueueName}'...", queueName);

        return Task.CompletedTask;
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

    public override void Dispose()
    {
        _channel?.Close();
        _rabbitConnection?.Close();
        base.Dispose();
    }
}
