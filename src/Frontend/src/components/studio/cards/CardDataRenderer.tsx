import { Loader2, AlertCircle } from "lucide-react";
import type { QueryResultDto } from "@/lib/biIntegrationApi";
import { KPIRenderer } from "./renderers/KPIRenderer";
import { TableRenderer } from "./renderers/TableRenderer";
import { ChartRenderer } from "./renderers/ChartRenderer";
import { TimelineRenderer } from "./renderers/TimelineRenderer";

interface CardDataRendererProps {
  cardType: string;
  layoutType: string;
  title: string;
  integrationId?: number;
  dataSourceJson?: string | null;
  queryData?: QueryResultDto;
  loading: boolean;
  error?: string;
}

export function CardDataRenderer({
  cardType,
  layoutType,
  title: _title,
  integrationId,
  dataSourceJson,
  queryData,
  loading,
  error,
}: CardDataRendererProps) {
  // Loading State
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // No Integration
  if (!integrationId) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">Integration Not Configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure an integration to see live data
          </p>
        </div>
      </div>
    );
  }

  // Render based on card type
  const renderCardContent = () => {
    switch (cardType?.toLowerCase()) {
      case "kpi":
        return <KPIRenderer data={queryData} />;
      case "grid":
      case "table":
        return (
          <TableRenderer
            data={queryData}
            integrationId={integrationId}
            dataSourceJson={dataSourceJson}
          />
        );
      case "chart":
        return <ChartRenderer data={queryData} layoutType={layoutType} />;
      case "timeline":
        return <TimelineRenderer data={queryData} />;
      default:
        return (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">
              Data loaded: {queryData?.rowCount || 0} rows
            </p>
          </div>
        );
    }
  };

  return <div className="h-full overflow-auto">{renderCardContent()}</div>;
}
