import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, ChevronDown, ChevronRight, Search, Loader2, List, FileText, Grid3x3 } from "lucide-react";
import { listDatabases } from "@/lib/biIntegrationApi";
import { useI18n } from "@/contexts/I18nContext";
import {
  type DataSourceSettings,
  type AirflowDataSourceSettings,
  type DatabricksDataSourceSettings,
  type AdfDataSourceSettings,
  parseDataSourceSettings,
  stringifyDataSourceSettings,
} from "@/types/cardDataSourceSettings";

interface CardAdvancedSettingsProps {
  integrationType: string;
  integrationId?: number;
  dataSourceJson?: string | null;
  onChange: (dataSourceJson: string | null) => void;
}

export function CardAdvancedSettings({
  integrationType,
  integrationId,
  dataSourceJson,
  onChange,
}: CardAdvancedSettingsProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<DataSourceSettings | null>(
    parseDataSourceSettings(dataSourceJson)
  );
  const [expanded, setExpanded] = useState(false);

  // Airflow-specific state (always declare hooks at top level)
  const [editingDags, setEditingDags] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"individual" | "text" | "search">("individual");
  const [textInput, setTextInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hoveredDag, setHoveredDag] = useState<string | null>(null);
  const [tempDagIds, setTempDagIds] = useState<string[]>([]); // Temporary list before saving

  // Update settings when dataSourceJson prop changes
  useEffect(() => {
    setSettings(parseDataSourceSettings(dataSourceJson));
  }, [dataSourceJson]);

  // Reset search state when changing selection mode
  useEffect(() => {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  }, [selectionMode]);

  // Initialize tempDagIds when entering edit mode
  useEffect(() => {
    if (integrationType?.toLowerCase() === "airflow") {
      const airflowSettings = settings as AirflowDataSourceSettings;
      const currentDagIds = airflowSettings?.dagIds || [];
      if (editingDags || currentDagIds.length === 0) {
        setTempDagIds(currentDagIds);
      }
    }
  }, [editingDags, settings, integrationType]);

  // Don't render if no valid integration type
  if (!integrationType) {
    console.warn('[CardAdvancedSettings] No integration type provided');
    return null;
  }

  // Handle DAG search (on-demand)
  const handleSearchDags = async () => {
    if (!integrationId) return;

    setLoadingSearch(true);
    setHasSearched(true);
    try {
      // Pass search term to backend - it will filter and limit appropriately
      const searchTerm = searchQuery.trim() || undefined;
      const dags = await listDatabases(integrationId, searchTerm);
      setSearchResults(dags);
    } catch (error) {
      console.error('Failed to search DAGs:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Notify parent when settings change
  const updateSettings = (newSettings: DataSourceSettings | null) => {
    console.log('[updateSettings] New settings:', newSettings);

    console.log('[updateSettings] Stringified:', stringifyDataSourceSettings(newSettings));
    setSettings(newSettings);
    onChange(stringifyDataSourceSettings(newSettings));
    console.log('[updateSettings] onChange called');
  };

  // Initialize settings with integration type if not set
  const initializeSettings = () => {
    const newSettings: DataSourceSettings = {
      integrationType,
    };
    updateSettings(newSettings);
    setExpanded(true);
  };

  // Clear all settings
  const clearSettings = () => {
    updateSettings(null);
    setExpanded(false);
  };

  // Render Airflow-specific settings
  const renderAirflowSettings = () => {
    const airflowSettings = (settings as AirflowDataSourceSettings) || {
      integrationType: "airflow",
    };

    const dagIds = airflowSettings.dagIds || [];
    const limit = airflowSettings.limit;

    const updateAirflowSettings = (updates: Partial<AirflowDataSourceSettings>) => {
      console.log('[updateAirflowSettings] Updates:', updates);
      console.log('[updateAirflowSettings] Current airflowSettings:', airflowSettings);
      const newSettings = {
        ...airflowSettings,
        ...updates,
      };
      console.log('[updateAirflowSettings] Merged settings:', newSettings);
      updateSettings(newSettings);
    };

    // Handle text mode paste (temporary, not saved yet)
    const handleTextSubmit = () => {
      const lines = textInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      setTempDagIds(lines);
      setTextInput("");
    };

    // Add DAG from search results (temporary, not saved yet)
    const addDagFromSearch = (dagId: string) => {
      if (!tempDagIds.includes(dagId)) {
        setTempDagIds([...tempDagIds, dagId]);
      }
    };

    // Remove DAG (temporary, not saved yet)
    const removeDag = (dagId: string) => {
      setTempDagIds(tempDagIds.filter((id) => id !== dagId));
    };

    // Apply/Save the temporary DAG list
    const applyDagChanges = () => {
      console.log('[applyDagChanges] Saving DAGs:', tempDagIds);
      console.log('[applyDagChanges] Current settings:', airflowSettings);
      updateAirflowSettings({ dagIds: tempDagIds.length > 0 ? tempDagIds : undefined });
      setEditingDags(false);
      console.log('[applyDagChanges] Done, editingDags set to false');
    };

    // Cancel editing
    const cancelDagEditing = () => {
      setTempDagIds(dagIds);
      setEditingDags(false);
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
    };

    return (
      <div className="space-y-4">
        {/* DAG IDs Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">DAG IDs</Label>

          {/* View Mode - Show configured DAGs */}
          {!editingDags && dagIds.length > 0 ? (
            <div className="space-y-2">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <List className="w-4 h-4 text-emerald-700 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 mb-1.5">
                      {dagIds.length} {dagIds.length === 1 ? t("dagSelectionConfigured") : t("dagSelectionConfiguredPlural")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dagIds.slice(0, 5).map((dagId, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        >
                          {dagId}
                        </span>
                      ))}
                      {dagIds.length > 5 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
                          +{dagIds.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingDags(true)}
                  className="flex-1"
                >
                  {t("dagSelectionChangeDags")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => updateAirflowSettings({ dagIds: undefined })}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  {t("dagSelectionClearAll")}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Edit Mode or No DAGs configured */}
          {(editingDags || dagIds.length === 0) && (
            <>
              {dagIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingDags(false)}
                  className="mb-2"
                >
                  Cancel Changes
                </Button>
              )}

              {/* Mode Selection */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectionMode("individual")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectionMode === "individual"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Grid3x3 className="w-3.5 h-3.5" />
                  {t("dagSelectionModeIndividual")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("text")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectionMode === "text"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {t("dagSelectionModeText")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("search")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectionMode === "search"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  {t("dagSelectionModeSearch")}
                </button>
              </div>

              {/* Individual Mode */}
              {selectionMode === "individual" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Add DAG IDs one by one
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        updateAirflowSettings({
                          dagIds: [...dagIds, ""],
                        });
                      }}
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add DAG
                    </Button>
                  </div>
                  {dagIds.length > 0 && (
                    <div className="space-y-2">
                      {dagIds.map((dagId, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="dag_id (e.g., my_dag)"
                            value={dagId}
                            onChange={(e) => {
                              const newDagIds = [...dagIds];
                              newDagIds[index] = e.target.value;
                              updateAirflowSettings({ dagIds: newDagIds });
                            }}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const newDagIds = dagIds.filter((_, i) => i !== index);
                              updateAirflowSettings({
                                dagIds: newDagIds.length > 0 ? newDagIds : undefined,
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Text Mode */}
              {selectionMode === "text" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("dagSelectionTextHint")}
                  </p>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={t("dagSelectionTextPlaceholder")}
                    className="w-full min-h-[120px] px-3 py-2 rounded-md border border-border bg-background font-mono text-xs resize-y"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                  >
                    {t("dagSelectionApplyDags")}
                  </Button>
                </div>
              )}

              {/* Search Mode */}
              {selectionMode === "search" && (
                <div className="space-y-3">
                  {/* Search Input with Button */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSearchDags();
                          }
                        }}
                        placeholder={t("dagSelectionSearchPlaceholder")}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSearchDags}
                      disabled={loadingSearch}
                      className="px-3"
                    >
                      {loadingSearch ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {/* Fixed DAG name display area (below search field) */}
                  <div className="min-h-[40px] p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono">
                    {hoveredDag ? (
                      <span className="text-slate-900 dark:text-slate-100 break-all">{hoveredDag}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic">Passe o mouse sobre uma DAG para ver o nome completo</span>
                    )}
                  </div>

                  {/* Loading State */}
                  {loadingSearch && (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t("dagSelectionLoadingDags")}</span>
                    </div>
                  )}

                  {/* Two Column Layout: Search Results | Selected DAGs */}
                  {!loadingSearch && hasSearched && (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Left: Search Results */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("dagSelectionResults")} ({searchResults.length})
                        </p>

                        <div className="max-h-[250px] overflow-y-auto space-y-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                          {searchResults.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              {t("dagSelectionNoDagsFound")}
                            </p>
                          ) : (
                            searchResults.map((dag, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-1.5 hover:bg-background rounded text-[11px] group"
                                onMouseEnter={() => setHoveredDag(dag)}
                                onMouseLeave={() => setHoveredDag(null)}
                              >
                                <span className="flex-1 truncate font-mono">{dag}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => addDagFromSearch(dag)}
                                  disabled={tempDagIds.includes(dag)}
                                  className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {tempDagIds.includes(dag) ? "✓" : "+"}
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Right: Selected DAGs */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("dagSelectionSelected")} ({tempDagIds.length})
                        </p>

                        <div className="max-h-[250px] overflow-y-auto space-y-1 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          {tempDagIds.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4 italic">
                              {t("dagSelectionNoneSelected")}
                            </p>
                          ) : (
                            tempDagIds.map((dagId, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded text-[11px] group"
                                onMouseEnter={() => setHoveredDag(dagId)}
                                onMouseLeave={() => setHoveredDag(null)}
                              >
                                <span className="flex-1 truncate font-mono text-emerald-900 dark:text-emerald-100">
                                  {dagId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeDag(dagId)}
                                  className="h-5 w-5 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save/Cancel Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyDagChanges}
                      className="flex-1"
                    >
                      Salvar Seleção
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelDagEditing}
                    >
                      Cancelar
                    </Button>
                  </div>

                  {/* Help text when no search performed */}
                  {!loadingSearch && !hasSearched && (
                    <p className="text-xs text-muted-foreground text-center py-4 italic">
                      {t("dagSelectionSearchHint")}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {dagIds.length === 0 && !editingDags && (
            <p className="text-xs text-muted-foreground italic py-2">
              No DAGs configured. All DAGs will be shown.
            </p>
          )}
        </div>

        {/* Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit" className="text-sm font-medium">
            Number of Records
          </Label>
          <Input
            id="limit"
            type="number"
            placeholder="Default from template"
            value={limit || ""}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined;
              updateAirflowSettings({ limit: value });
            }}
            min="1"
            max="1000"
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of records to fetch. Leave empty to use template default.
          </p>
        </div>
      </div>
    );
  };

  // Render Databricks-specific settings
  const renderDatabricksSettings = () => {
    const databricksSettings = (settings as DatabricksDataSourceSettings) || {
      integrationType: "databricks",
    };

    const clusterIds = databricksSettings.clusterIds || [];
    const jobIds = databricksSettings.jobIds || [];
    const limit = databricksSettings.limit;

    const updateDatabricksSettings = (updates: Partial<DatabricksDataSourceSettings>) => {
      updateSettings({
        ...databricksSettings,
        ...updates,
      });
    };

    return (
      <div className="space-y-4">
        {/* Cluster IDs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Cluster IDs</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                updateDatabricksSettings({
                  clusterIds: [...clusterIds, ""],
                });
              }}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Cluster
            </Button>
          </div>
          {clusterIds.length > 0 && (
            <div className="space-y-2">
              {clusterIds.map((clusterId, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Cluster ID"
                    value={clusterId}
                    onChange={(e) => {
                      const newIds = [...clusterIds];
                      newIds[index] = e.target.value;
                      updateDatabricksSettings({ clusterIds: newIds });
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newIds = clusterIds.filter((_, i) => i !== index);
                      updateDatabricksSettings({
                        clusterIds: newIds.length > 0 ? newIds : undefined,
                      });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job IDs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Job IDs</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                updateDatabricksSettings({
                  jobIds: [...jobIds, ""],
                });
              }}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Job
            </Button>
          </div>
          {jobIds.length > 0 && (
            <div className="space-y-2">
              {jobIds.map((jobId, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Job ID"
                    value={jobId}
                    onChange={(e) => {
                      const newIds = [...jobIds];
                      newIds[index] = e.target.value;
                      updateDatabricksSettings({ jobIds: newIds });
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newIds = jobIds.filter((_, i) => i !== index);
                      updateDatabricksSettings({
                        jobIds: newIds.length > 0 ? newIds : undefined,
                      });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit" className="text-sm font-medium">
            Number of Records
          </Label>
          <Input
            id="limit"
            type="number"
            placeholder="Default from template"
            value={limit || ""}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined;
              updateDatabricksSettings({ limit: value });
            }}
            min="1"
            max="1000"
          />
        </div>
      </div>
    );
  };

  // Render ADF-specific settings
  const renderAdfSettings = () => {
    const adfSettings = (settings as AdfDataSourceSettings) || {
      integrationType: "adf",
    };

    const pipelineNames = adfSettings.pipelineNames || [];
    const limit = adfSettings.limit;

    const updateAdfSettings = (updates: Partial<AdfDataSourceSettings>) => {
      updateSettings({
        ...adfSettings,
        ...updates,
      });
    };

    return (
      <div className="space-y-4">
        {/* Pipeline Names */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Pipeline Names</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                updateAdfSettings({
                  pipelineNames: [...pipelineNames, ""],
                });
              }}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Pipeline
            </Button>
          </div>
          {pipelineNames.length > 0 && (
            <div className="space-y-2">
              {pipelineNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Pipeline name"
                    value={name}
                    onChange={(e) => {
                      const newNames = [...pipelineNames];
                      newNames[index] = e.target.value;
                      updateAdfSettings({ pipelineNames: newNames });
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newNames = pipelineNames.filter((_, i) => i !== index);
                      updateAdfSettings({
                        pipelineNames: newNames.length > 0 ? newNames : undefined,
                      });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Limit */}
        <div className="space-y-2">
          <Label htmlFor="limit" className="text-sm font-medium">
            Number of Records
          </Label>
          <Input
            id="limit"
            type="number"
            placeholder="Default from template"
            value={limit || ""}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined;
              updateAdfSettings({ limit: value });
            }}
            min="1"
            max="1000"
          />
        </div>
      </div>
    );
  };

  // Render settings based on integration type
  const renderSettings = () => {
    if (!settings) return null;
    if (!integrationType) return null;

    switch (integrationType.toLowerCase()) {
      case "airflow":
        return renderAirflowSettings();
      case "databricks":
        return renderDatabricksSettings();
      case "adf":
      case "azuredatafactory":
        return renderAdfSettings();
      default:
        return (
          <p className="text-sm text-muted-foreground">
            No advanced settings available for this integration type: {integrationType}
          </p>
        );
    }
  };

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Advanced Settings
          {settings && (
            <span className="text-xs text-muted-foreground font-normal">(configured)</span>
          )}
        </button>
        {settings && !expanded && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={clearSettings}
            className="h-7 text-xs text-destructive hover:text-destructive"
          >
            Clear
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-4 pl-6">
          {!settings ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Configure optional filters and settings for this card.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={initializeSettings}
              >
                Enable Advanced Settings
              </Button>
            </div>
          ) : (
            <>
              {renderSettings()}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSettings}
                className="text-destructive hover:text-destructive"
              >
                Clear All Settings
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
