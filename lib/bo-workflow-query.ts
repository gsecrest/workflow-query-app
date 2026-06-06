export function buildBoWorkflowQuery(): string {
  return `
DECLARE @ObjectType   NVARCHAR(100) = @ot;
DECLARE @WorkflowName NVARCHAR(255) = @wn;
DECLARE @BlockType    NVARCHAR(50)  = @bt;
DECLARE @TeamName     NVARCHAR(255) = @tn;

IF OBJECT_ID('tempdb..#BOWorkflows')     IS NOT NULL DROP TABLE #BOWorkflows;
IF OBJECT_ID('tempdb..#BOAllBlocks')     IS NOT NULL DROP TABLE #BOAllBlocks;
IF OBJECT_ID('tempdb..#BOQABlocks')      IS NOT NULL DROP TABLE #BOQABlocks;
IF OBJECT_ID('tempdb..#BOQADefs')        IS NOT NULL DROP TABLE #BOQADefs;
IF OBJECT_ID('tempdb..#BOApprovalLookup') IS NOT NULL DROP TABLE #BOApprovalLookup;

-- Latest version of each matching BO workflow (excludes ServiceReq = RO workflows)
;WITH LatestVersions AS (
    SELECT
        wf.RecID,
        wt.Name         AS WorkflowName,
        wt.ObjectType,
        wt.Description,
        wf.DefVersion,
        CAST(
            REPLACE(REPLACE(CAST(wf.Details AS nvarchar(max)),
                '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
                ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
        AS XML)         AS XmlData,
        ROW_NUMBER() OVER (
            PARTITION BY wf.WorkflowTypeLink_RecID
            ORDER BY TRY_CAST(wf.DefVersion AS INT) DESC
        ) AS rn
    FROM frs_def_workflow_definition wf WITH (NOLOCK)
    JOIN frs_def_workflow_type wt WITH (NOLOCK)
        ON wf.WorkflowTypeLink_RecID = wt.RecID
    WHERE wt.ObjectType <> 'ServiceReq'
      AND wt.Name NOT LIKE '%backup%'
      AND (@ObjectType   = '' OR wt.ObjectType = @ObjectType)
      AND (@WorkflowName = '' OR wt.Name LIKE '%' + @WorkflowName + '%')
)
SELECT RecID, WorkflowName, ObjectType, Description, DefVersion, XmlData
INTO #BOWorkflows
FROM LatestVersions
WHERE rn = 1;

CREATE CLUSTERED INDEX IX_BOW_RecID ON #BOWorkflows (RecID);

-- Shred all blocks from matching workflows
SELECT
    w.WorkflowName,
    w.ObjectType,
    w.Description,
    w.DefVersion,
    LTRIM(RTRIM(b.block.value('(title)[1]', 'nvarchar(255)'))) AS BlockTitle,
    LTRIM(RTRIM(b.block.value('(type)[1]',  'nvarchar(50)')))  AS BlockType,
    b.block.query('.')                                          AS BlockXml
INTO #BOAllBlocks
FROM #BOWorkflows w
CROSS APPLY w.XmlData.nodes('/scenario/blocks/block') b(block)
WHERE (@BlockType = '' OR LTRIM(RTRIM(b.block.value('(type)[1]', 'nvarchar(50)'))) = @BlockType);

CREATE CLUSTERED INDEX IX_BOAB_WF ON #BOAllBlocks (WorkflowName);
CREATE NONCLUSTERED INDEX IX_BOAB_BT ON #BOAllBlocks (BlockType);

-- QuickAction block IDs
SELECT DISTINCT
    ab.WorkflowName,
    ab.ObjectType,
    ab.Description,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    TRY_CAST(
        q.qaprop.value('(groups/group/param[name="QAID"]/value)[1]', 'nvarchar(100)')
    AS uniqueidentifier) AS QAID
INTO #BOQABlocks
FROM #BOAllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="QuickAction"]') q(qaprop);

-- Pre-materialise QuickAction definitions
SELECT DISTINCT qb.QAID, CONVERT(nvarchar(max), qa.Definition) AS Def
INTO #BOQADefs
FROM #BOQABlocks qb
JOIN frs_def_quick_actions qa WITH (NOLOCK) ON qa.Id = qb.QAID;

CREATE CLUSTERED INDEX IX_BOQD_QAID ON #BOQADefs (QAID);

-- Active approval groups
SELECT RecId, Name
INTO #BOApprovalLookup
FROM ContactGroup WITH (NOLOCK)
WHERE Status = 'Active' AND GroupType = 'Service Request Approval';

-- PATH 1: QuickAction / advancedtask blocks — OwnerTeam from JSON
SELECT
    qb.WorkflowName,
    qb.ObjectType,
    qb.Description,
    qb.DefVersion,
    qb.BlockTitle,
    CASE WHEN qb.BlockType = 'advancedtask' THEN 'advancedtask' ELSE qb.BlockType END AS BlockType,
    ISNULL(
        LEFT(
            SUBSTRING(qd.Def, cp.pos + 42, 500),
            CHARINDEX('"', SUBSTRING(qd.Def, cp.pos + 42, 500)) - 1
        ), ''
    ) AS TeamName,
    'QuickAction' AS AttributeSource
FROM #BOQABlocks qb
JOIN #BOQADefs qd ON qd.QAID = qb.QAID
CROSS APPLY (VALUES (CHARINDEX('"FieldName":"OwnerTeam","ExpressionText":"', qd.Def))) cp(pos)
WHERE (@TeamName = '' OR
    ISNULL(
        LEFT(SUBSTRING(qd.Def, cp.pos + 42, 500),
             CHARINDEX('"', SUBSTRING(qd.Def, cp.pos + 42, 500)) - 1), ''
    ) LIKE '%' + @TeamName + '%')

UNION ALL

-- PATH 2: Task blocks — team from teamblock property
SELECT DISTINCT
    ab.WorkflowName,
    ab.ObjectType,
    ab.Description,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    LTRIM(RTRIM(COALESCE(
        NULLIF(g.grp.value('(param[name="team"]/value)[1]',   'nvarchar(255)'), ''),
        NULLIF(g.grp.value('(param[name="teamEx"]/value)[1]', 'nvarchar(255)'), ''),
        ''
    ))) AS TeamName,
    'TeamBlock' AS AttributeSource
FROM #BOAllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="teamblock"]/groups/group') g(grp)
WHERE (@TeamName = '' OR
    LTRIM(RTRIM(COALESCE(
        NULLIF(g.grp.value('(param[name="team"]/value)[1]',   'nvarchar(255)'), ''),
        NULLIF(g.grp.value('(param[name="teamEx"]/value)[1]', 'nvarchar(255)'), ''),
        ''
    ))) LIKE '%' + @TeamName + '%')

UNION ALL

-- PATH 3: Approval blocks — contact group name
SELECT DISTINCT
    ab.WorkflowName,
    ab.ObjectType,
    ab.Description,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    ISNULL(cg.Name, '') AS TeamName,
    'ApprovalGroup' AS AttributeSource
FROM #BOAllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="approvers"]/groups/group') g(grp)
CROSS APPLY (VALUES (UPPER(LTRIM(RTRIM(g.grp.value('(param[name="contactgroup"]/value)[1]', 'nvarchar(50)')))))) av(ContactGroupId)
JOIN #BOApprovalLookup cg ON cg.RecId = av.ContactGroupId
WHERE ab.BlockType IN ('vote0007', 'vote')
  AND (@TeamName = '' OR cg.Name LIKE '%' + @TeamName + '%')

UNION ALL

-- PATH 4: All other blocks with no team assignment
SELECT DISTINCT
    ab.WorkflowName,
    ab.ObjectType,
    ab.Description,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    '' AS TeamName,
    'None' AS AttributeSource
FROM #BOAllBlocks ab
WHERE NOT EXISTS (SELECT 1 FROM #BOQABlocks qb WHERE qb.WorkflowName = ab.WorkflowName AND qb.BlockTitle = ab.BlockTitle)
  AND NOT EXISTS (
    SELECT 1 FROM #BOAllBlocks ab2
    CROSS APPLY ab2.BlockXml.nodes('block/blockProperties/property[name="teamblock"]') t(t)
    WHERE ab2.WorkflowName = ab.WorkflowName AND ab2.BlockTitle = ab.BlockTitle
  )
  AND ab.BlockType NOT IN ('vote0007', 'vote')
  AND (@TeamName = '')

ORDER BY WorkflowName, BlockType, BlockTitle;

DROP TABLE #BOWorkflows;
DROP TABLE #BOAllBlocks;
DROP TABLE #BOQABlocks;
DROP TABLE #BOQADefs;
DROP TABLE #BOApprovalLookup;
  `;
}
