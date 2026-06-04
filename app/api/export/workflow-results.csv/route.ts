import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, defaultDbKey } from "@/lib/db";
import { buildWorkflowQuery } from "@/lib/workflow-query";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowName = searchParams.get("workflowName") ?? "";
  const blockType    = searchParams.get("blockType")    ?? "";
  const teamName     = searchParams.get("teamName")     ?? "";
  const status       = searchParams.get("status")       ?? "";
  const dbKey        = searchParams.get("db")           || defaultDbKey();
  const words = workflowName.trim().split(/\s+/).filter(Boolean);

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const request = pool
      .request()
      .input("bt", sql.NVarChar(50),  blockType)
      .input("tn", sql.NVarChar(255), teamName)
      .input("st", sql.NVarChar(50),  status);
    words.forEach((word, i) => request.input(`wf${i}`, sql.NVarChar(255), word));
    const result = await request.query(buildWorkflowQuery(words.length));

    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Workflow Name", "Version", "Offering Status", "Block Title", "Block Type", "Team Name"];
    const lines = [
      headers.map(escape).join(","),
      ...result.recordset.map((r) =>
        [r.WorkflowName, r.DefVersion, r.RequestOfferingStatus, r.BlockTitle, r.BlockType, r.TeamName]
          .map(escape).join(",")
      ),
    ];
    const csv = "﻿" + lines.join("\r\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="workflow-results.csv"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
