import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, defaultDbKey } from "@/lib/db";
import { buildBlockQuery } from "@/lib/ro-block-query";

export async function POST(req: NextRequest) {
  const { offeringName, status, blockType, db } = await req.json();
  const dbKey = (db as string) || defaultDbKey();

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool
      .request()
      .input("on", sql.NVarChar(255), offeringName ?? "")
      .input("st", sql.NVarChar(50),  status       ?? "")
      .input("bt", sql.NVarChar(50),  blockType    ?? "")
      .query(buildBlockQuery());

    return NextResponse.json({ rows: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
