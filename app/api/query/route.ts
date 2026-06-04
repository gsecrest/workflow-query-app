import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, defaultDbKey } from "@/lib/db";
import { buildWorkflowQuery } from "@/lib/workflow-query";

export async function POST(req: NextRequest) {
  const { workflowName, blockType, teamName, status, db } = await req.json();
  const dbKey = (db as string) || defaultDbKey();
  const words = ((workflowName as string) ?? "").trim().split(/\s+/).filter(Boolean);

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const request = pool
      .request()
      .input("bt", sql.NVarChar(50), blockType ?? "")
      .input("tn", sql.NVarChar(255), teamName ?? "")
      .input("st", sql.NVarChar(50), status ?? "");
    words.forEach((word, i) => request.input(`wf${i}`, sql.NVarChar(255), word));
    const result = await request.query(buildWorkflowQuery(words.length));

    return NextResponse.json({ rows: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
