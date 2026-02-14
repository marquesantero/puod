using Puod.Services.Integration.Models;

namespace Puod.Services.Integration.Connectors;

public interface IConnectorFactory
{
    IConnector CreateConnector(ConnectorType type);
}

/// <summary>
/// Factory para criar instâncias de conectores baseado no tipo
/// </summary>
public class ConnectorFactory : IConnectorFactory
{
    private readonly IServiceProvider _serviceProvider;

    public ConnectorFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IConnector CreateConnector(ConnectorType type)
    {
        return type switch
        {
            ConnectorType.Databricks => _serviceProvider.GetRequiredService<DatabricksConnector>(),
            ConnectorType.Synapse => _serviceProvider.GetRequiredService<SynapseConnector>(),
            ConnectorType.Airflow => _serviceProvider.GetRequiredService<AirflowConnector>(),
            ConnectorType.AzureDataFactory => _serviceProvider.GetRequiredService<AzureDataFactoryConnector>(),
            _ => throw new NotSupportedException($"Connector type '{type}' is not supported")
        };
    }
}
