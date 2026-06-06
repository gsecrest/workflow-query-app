import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, defaultDbKey } from "@/lib/db";
import { buildBoWorkflowQuery } from "@/lib/bo-workflow-query";

export async function POST(req: NextRequest) {
  const { objectType, workflowName, blockType, teamName, db } = await req.json();
  const dbKey = (db as string) || defaultDbKey();

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool
      .request()
      .input("ot", sql.NVarChar(100), objectType   ?? "")
      .input("wn", sql.NVarChar(255), workflowName ?? "")
      .input("bt", sql.NVarChar(50),  blockType    ?? "")
      .input("tn", sql.NVarChar(255), teamName     ?? "")
      .query(buildBoWorkflowQuery());

    return NextResponse.json({ rows: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
