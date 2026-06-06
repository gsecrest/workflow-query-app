import { NextRequest, NextResponse } from "next/server";
import { getPool, defaultDbKey } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbKey = searchParams.get("db") || defaultDbKey();

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool.request().query(`
      SELECT
        ObjectType,
        COUNT(DISTINCT RecId) AS WorkflowCount
      FROM frs_def_workflow_type WITH (NOLOCK)
      WHERE ObjectType IS NOT NULL
        AND ObjectType <> ''
        AND ObjectType <> 'ServiceReq'
        AND Name NOT LIKE '%backup%'
      GROUP BY ObjectType
      ORDER BY ObjectType
    `);
    return NextResponse.json({
      objectTypes: result.recordset.map((r: { ObjectType: string; WorkflowCount: number }) => ({
        value: r.ObjectType,
        label: `${r.ObjectType} (${r.WorkflowCount})`,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
