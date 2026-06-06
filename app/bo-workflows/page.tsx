"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Row {
  WorkflowName:   string;
  ObjectType:     string;
  Description:    string;
  DefVersion:     string;
  BlockTitle:     string;
  BlockType:      string;
  TeamName:       string;
  AttributeSource:string;
}

const BLOCK_TYPES = [
  "start","stop","update","quickaction","advancedtask","task",
  "vote","vote0007","if","wait","notify","subprocess","parallel","join","escalation",
];

export default function BoWorkflowsPage() {
  const [objectType,   setObjectType]   = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [blockType,    setBlockType]    = useState("");
  const [teamName,     setTeamName]     = useState("");
  const [db,           setDb]           = useState("");
  const [databases,    setDatabases]    = useState<{ key: string; label: string }[]>([]);
  const [objectTypes,  setObjectTypes]  = useState<{ value: string; label: string }[]>([]);
  const [rows,         setRows]         = useState<Row[]>([]);
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

  const loadObjectTypes = useCallback((dbKey: string) => {
    fetch(`/api/bo-object-types?db=${dbKey}`)
      .then(r => r.json())
      .then(d => setObjectTypes(d.objectTypes ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { if (db) loadObjectTypes(db); }, [db, loadObjectTypes]);

  async function runQuery() {
    setLoading(true);
    setError("");
    setQueried(false);
    try {
      const res = await fetch("/api/bo-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType, workflowName, blockType, teamName, db }),
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
    setObjectType(""); setWorkflowName(""); setBlockType(""); setTeamName("");
    setRows([]); setQueried(false); setError("");
  }

  const workflowCount = new Set(rows.map(r => r.WorkflowName)).size;

  const SOURCE_COLORS: Record<string, string> = {
    QuickAction:   "bg-blue-50 text-blue-700",
    TeamBlock:     "bg-green-50 text-green-700",
    ApprovalGroup: "bg-purple-50 text-purple-700",
    None:          "bg-gray-100 text-gray-500",
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Object Workflow Attributes</h1>
            <p className="text-sm text-gray-500 mt-1">
              Browse workflow block types and attributes for all Ivanti business objects.
            </p>
          </div>
          <Link href="/"
            className="text-sm text-gray-500 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors">
            ← RO Workflow Query
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">

            {databases.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Database</label>
                <select value={db} onChange={e => setDb(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400">
                  {databases.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Object Type</label>
              <select value={objectType} onChange={e => setObjectType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">All object types</option>
                {objectTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Workflow Name</label>
              <input type="text" value={workflowName} onChange={e => setWorkflowName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runQuery()}
                placeholder="All workflows"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Block Type</label>
              <select value={blockType} onChange={e => setBlockType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">All block types</option>
                {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 uppercase tracking-wide mb-1">Team / Group</label>
              <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runQuery()}
                placeholder="All teams"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>

            <div className="flex items-end gap-2">
              <button onClick={runQuery} disabled={loading}
                className="flex-1 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
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

        {/* Results */}
        {rows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{rows.length}</span> block{rows.length !== 1 ? "s" : ""} across{" "}
                <span className="font-semibold text-gray-900">{workflowCount}</span> workflow{workflowCount !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/> QuickAction</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/> TeamBlock</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"/> ApprovalGroup</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block"/> None</span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Workflow Name","Object Type","Description","Version","Block Title","Block Type","Team / Group","Attr Source"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isNewWF = i === 0 || row.WorkflowName !== rows[i - 1].WorkflowName;
                    return (
                      <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${isNewWF && i > 0 ? "border-t-2 border-t-gray-200" : ""}`}>
                        <td className="px-4 py-2.5 text-gray-900 font-medium">{isNewWF ? row.WorkflowName : ""}</td>
                        <td className="px-4 py-2.5 text-gray-600">{isNewWF ? row.ObjectType : ""}</td>
                        <td className="px-4 py-2.5 text-gray-400 max-w-xs" style={{maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis"}}>{isNewWF ? row.Description : ""}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-center">{isNewWF ? row.DefVersion : ""}</td>
                        <td className="px-4 py-2.5 text-gray-700">{row.BlockTitle}</td>
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
