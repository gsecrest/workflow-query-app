import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool, defaultDbKey } from "@/lib/db";
import { buildAttributeQuery } from "@/lib/ro-attribute-query";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dbKey        = searchParams.get("db")           || defaultDbKey();
  const offeringName = searchParams.get("offeringName") ?? "";
  const status       = searchParams.get("status")       ?? "";
  const fieldType    = searchParams.get("fieldType")    ?? "";

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool
      .request()
      .input("on", sql.NVarChar(255), offeringName)
      .input("st", sql.NVarChar(50),  status)
      .input("ft", sql.NVarChar(50),  fieldType)
      .query(buildAttributeQuery());

    const headers = ["Offering Name", "Offering Status", "Workflow Name", "Seq", "Field Name", "Display Name", "Field Type", "Read Only", "Required"];
    const rows = result.recordset.map((r: Record<string, unknown>) =>
      [r.OfferingName, r.OfferingStatus, r.WorkflowName, r.SequenceNum, r.FieldName, r.DisplayName, r.FieldType, r.ReadOnly, r.Required]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="ro-attributes.csv"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
