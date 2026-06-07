import { NextRequest, NextResponse } from "next/server";
import { getPool, defaultDbKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbKey = searchParams.get("db") || defaultDbKey();

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool.request().query(`
      SELECT DISTINCT Status
      FROM ServiceReqTemplate WITH (NOLOCK)
      WHERE Status IS NOT NULL AND Status <> ''
      ORDER BY Status
    `);
    return NextResponse.json({ statuses: result.recordset.map((r: { Status: string }) => r.Status) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
