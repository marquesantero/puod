import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, X, Trash2, Code, Eye } from "lucide-react";
import { listDatabases, listTables } from "@/lib/biIntegrationApi";
import { useI18n } from "@/contexts/I18nContext";

interface VisualQueryBuilderProps {
  integrationId?: number;
  initialQuery?: string;
  onQueryChange: (query: string) => void;
}

interface ColumnSelection {
  id: string;
  column: string;
  aggregate?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX" | "";
  alias?: string;
}

interface WhereCondition {
  id: string;
  column: string;
  operator: "=" | ">" | "<" | ">=" | "<=" | "!=" | "LIKE" | "IN";
  value: string;
}

export function VisualQueryBuilder({ integrationId, initialQuery, onQueryChange }: VisualQueryBuilderProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"visual" | "sql">("visual");

  // Visual mode state
  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [columns, setColumns] = useState<ColumnSelection[]>([]);
  const [whereConditions, setWhereConditions] = useState<WhereCondition[]>([]);
  const [groupByColumns, setGroupByColumns] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<{ column: string; direction: "ASC" | "DESC" }[]>([]);
  const [limit, setLimit] = useState<number>(100);

  // SQL mode state
  const [sqlQuery, setSqlQuery] = useState<string>(initialQuery || "");

  // Load databases when integration changes
  useEffect(() => {
    if (integrationId) {
      loadDatabases();
    }
  }, [integrationId]);

  // Load tables when database changes
  useEffect(() => {
    if (integrationId && selectedDatabase) {
      loadTables();
    }
  }, [integrationId, selectedDatabase]);

  // Generate SQL when visual mode changes
  useEffect(() => {
    if (mode === "visual") {
      const generatedSql = generateSQL();
      setSqlQuery(generatedSql);
      onQueryChange(generatedSql);
    }
  }, [mode, selectedTable, columns, whereConditions, groupByColumns, orderBy, limit]);

  const loadDatabases = async () => {
    if (!integrationId) return;
    try {
      const dbs = await listDatabases(integrationId);
      setDatabases(dbs);
      if (dbs.length > 0 && !selectedDatabase) {
        setSelectedDatabase(dbs[0]);
      }
    } catch (error) {
      console.error("Failed to load databases:", error);
    }
  };

  const loadTables = async () => {
    if (!integrationId || !selectedDatabase) return;
    try {
      const tbls = await listTables(integrationId, selectedDatabase);
      setTables(tbls);
    } catch (error) {
      console.error("Failed to load tables:", error);
    }
  };

  const generateSQL = (): string => {
    if (!selectedTable) return "";

    let sql = "SELECT ";

    // Columns
    if (columns.length === 0) {
      sql += "*";
    } else {
      const columnParts = columns.map((col) => {
        let part = col.column;
        if (col.aggregate) {
          part = `${col.aggregate}(${col.column})`;
        }
        if (col.alias) {
          part += ` AS ${col.alias}`;
        }
        return part;
      });
      sql += columnParts.join(", ");
    }

    // FROM
    sql += `\nFROM ${selectedDatabase}.${selectedTable}`;

    // WHERE
    if (whereConditions.length > 0) {
      const whereParts = whereConditions.map((cond) => {
        let value = cond.value;
        if (cond.operator === "LIKE") {
          value = `'%${value}%'`;
        } else if (cond.operator === "IN") {
          value = `(${value})`;
        } else if (isNaN(Number(value))) {
          value = `'${value}'`;
        }
        return `${cond.column} ${cond.operator} ${value}`;
      });
      sql += `\nWHERE ${whereParts.join(" AND ")}`;
    }

    // GROUP BY
    if (groupByColumns.length > 0) {
      sql += `\nGROUP BY ${groupByColumns.join(", ")}`;
    }

    // ORDER BY
    if (orderBy.length > 0) {
      const orderParts = orderBy.map((o) => `${o.column} ${o.direction}`);
      sql += `\nORDER BY ${orderParts.join(", ")}`;
    }

    // LIMIT
    if (limit > 0) {
      sql += `\nLIMIT ${limit}`;
    }

    return sql;
  };

  const addColumn = () => {
    setColumns([...columns, { id: crypto.randomUUID(), column: "", aggregate: "" }]);
  };

  const removeColumn = (id: string) => {
    setColumns(columns.filter((c) => c.id !== id));
  };

  const updateColumn = (id: string, updates: Partial<ColumnSelection>) => {
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const addWhereCondition = () => {
    setWhereConditions([
      ...whereConditions,
      { id: crypto.randomUUID(), column: "", operator: "=", value: "" },
    ]);
  };

  const removeWhereCondition = (id: string) => {
    setWhereConditions(whereConditions.filter((c) => c.id !== id));
  };

  const updateWhereCondition = (id: string, updates: Partial<WhereCondition>) => {
    setWhereConditions(whereConditions.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  if (!integrationId) {
    return (
      <div className="p-6 text-center border-2 border-dashed rounded-lg">
        <p className="text-sm text-muted-foreground">{t("queryEditorErrorNoIntegration")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          size="sm"
          variant={mode === "visual" ? "default" : "outline"}
          onClick={() => setMode("visual")}
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Visual
        </Button>
        <Button
          size="sm"
          variant={mode === "sql" ? "default" : "outline"}
          onClick={() => setMode("sql")}
          className="gap-2"
        >
          <Code className="w-4 h-4" />
          SQL
        </Button>
      </div>

      {mode === "visual" ? (
        <div className="space-y-6">
          {/* Database & Table Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Database</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
              >
                <option value="">Select database...</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Table</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                disabled={!selectedDatabase}
              >
                <option value="">Select table...</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Columns Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">SELECT Columns</Label>
              <Button size="sm" variant="outline" onClick={addColumn} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Column
              </Button>
            </div>

            {columns.length === 0 && (
              <p className="text-sm text-muted-foreground italic">All columns (*) will be selected</p>
            )}

            {columns.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="column_name"
                  className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={col.column}
                  onChange={(e) => updateColumn(col.id, { column: e.target.value })}
                />
                <select
                  className="w-32 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={col.aggregate}
                  onChange={(e) => updateColumn(col.id, { aggregate: e.target.value as any })}
                >
                  <option value="">No aggregate</option>
                  <option value="SUM">SUM</option>
                  <option value="AVG">AVG</option>
                  <option value="COUNT">COUNT</option>
                  <option value="MIN">MIN</option>
                  <option value="MAX">MAX</option>
                </select>
                <input
                  type="text"
                  placeholder="alias"
                  className="w-32 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={col.alias}
                  onChange={(e) => updateColumn(col.id, { alias: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeColumn(col.id)}
                  className="text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* WHERE Conditions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">WHERE Conditions</Label>
              <Button size="sm" variant="outline" onClick={addWhereCondition} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Condition
              </Button>
            </div>

            {whereConditions.map((cond) => (
              <div key={cond.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="column_name"
                  className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={cond.column}
                  onChange={(e) => updateWhereCondition(cond.id, { column: e.target.value })}
                />
                <select
                  className="w-28 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={cond.operator}
                  onChange={(e) => updateWhereCondition(cond.id, { operator: e.target.value as any })}
                >
                  <option value="=">=</option>
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value=">=">{">="}</option>
                  <option value="<=">{"<="}</option>
                  <option value="!=">!=</option>
                  <option value="LIKE">LIKE</option>
                  <option value="IN">IN</option>
                </select>
                <input
                  type="text"
                  placeholder="value"
                  className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-sm"
                  value={cond.value}
                  onChange={(e) => updateWhereCondition(cond.id, { value: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeWhereCondition(cond.id)}
                  className="text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Limit */}
          <div className="space-y-2">
            <Label>LIMIT</Label>
            <input
              type="number"
              className="w-32 h-9 px-3 rounded-md border border-border bg-background text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min="0"
            />
          </div>

          {/* Generated SQL Preview */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Generated SQL:</Label>
            <pre className="p-3 rounded-md bg-slate-100 dark:bg-slate-900 text-xs font-mono overflow-x-auto border">
              {sqlQuery || "-- Configure options above to generate SQL"}
            </pre>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t("queryEditorTitle")}</Label>
          <textarea
            className="w-full min-h-[300px] px-3 py-2 rounded-md border border-border bg-background font-mono text-sm resize-y"
            placeholder={t("queryEditorPlaceholder")}
            value={sqlQuery}
            onChange={(e) => {
              setSqlQuery(e.target.value);
              onQueryChange(e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
