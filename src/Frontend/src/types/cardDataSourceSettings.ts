/**
 * Advanced settings for card data sources
 * Stored in the DataSourceJson field
 */

// Base interface for all data source settings
export interface CardDataSourceSettings {
  integrationType?: string;
}

// Airflow-specific settings
export interface AirflowDataSourceSettings extends CardDataSourceSettings {
  integrationType: "airflow";
  dagIds?: string[]; // List of specific DAG IDs to filter, empty = all
  limit?: number; // Number of records to fetch
  orderBy?: string; // Order by field (e.g., "execution_date")
  state?: string[]; // Filter by DAG run states (success, failed, running, etc.)
}

// Databricks-specific settings
export interface DatabricksDataSourceSettings extends CardDataSourceSettings {
  integrationType: "databricks";
  clusterIds?: string[]; // List of specific cluster IDs to filter
  jobIds?: string[]; // List of specific job IDs to filter
  states?: string[]; // Filter by run states
  limit?: number;
}

// ADF (Azure Data Factory) settings
export interface AdfDataSourceSettings extends CardDataSourceSettings {
  integrationType: "adf";
  pipelineNames?: string[]; // List of specific pipeline names to filter
  limit?: number;
  status?: string[]; // Filter by pipeline run status
}

// Synapse-specific settings
export interface SynapseDataSourceSettings extends CardDataSourceSettings {
  integrationType: "synapse";
  limit?: number;
}

// API-specific settings
export interface ApiDataSourceSettings extends CardDataSourceSettings {
  integrationType: "api";
  limit?: number;
  filters?: Record<string, any>; // Generic filters for API calls
}

// Union type for all data source settings
export type DataSourceSettings =
  | AirflowDataSourceSettings
  | DatabricksDataSourceSettings
  | AdfDataSourceSettings
  | SynapseDataSourceSettings
  | ApiDataSourceSettings
  | CardDataSourceSettings;

/**
 * Parse DataSourceJson string to typed settings
 */
export function parseDataSourceSettings(json?: string | null): DataSourceSettings | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as DataSourceSettings;
  } catch {
    return null;
  }
}

/**
 * Stringify settings to JSON for storage
 */
export function stringifyDataSourceSettings(settings: DataSourceSettings | null): string | null {
  if (!settings) return null;
  try {
    return JSON.stringify(settings);
  } catch {
    return null;
  }
}
