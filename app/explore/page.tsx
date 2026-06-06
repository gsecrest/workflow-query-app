"use client";

import { useState, useEffect, useCallback } from "react";

const QUERY_LABELS: Record<string, string> = {
  ro_tables:              "RO-related tables",
  attr_tables:            "Param / Attribute / Field tables",
  workflow_tables:        "Workflow / Block tables",
  srt_columns:            "ServiceReqTemplate columns",
  srt_sample:             "ServiceReqTemplate sample rows",
  fulfillment_columns:    "ServiceReqFulfillmentPlan columns",
  fusionlink_rels:        "FusionLink relationships",
  ro_param_tables:        "Tables joining to ServiceReqTemplate",
  srt_param_columns:      "ServiceReqTemplateParam columns",
  srt_param_sample:       "ServiceReqTemplateParam sample rows",
  srt_param_valid_columns:"ServiceReqTemplateParamValid columns",
  srt_definition_columns: "ServiceReqTemplateDefinition columns",
  srt_param_by_template:  "RO names with param names & types",
  srt_param_types:        "Distinct DisplayType values",
  ro_with_blocktype:      "ROs with workflow block types",
  ro_params_full:         "ROs + params + workflow name",
};

export default function ExplorePage() {
  const [activeQuery, setActiveQuery] = useState("ro_tables");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runQuery = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const res = await fetch(`/api/explore?q=${key}`);
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setRows(data.rows ?? []); setLabel(data.label ?? ""); }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runQuery(activeQuery); }, [activeQuery, runQuery]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Database Explorer</h1>
          <p className="text-sm text-gray-500 mt-1">Discovery queries to find RO attribute tables</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {Object.entries(QUERY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveQuery(key)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                    activeQuery === key
                      ? "bg-gray-900 text-white font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">{label}</h2>

              {loading && <p className="text-sm text-gray-400">Running query...</p>}
              {error && <p className="text-sm text-red-600 font-mono">{error}</p>}

              {!loading && !error && rows.length === 0 && (
                <p className="text-sm text-gray-400">No results.</p>
              )}

              {!loading && !error && rows.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 mb-3">{rows.length} row{rows.length !== 1 ? "s" : ""}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {columns.map((col) => (
                            <th key={col} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            {columns.map((col) => (
                              <td key={col} className="px-3 py-2 text-gray-700 font-mono text-xs whitespace-nowrap max-w-xs truncate">
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
