import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Play, Check, X, AlertCircle } from "lucide-react";
import { testStudioCard as testCard, type StudioCardTestResult } from "@/lib/studioApi";

interface QueryEditorProps {
  query?: string;
  integrationId?: number;
  cardType?: string;
  layoutType?: string;
  fieldsJson?: string | null;
  styleJson?: string | null;
  layoutJson?: string | null;
  refreshPolicyJson?: string | null;
  dataSourceJson?: string | null;
  onChange: (query: string) => void;
  onTestSuccess?: (signature: string, testedAt: Date) => void;
}

export function QueryEditor({
  query = "",
  integrationId,
  cardType,
  layoutType,
  fieldsJson,
  styleJson,
  layoutJson,
  refreshPolicyJson,
  dataSourceJson,
  onChange,
  onTestSuccess
}: QueryEditorProps) {
  const [testResult, setTestResult] = useState<StudioCardTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!integrationId) {
      setTestResult({
        success: false,
        errorMessage: "Please select an integration first",
      });
      return;
    }

    if (!query.trim()) {
      setTestResult({
        success: false,
        errorMessage: "Please enter a query",
      });
      return;
    }

    setTesting(true);
    try {
      const result = await testCard({
        integrationId,
        query,
        cardType,
        layoutType,
        fieldsJson: fieldsJson ?? undefined,
        styleJson: styleJson ?? undefined,
        layoutJson: layoutJson ?? undefined,
        refreshPolicyJson: refreshPolicyJson ?? undefined,
        dataSourceJson: dataSourceJson ?? undefined,
      });
      setTestResult(result);

      // Call onTestSuccess callback if test was successful
      if (result.success && result.signature && onTestSuccess) {
        onTestSuccess(result.signature, new Date());
      }
    } catch (error: unknown) {
      // Extract error message from backend response
      let errorMessage = "Test failed";
      const err = error as { response?: { data?: { errorMessage?: string; message?: string } }; message?: string };

      if (err.response?.data?.errorMessage) {
        // Backend returned a structured error
        errorMessage = err.response.data.errorMessage;
      } else if (err.response?.data?.message) {
        // Alternative error format
        errorMessage = err.response.data.message;
      } else if (err.message) {
        // Generic error message
        errorMessage = err.message;
      }

      setTestResult({
        success: false,
        errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="query" className="text-base font-semibold">
          SQL Query
        </Label>
        <Button
          size="sm"
          variant="outline"
          onClick={handleTest}
          disabled={!integrationId || !query.trim() || testing}
          className="gap-2"
        >
          {testing ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Test Query
            </>
          )}
        </Button>
      </div>

      <textarea
        id="query"
        className="w-full min-h-[200px] px-3 py-2 rounded-md border border-border bg-background font-mono text-sm resize-y"
        placeholder="SELECT * FROM your_table LIMIT 100"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />

      {!testResult ? (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
          ⚠️ Test your query before saving the configuration
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Write the SQL query to fetch data from the selected integration
        </p>
      )}

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded-lg border-2 ${
            testResult.success
              ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-start gap-2">
            {testResult.success ? (
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  testResult.success
                    ? "text-emerald-900 dark:text-emerald-100"
                    : "text-red-900 dark:text-red-100"
                }`}
              >
                {testResult.success ? "Query executed successfully!" : "Query failed"}
              </p>
              {testResult.errorMessage && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 font-mono">
                  {testResult.errorMessage}
                </p>
              )}
              {testResult.success && testResult.executionTimeMs !== undefined && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Execution time: {testResult.executionTimeMs}ms
                </p>
              )}
            </div>
            <button
              onClick={() => setTestResult(null)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
