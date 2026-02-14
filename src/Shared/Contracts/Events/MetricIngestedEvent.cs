namespace Puod.Shared.Contracts.Events;

/// <summary>
/// Evento publicado quando uma nova métrica é ingerida
/// </summary>
public record MetricIngestedEvent(
    DateTime Timestamp,
    Guid ProfileId,
    string Source,
    string MetricName,
    double Value,
    Dictionary<string, string>? Tags
);
