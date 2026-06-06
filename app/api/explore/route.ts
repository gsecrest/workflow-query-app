import { NextRequest, NextResponse } from "next/server";
import { getPool, defaultDbKey } from "@/lib/db";

const QUERIES: Record<string, { label: string; sql: string }> = {
  ro_tables: {
    label: "Tables related to Request Offerings",
    sql: `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%ServiceReq%'
          OR TABLE_NAME LIKE '%Offering%'
          OR TABLE_NAME LIKE '%RequestOffer%'
          OR TABLE_NAME LIKE '%ReqTemplate%'
          OR TABLE_NAME LIKE '%Fulfillment%'
        )
      ORDER BY TABLE_NAME
    `,
  },
  attr_tables: {
    label: "Tables with Param / Attribute / Field / Answer in name",
    sql: `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%Param%'
          OR TABLE_NAME LIKE '%Attribute%'
          OR TABLE_NAME LIKE '%Field%'
          OR TABLE_NAME LIKE '%Answer%'
          OR TABLE_NAME LIKE '%Variable%'
          OR TABLE_NAME LIKE '%Property%'
        )
      ORDER BY TABLE_NAME
    `,
  },
  workflow_tables: {
    label: "Tables related to Workflows / Blocks",
    sql: `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%workflow%'
          OR TABLE_NAME LIKE '%frs_def%'
          OR TABLE_NAME LIKE '%block%'
          OR TABLE_NAME LIKE '%QuickAction%'
        )
      ORDER BY TABLE_NAME
    `,
  },
  srt_columns: {
    label: "Columns in ServiceReqTemplate",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceReqTemplate'
      ORDER BY ORDINAL_POSITION
    `,
  },
  srt_sample: {
    label: "Sample rows from ServiceReqTemplate (top 10)",
    sql: `
      SELECT TOP 10 *
      FROM ServiceReqTemplate WITH (NOLOCK)
      ORDER BY CreatedDateTime DESC
    `,
  },
  fulfillment_columns: {
    label: "Columns in ServiceReqFulfillmentPlan",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceReqFulfillmentPlan'
      ORDER BY ORDINAL_POSITION
    `,
  },
  fusionlink_rels: {
    label: "Distinct RelationshipNames in FusionLink touching ServiceReq",
    sql: `
      SELECT DISTINCT RelationshipName, COUNT(*) AS LinkCount
      FROM FusionLink WITH (NOLOCK)
      WHERE RelationshipName LIKE '%ServiceReq%'
         OR RelationshipName LIKE '%Offering%'
         OR RelationshipName LIKE '%Param%'
      GROUP BY RelationshipName
      ORDER BY LinkCount DESC
    `,
  },
  ro_param_tables: {
    label: "Tables that join to ServiceReqTemplate via foreign key pattern",
    sql: `
      SELECT DISTINCT c.TABLE_NAME, c.COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.COLUMN_NAME IN ('ServiceReqTemplateRecId','ServiceReqTemplateId','TemplateRecId','TemplateId')
        AND c.TABLE_NAME <> 'ServiceReqTemplate'
      ORDER BY c.TABLE_NAME
    `,
  },
  srt_param_columns: {
    label: "Columns in ServiceReqTemplateParam",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceReqTemplateParam'
      ORDER BY ORDINAL_POSITION
    `,
  },
  srt_param_sample: {
    label: "Sample rows from ServiceReqTemplateParam (top 20)",
    sql: `
      SELECT TOP 20 *
      FROM ServiceReqTemplateParam WITH (NOLOCK)
      ORDER BY CreatedDateTime DESC
    `,
  },
  srt_param_valid_columns: {
    label: "Columns in ServiceReqTemplateParamValid",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceReqTemplateParamValid'
      ORDER BY ORDINAL_POSITION
    `,
  },
  srt_definition_columns: {
    label: "Columns in ServiceReqTemplateDefinition",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ServiceReqTemplateDefinition'
      ORDER BY ORDINAL_POSITION
    `,
  },
  srt_param_by_template: {
    label: "RO names with param names & display types (top 50)",
    sql: `
      SELECT TOP 50
        srt.Name        AS OfferingName,
        srt.Status,
        p.Name          AS ParamName,
        p.DisplayName,
        p.DisplayType,
        p.SequenceNum,
        p.ReadOnly,
        p.RequiredExpression
      FROM ServiceReqTemplateParam p WITH (NOLOCK)
      JOIN ServiceReqTemplate srt WITH (NOLOCK) ON srt.RecId = p.ParentLink_RecID
      ORDER BY srt.Name, p.SequenceNum
    `,
  },
  srt_param_types: {
    label: "Distinct DisplayType values in ServiceReqTemplateParam",
    sql: `
      SELECT DisplayType, COUNT(*) AS Count
      FROM ServiceReqTemplateParam WITH (NOLOCK)
      GROUP BY DisplayType
      ORDER BY Count DESC
    `,
  },
  ro_with_blocktype: {
    label: "ROs with their workflow block types (top 50)",
    sql: `
      SELECT TOP 50
        srt.Name          AS OfferingName,
        srt.Status,
        fp.Name           AS FulfillmentPlanName,
        fp.WorkflowId,
        wt.Name           AS WorkflowName
      FROM ServiceReqTemplate srt WITH (NOLOCK)
      JOIN FusionLink fl WITH (NOLOCK)
        ON  fl.SourceID          = srt.RecId
        AND fl.RelationshipName  = 'ServiceReqTemplateAssociatedServiceReqFulfillmentP'
      JOIN ServiceReqFulfillmentPlan fp WITH (NOLOCK) ON fp.RecId = fl.TargetID
      JOIN frs_def_workflow_definition wf WITH (NOLOCK) ON UPPER(wf.RecID) = UPPER(fp.WorkflowId)
      JOIN frs_def_workflow_type wt WITH (NOLOCK) ON wt.RecID = wf.WorkflowTypeLink_RecID
      ORDER BY srt.Name
    `,
  },
  ro_params_full: {
    label: "ROs + params + workflow name (top 50)",
    sql: `
      SELECT TOP 50
        srt.Name          AS OfferingName,
        srt.Status,
        wt.Name           AS WorkflowName,
        p.SequenceNum,
        p.Name            AS ParamName,
        p.DisplayName,
        p.DisplayType,
        p.ReadOnly,
        p.RequiredExpression
      FROM ServiceReqTemplate srt WITH (NOLOCK)
      LEFT JOIN FusionLink fl WITH (NOLOCK)
        ON  fl.SourceID         = srt.RecId
        AND fl.RelationshipName = 'ServiceReqTemplateAssociatedServiceReqFulfillmentP'
      LEFT JOIN ServiceReqFulfillmentPlan fp WITH (NOLOCK) ON fp.RecId = fl.TargetID
      LEFT JOIN frs_def_workflow_definition wf WITH (NOLOCK) ON UPPER(wf.RecID) = UPPER(fp.WorkflowId)
      LEFT JOIN frs_def_workflow_type wt WITH (NOLOCK) ON wt.RecID = wf.WorkflowTypeLink_RecID
      LEFT JOIN ServiceReqTemplateParam p WITH (NOLOCK) ON p.ParentLink_RecID = srt.RecId
      ORDER BY srt.Name, p.SequenceNum
    `,
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get("q") ?? "ro_tables";
  const dbKey = searchParams.get("db") ?? defaultDbKey();

  const entry = QUERIES[queryKey];
  if (!entry) {
    return NextResponse.json({ error: `Unknown query key: ${queryKey}` }, { status: 400 });
  }

  try {
    const { pool, connect } = getPool(dbKey);
    await connect;
    const result = await pool.request().query(entry.sql);
    return NextResponse.json({ label: entry.label, rows: result.recordset, queries: Object.keys(QUERIES) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
