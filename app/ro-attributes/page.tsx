"use client";

import { useState, useEffect, useCallback } from "react";

interface FieldRow {
  OfferingName: string;
  OfferingStatus: string;
  WorkflowName: string;
  SequenceNum: number;
  FieldName: string;
  DisplayName: string;
  FieldType: string;
  ReadOnly: string;
  Required: string;
}

interface BlockRow {
  OfferingName: string;
  OfferingStatus: string;
  WorkflowName: string;
  BlockTitle: string;
  BlockType: string;
  TeamName: string;
  AttributeSource: string;
}

const SOURCE_COLORS: Record<string, string> = {
  QuickAction:   "bg-blue-50 text-blue-700",
  TeamBlock:     "bg-green-50 text-green-700",
  ApprovalGroup: "bg-purple-50 text-purple-700",
  None:          "bg-gray-100 text-gray-500",
};

const FIELD_TYPES = [
  "text","combo","textarea","checkbox","category","label",
  "rowaligner","date","swfupload","number","list","datetime",
  "image","time","money","email","ssn","phone","url",
];

export default function RoAttributesPage() {
  const [offeringName, setOfferingName] = useState("");
  const [status,       setStatus]       = useState("");
  const [fieldType,    setFieldType]    = useState("");
  const [db,           setDb]           = useState("");
  const [databases,    setDatabases]    = useState<{ key: string; label: string }[]>([]);
  const [statuses,     setStatuses]     = useState<string[]>([]);
  const [fieldRows,    setFieldRows]    = useState<FieldRow[]>([]);
  const [blockRows,    setBlockRows]    = useState<BlockRow[]>([]);
  const [activeTab,    setActiveTab]    = useState<"fields" | "blocks">("fields");
  const [loading,      setLoading]      = useState(false);
  const [queried,      setQueried]      = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    fetch("/api/databases")
      .then(r => r.json())
      .then(d => {
        setDatabases(d.databases ?? []);
        if (d.databases?.length) setDb(d.databases[0].key);
      })
      .catch(() => {});
  }, []);

  const loadStatuses = useCallback((dbKey: string) => {
    fetch(`/api/ro-statuses?db=${dbKey}`)
      .then(r => r.json())
      .then(d => setStatuses(d.statuses ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { if (db) loadStatuses(db); }, [db, loadStatuses]);

  async function runQuery() {
    setLoading(true);
    setError("");
    setQueried(false);
    try {
      const [fieldsRes, blocksRes] = await Promise.all([
        fetch("/api/ro-attributes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offeringName, status, fieldType, db }),
        }),
        fetch("/api/ro-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offeringName, status, db }),
        }),
      ]);
      const [fieldsData, blocksData] = await Promise.all([fieldsRes.json(), blocksRes.json()]);
      if (fieldsData.error || blocksData.error) {
        setError(fieldsData.error || blocksData.error);
        setFieldRows([]); setBlockRows([]);
      } else {
        setFieldRows(fieldsData.rows ?? []);
        setBlockRows(blocksData.rows ?? []);
      }
    } catch {
      setError("Request failed");
      setFieldRows([]); setBlockRows([]);
    } finally {
      setLoading(false);
      setQueried(true);
    }
  }

  function clearFilters() {
    setOfferingName(""); setStatus(""); setFieldType("");
    setFieldRows([]); setBlockRows([]); setQueried(false); setError("");
  }

  const exportParams = new URLSearchParams({ offeringName, status, fieldType, db }).toString();
  const exportHref   = `/api/export/ro-attributes.csv?${exportParams}`;
  const roCount      = new Set(fieldRows.map(r => r.OfferingName)).size;
  const blockRoCount = new Set(blockRows.map(r => r.OfferingName)).size;
  const hasResults   = fieldRows.length > 0 || blockRows.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">RO Form Attributes</h1>
          <p className="text-sm text-gray-500 mt-1">List form fields and workflow block attributes for request offerings.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {databases.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Database</label>
                <select value={db} onChange={e => setDb(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {databases.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Offering Name</label>
              <input type="text" value={offeringName} onChange={e => setOfferingName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runQuery()}
                placeholder="All offerings"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Offering Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">All statuses</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Field Type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">All field types</option>
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={runQuery} disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
                {loading ? "Searching…" : "Search"}
              </button>
              <button onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Clear
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">{error}</div>
        )}

        {hasResults && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex border-b border-gray-200">
              {(["fields", "blocks"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab === "fields" ? "Form Fields" : "Workflow Blocks"}
                  <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {tab === "fields" ? fieldRows.length : blockRows.length}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === "fields" && (
              <>
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">{fieldRows.length}</span> field{fieldRows.length !== 1 ? "s" : ""} across{" "}
                    <span className="font-semibold text-gray-900">{roCount}</span> offering{roCount !== 1 ? "s" : ""}
                  </p>
                  <a href={exportHref} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Export CSV</a>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Offering Name","Status","Workflow","Seq","Field Name","Display Name","Field Type","Required","Read Only"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fieldRows.map((row, i) => {
                        const isNewRO = i === 0 || row.OfferingName !== fieldRows[i - 1].OfferingName;
                        return (
                          <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${isNewRO && i > 0 ? "border-t-2 border-t-gray-200" : ""}`}>
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{isNewRO ? row.OfferingName : ""}</td>
                            <td className="px-4 py-2.5 text-gray-600">{isNewRO ? row.OfferingStatus : ""}</td>
                            <td className="px-4 py-2.5 text-gray-600">{isNewRO ? row.WorkflowName : ""}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-center">{row.SequenceNum}</td>
                            <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{row.FieldName}</td>
                            <td className="px-4 py-2.5 text-gray-900">{row.DisplayName}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">{row.FieldType}</span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{row.Required}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.ReadOnly}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === "blocks" && (
              <>
                <div className="px-6 py-4 border-b border-gray-200">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-900">{blockRows.length}</span> block{blockRows.length !== 1 ? "s" : ""} across{" "}
                    <span className="font-semibold text-gray-900">{blockRoCount}</span> offering{blockRoCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {["Offering Name","Status","Workflow","Block Title","Block Type","Team / Group","Attr Source"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {blockRows.map((row, i) => {
                        const isNewRO = i === 0 || row.OfferingName !== blockRows[i - 1].OfferingName;
                        return (
                          <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${isNewRO && i > 0 ? "border-t-2 border-t-gray-200" : ""}`}>
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{isNewRO ? row.OfferingName : ""}</td>
                            <td className="px-4 py-2.5 text-gray-600">{isNewRO ? row.OfferingStatus : ""}</td>
                            <td className="px-4 py-2.5 text-gray-600">{isNewRO ? row.WorkflowName : ""}</td>
                            <td className="px-4 py-2.5 text-gray-900">{row.BlockTitle}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">{row.BlockType}</span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">{row.TeamName || <span className="text-gray-300">—</span>}</td>
                            <td className="px-4 py-2.5">
                              {row.AttributeSource !== "None" && (
                                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${SOURCE_COLORS[row.AttributeSource] ?? "bg-gray-100 text-gray-600"}`}>
                                  {row.AttributeSource}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {queried && !loading && !hasResults && !error && (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
            No results found.
          </div>
        )}
      </div>
    </main>
  );
}
