"use client";

import { useState, useEffect } from "react";

interface BlockRow {
  OfferingName: string;
  OfferingStatus: string;
  WorkflowName: string;
  BlockTitle: string;
  BlockType: string;
  TeamName: string;
  AttributeSource: string;
}

const BLOCK_TYPES = [
  "start","stop","update","quickaction","advancedtask","task",
  "vote","vote0007","if","wait","notify","subprocess","parallel","join","escalation",
];

const SOURCE_COLORS: Record<string, string> = {
  QuickAction:   "bg-blue-50 text-blue-700",
  TeamBlock:     "bg-green-50 text-green-700",
  ApprovalGroup: "bg-purple-50 text-purple-700",
  None:          "bg-gray-100 text-gray-500",
};

export default function RoWorkflowBlocksPage() {
  const [offeringName, setOfferingName] = useState("");
  const [status,       setStatus]       = useState("");
  const [blockType,    setBlockType]    = useState("");
  const [db,           setDb]           = useState("");
  const [databases,    setDatabases]    = useState<{ key: string; label: string }[]>([]);
  const [rows,         setRows]         = useState<BlockRow[]>([]);
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


  async function runQuery() {
    setLoading(true);
    setError("");
    setQueried(false);
    try {
      const res = await fetch("/api/ro-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offeringName, status, blockType, db }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setRows([]); }
      else { setRows(data.rows ?? []); }
    } catch {
      setError("Request failed");
      setRows([]);
    } finally {
      setLoading(false);
      setQueried(true);
    }
  }

  function clearFilters() {
    setOfferingName(""); setStatus(""); setBlockType("");
    setRows([]); setQueried(false); setError("");
  }

  const offeringCount = new Set(rows.map(r => r.OfferingName)).size;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">RO Workflow Blocks</h1>
          <p className="text-sm text-gray-500 mt-1">Search workflow blocks across request offerings.</p>
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
                <option value="Published">Published</option>
                <option value="Design">Design</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Block Type</label>
              <select value={blockType} onChange={e => setBlockType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">All block types</option>
                {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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

        {rows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{rows.length}</span> block{rows.length !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-gray-900">{offeringCount}</span> offering{offeringCount !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/> QuickAction</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/> TeamBlock</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"/> ApprovalGroup</span>
              </div>
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
                  {rows.map((row, i) => {
                    const isNewRO = i === 0 || row.OfferingName !== rows[i - 1].OfferingName;
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
          </div>
        )}

        {queried && !loading && rows.length === 0 && !error && (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-sm text-gray-400">
            No results found.
          </div>
        )}
      </div>
    </main>
  );
}
