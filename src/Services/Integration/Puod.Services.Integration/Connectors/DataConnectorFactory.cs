namespace Puod.Services.Integration.Connectors;

public class DataConnectorFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly Dictionary<string, Func<IServiceProvider, IDataConnector>> _registry;

    public DataConnectorFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        // DatabricksConnector agora implementa IConnector, não IDataConnector
        // Use ConnectorFactory para Databricks, Synapse, Airflow e ADF
        _registry = new(StringComparer.OrdinalIgnoreCase)
        {
            // Registro vazio - conectores migrados para IConnector/ConnectorFactory
        };
    }

    public IDataConnector Create(string type)
    {
        if (_registry.TryGetValue(type, out var resolver))
        {
            return resolver(_serviceProvider);
        }

        throw new NotSupportedException($"Connector '{type}' not supported");
    }

    public IEnumerable<string> SupportedTypes => _registry.Keys;
}
