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
  bo_workflow_types: {
    label: "All distinct workflow type names (non-RO)",
    sql: `
      SELECT DISTINCT
        wt.Name                         AS WorkflowTypeName,
        COUNT(DISTINCT wf.RecID)        AS VersionCount,
        MAX(TRY_CAST(wf.DefVersion AS INT)) AS LatestVersion
      FROM frs_def_workflow_type wt WITH (NOLOCK)
      JOIN frs_def_workflow_definition wf WITH (NOLOCK)
        ON wf.WorkflowTypeLink_RecID = wt.RecID
      WHERE wt.Name NOT LIKE '%form'
        AND wt.Name NOT LIKE '%backup%'
      GROUP BY wt.Name
      ORDER BY wt.Name
    `,
  },
  bo_workflow_sample: {
    label: "Sample workflow type names — all patterns",
    sql: `
      SELECT TOP 50
        wt.Name                         AS WorkflowTypeName,
        COUNT(DISTINCT wf.RecID)        AS Versions
      FROM frs_def_workflow_type wt WITH (NOLOCK)
      JOIN frs_def_workflow_definition wf WITH (NOLOCK)
        ON wf.WorkflowTypeLink_RecID = wt.RecID
      GROUP BY wt.Name
      ORDER BY wt.Name
    `,
  },
  bo_block_types: {
    label: "Distinct block types across all non-RO workflows (top 30)",
    sql: `
      SELECT TOP 30
        bt.BlockType,
        COUNT(*) AS OccurrenceCount
      FROM (
        SELECT TOP 5000
          wt.Name AS WorkflowName,
          CAST(
            REPLACE(REPLACE(CAST(wf.Details AS nvarchar(max)),
              '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
              ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
          AS XML) AS XmlData
        FROM frs_def_workflow_type wt WITH (NOLOCK)
        JOIN frs_def_workflow_definition wf WITH (NOLOCK)
          ON wf.WorkflowTypeLink_RecID = wt.RecID
        WHERE wt.Name NOT LIKE '%form'
          AND wt.Name NOT LIKE '%backup%'
          AND TRY_CAST(wf.Details AS nvarchar(max)) IS NOT NULL
      ) w
      CROSS APPLY w.XmlData.nodes('/scenario/blocks/block') b(block)
      CROSS APPLY (VALUES (LTRIM(RTRIM(b.block.value('(type)[1]', 'nvarchar(50)'))))) bt(BlockType)
      WHERE bt.BlockType IS NOT NULL AND bt.BlockType <> ''
      GROUP BY bt.BlockType
      ORDER BY OccurrenceCount DESC
    `,
  },
  bo_workflow_link_tables: {
    label: "Tables that may link business objects to workflows",
    sql: `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%Workflow%'
          OR TABLE_NAME LIKE '%StatusWork%'
          OR TABLE_NAME LIKE '%WorkFlow%'
        )
        AND TABLE_NAME NOT LIKE '%frs_def_workflow%'
        AND TABLE_NAME NOT LIKE '%frs_ops_workflow%'
        AND TABLE_NAME NOT LIKE '%frs_data_workflow%'
        AND TABLE_NAME NOT LIKE '%backup%'
      ORDER BY TABLE_NAME
    `,
  },
  bo_status_workflow_columns: {
    label: "Columns in ChangeStatusWorkFlow (sample BO workflow link table)",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'ChangeStatusWorkFlow'
      ORDER BY ORDINAL_POSITION
    `,
  },
  bo_status_workflow_sample: {
    label: "Sample rows from ChangeStatusWorkFlow",
    sql: `
      SELECT TOP 10 * FROM ChangeStatusWorkFlow WITH (NOLOCK)
    `,
  },
  bo_workflow_type_columns: {
    label: "Columns in frs_def_workflow_type",
    sql: `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'frs_def_workflow_type'
      ORDER BY ORDINAL_POSITION
    `,
  },
  bo_metatype_link: {
    label: "frs_def_metatypes — business object definitions",
    sql: `
      SELECT TOP 20 *
      FROM frs_def_metatypes WITH (NOLOCK)
      ORDER BY Name
    `,
  },
  bo_workflow_type_sample: {
    label: "All columns in frs_def_workflow_type (top 20 non-form)",
    sql: `
      SELECT TOP 20 *
      FROM frs_def_workflow_type WITH (NOLOCK)
      WHERE Name NOT LIKE '%form'
        AND Name NOT LIKE '%backup%'
      ORDER BY Name
    `,
  },
  bo_sample_block_xml: {
    label: "Sample block XML from a BO workflow (Change Approval)",
    sql: `
      SELECT TOP 1
        wt.Name AS WorkflowName,
        wf.DefVersion,
        CAST(
          REPLACE(REPLACE(CAST(wf.Details AS nvarchar(max)),
            '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
            ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
        AS XML).query('/scenario/blocks/block[1]') AS FirstBlockXml
      FROM frs_def_workflow_type wt WITH (NOLOCK)
      JOIN frs_def_workflow_definition wf WITH (NOLOCK)
        ON wf.WorkflowTypeLink_RecID = wt.RecID
      WHERE wt.Name = 'Change Approval Workflow'
      ORDER BY TRY_CAST(wf.DefVersion AS INT) DESC
    `,
  },
  bo_object_types: {
    label: "Distinct ObjectType values in frs_def_workflow_type",
    sql: `
      SELECT
        ObjectType,
        COUNT(DISTINCT wt.RecId) AS WorkflowCount
      FROM frs_def_workflow_type wt WITH (NOLOCK)
      WHERE ObjectType IS NOT NULL AND ObjectType <> ''
      GROUP BY ObjectType
      ORDER BY WorkflowCount DESC
    `,
  },
  bo_block_types_detail: {
    label: "Block types with counts across all BO workflows",
    sql: `
      SELECT
        bt.BlockType,
        COUNT(*)        AS BlockCount,
        COUNT(DISTINCT w.WorkflowName) AS WorkflowCount
      FROM (
        SELECT TOP 3000
          wt.Name AS WorkflowName,
          CAST(
            REPLACE(REPLACE(CAST(wf.Details AS nvarchar(max)),
              '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
              ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
          AS XML) AS XmlData
        FROM frs_def_workflow_type wt WITH (NOLOCK)
        JOIN frs_def_workflow_definition wf WITH (NOLOCK)
          ON wf.WorkflowTypeLink_RecID = wt.RecID
        WHERE wt.Name NOT LIKE '%form'
          AND wt.Name NOT LIKE '%backup%'
      ) w
      CROSS APPLY w.XmlData.nodes('/scenario/blocks/block') b(block)
      CROSS APPLY (VALUES (LTRIM(RTRIM(b.block.value('(type)[1]', 'nvarchar(50)'))))) bt(BlockType)
      WHERE bt.BlockType IS NOT NULL AND bt.BlockType <> ''
      GROUP BY bt.BlockType
      ORDER BY BlockCount DESC
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
