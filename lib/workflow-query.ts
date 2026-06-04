export function buildWorkflowQuery(wordCount: number): string {
  const nameFilter =
    wordCount === 0
      ? "1=1"
      : Array.from({ length: wordCount }, (_, i) => `wt.Name LIKE '%' + @wf${i} + '%'`).join(" AND ");

  return buildQuery(nameFilter);
}

function buildQuery(nameFilter: string): string {
  return `
DECLARE @BlockType    NVARCHAR(50)  = @bt;
DECLARE @TeamName     NVARCHAR(255) = @tn;
DECLARE @Status       NVARCHAR(50)  = @st;

IF OBJECT_ID('tempdb..#FilteredWorkflows')   IS NOT NULL DROP TABLE #FilteredWorkflows;
IF OBJECT_ID('tempdb..#AllBlocks')           IS NOT NULL DROP TABLE #AllBlocks;
IF OBJECT_ID('tempdb..#Blocks')              IS NOT NULL DROP TABLE #Blocks;
IF OBJECT_ID('tempdb..#QADefs')              IS NOT NULL DROP TABLE #QADefs;
IF OBJECT_ID('tempdb..#TaskBlocks')          IS NOT NULL DROP TABLE #TaskBlocks;
IF OBJECT_ID('tempdb..#ApprovalGroupLookup') IS NOT NULL DROP TABLE #ApprovalGroupLookup;
IF OBJECT_ID('tempdb..#ApprovalBlocks')      IS NOT NULL DROP TABLE #ApprovalBlocks;
IF OBJECT_ID('tempdb..#WorkflowOffering')    IS NOT NULL DROP TABLE #WorkflowOffering;

-- Filter pushed into the CTE so ROW_NUMBER() only runs over matching workflows.
;WITH LatestVersions AS (
    SELECT
        wf.RecID,
        wf.WorkflowTypeLink_RecID,
        wf.DefVersion,
        wf.Details,
        wt.Name AS WorkflowName,
        ROW_NUMBER() OVER (
            PARTITION BY wf.WorkflowTypeLink_RecID
            ORDER BY CAST(wf.DefVersion AS INT) DESC
        ) AS rn
    FROM frs_def_workflow_definition wf WITH (NOLOCK)
    JOIN frs_def_workflow_type wt WITH (NOLOCK)
        ON wf.WorkflowTypeLink_RecID = wt.RecID
    WHERE wt.Name LIKE '%form'
      AND wt.Name NOT LIKE '%backup%'
      AND (${nameFilter})
)
SELECT
    lv.WorkflowName,
    UPPER(lv.RecID)            AS WorkflowDefinitionRecID,
    lv.DefVersion,
    CAST(
        REPLACE(REPLACE(CAST(lv.Details AS nvarchar(max)),
            '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
            ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
    AS XML) AS XmlData
INTO #FilteredWorkflows
FROM LatestVersions lv
WHERE lv.rn = 1;

CREATE CLUSTERED INDEX IX_FW_RecID ON #FilteredWorkflows (WorkflowDefinitionRecID);

-- Single XML shred pass; BlockType computed once via CROSS APPLY to avoid
-- evaluating the same XPath twice in SELECT and WHERE.
SELECT
    fw.WorkflowName,
    fw.WorkflowDefinitionRecID,
    fw.DefVersion,
    LTRIM(RTRIM(b.block.value('(title)[1]', 'nvarchar(255)'))) AS BlockTitle,
    bt.BlockType,
    b.block.query('.')                                          AS BlockXml
INTO #AllBlocks
FROM #FilteredWorkflows fw
CROSS APPLY fw.XmlData.nodes('/scenario/blocks/block') b(block)
CROSS APPLY (VALUES (LTRIM(RTRIM(b.block.value('(type)[1]', 'nvarchar(50)'))))) bt(BlockType)
WHERE (@BlockType = '' OR bt.BlockType = @BlockType
    OR (@BlockType = 'vote0007' AND bt.BlockType = 'vote'));

CREATE CLUSTERED INDEX IX_AB_RecID    ON #AllBlocks (WorkflowDefinitionRecID);
CREATE NONCLUSTERED INDEX IX_AB_BlockType ON #AllBlocks (BlockType);

-- PATH 1: QuickAction-based blocks.
SELECT DISTINCT
    ab.WorkflowName,
    ab.WorkflowDefinitionRecID,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    TRY_CAST(
        q.qaprop.value('(groups/group/param[name="QAID"]/value)[1]', 'nvarchar(100)')
    AS uniqueidentifier) AS QAID
INTO #Blocks
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="QuickAction"]') q(qaprop);

CREATE CLUSTERED INDEX IX_Blocks_QAID  ON #Blocks (QAID);
CREATE NONCLUSTERED INDEX IX_Blocks_RecID ON #Blocks (WorkflowDefinitionRecID);

-- Pre-materialise QuickAction definitions cast from ntext to nvarchar(max) once
-- per unique QAID so the conversion is not repeated for each workflow row.
SELECT DISTINCT b.QAID, CONVERT(nvarchar(max), qa.Definition) AS def
INTO #QADefs
FROM #Blocks b
JOIN frs_def_quick_actions qa WITH (NOLOCK) ON qa.Id = b.QAID;

CREATE CLUSTERED INDEX IX_QD_QAID ON #QADefs (QAID);

-- PATH 2: Task blocks (teamblock property).
-- COALESCE over team/teamEx so either param is captured.
SELECT DISTINCT
    ab.WorkflowName,
    ab.WorkflowDefinitionRecID,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    tv.TeamName
INTO #TaskBlocks
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="teamblock"]/groups/group') g(grp)
CROSS APPLY (VALUES (
    LTRIM(RTRIM(COALESCE(
        NULLIF(g.grp.value('(param[name="team"]/value)[1]',   'nvarchar(255)'), ''),
        NULLIF(g.grp.value('(param[name="teamEx"]/value)[1]', 'nvarchar(255)'), '')
    )))
)) tv (TeamName)
WHERE tv.TeamName IS NOT NULL
  AND tv.TeamName <> ''
  AND tv.TeamName NOT LIKE '$(%'
  AND (@TeamName = '' OR tv.TeamName LIKE '%' + @TeamName + '%');

CREATE CLUSTERED INDEX IX_TaskBlocks_RecID ON #TaskBlocks (WorkflowDefinitionRecID);

-- Pre-materialise active Service Request Approval groups.
SELECT RecId, Name
INTO #ApprovalGroupLookup
FROM ContactGroup WITH (NOLOCK)
WHERE Status = 'Active'
  AND GroupType = 'Service Request Approval';

CREATE CLUSTERED INDEX IX_AGL_RecId ON #ApprovalGroupLookup (RecId);

-- PATH 3: Approval blocks (vote0007, vote).
SELECT DISTINCT
    ab.WorkflowName,
    ab.WorkflowDefinitionRecID,
    ab.DefVersion,
    ab.BlockTitle,
    ab.BlockType,
    cg.Name AS TeamName
INTO #ApprovalBlocks
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="approvers"]/groups/group') g(grp)
CROSS APPLY (VALUES (
    UPPER(LTRIM(RTRIM(g.grp.value('(param[name="contactgroup"]/value)[1]', 'nvarchar(50)'))))
)) av (ContactGroupId)
JOIN #ApprovalGroupLookup cg ON cg.RecId = av.ContactGroupId
WHERE ab.BlockType IN ('vote0007', 'vote')
  AND av.ContactGroupId <> ''
  AND (@TeamName = '' OR cg.Name LIKE '%' + @TeamName + '%');

CREATE CLUSTERED INDEX IX_ApprovalBlocks_RecID ON #ApprovalBlocks (WorkflowDefinitionRecID);

-- Scope WorkflowOffering to only workflows in #FilteredWorkflows to reduce size.
SELECT DISTINCT
    UPPER(fp.WorkflowId) AS WorkflowId,
    srt.Status
INTO #WorkflowOffering
FROM ServiceReqFulfillmentPlan fp WITH (NOLOCK)
JOIN FusionLink fl WITH (NOLOCK)
    ON  fl.TargetID         = fp.RecId
    AND fl.RelationshipName = 'ServiceReqTemplateAssociatedServiceReqFulfillmentP'
JOIN ServiceReqTemplate srt WITH (NOLOCK) ON srt.RecId = fl.SourceID
WHERE EXISTS (
    SELECT 1 FROM #FilteredWorkflows fw
    WHERE fw.WorkflowDefinitionRecID = UPPER(fp.WorkflowId)
);

CREATE CLUSTERED INDEX IX_WO_WorkflowId ON #WorkflowOffering (WorkflowId);

-- PATH 1 final SELECT: single combined CHARINDEX finds "OwnerTeam","ExpressionText":"
-- in one pass, eliminating the two-step search and the OwnerTeam_Valid false-match risk.
SELECT
    b.WorkflowName,
    b.DefVersion,
    ISNULL(wo.Status, 'No Offering') AS RequestOfferingStatus,
    b.BlockTitle,
    CASE WHEN b.BlockType = 'advancedtask' THEN 'advancedtask_qa' ELSE b.BlockType END AS BlockType,
    tn.TeamName
FROM #Blocks b
JOIN #QADefs qad ON qad.QAID = b.QAID
CROSS APPLY (VALUES (
    CHARINDEX('"FieldName":"OwnerTeam","ExpressionText":"', qad.def)
)) ownerPos (pos)
CROSS APPLY (VALUES (
    CASE WHEN ownerPos.pos > 0
         THEN LEFT(SUBSTRING(qad.def, ownerPos.pos + 42, 500),
                   CHARINDEX('"', SUBSTRING(qad.def, ownerPos.pos + 42, 500)) - 1)
    END
)) tn (TeamName)
LEFT JOIN #WorkflowOffering wo ON wo.WorkflowId = b.WorkflowDefinitionRecID
WHERE tn.TeamName IS NOT NULL
  AND tn.TeamName <> ''
  AND tn.TeamName NOT LIKE '$(%'
  AND (@TeamName = '' OR tn.TeamName LIKE '%' + @TeamName + '%')
  AND (@Status = '' OR ISNULL(wo.Status, 'No Offering') LIKE '%' + @Status + '%')

UNION ALL

SELECT
    tb.WorkflowName,
    tb.DefVersion,
    ISNULL(wo.Status, 'No Offering') AS RequestOfferingStatus,
    tb.BlockTitle,
    tb.BlockType,
    tb.TeamName
FROM #TaskBlocks tb
LEFT JOIN #WorkflowOffering wo ON wo.WorkflowId = tb.WorkflowDefinitionRecID
WHERE (@Status = '' OR ISNULL(wo.Status, 'No Offering') LIKE '%' + @Status + '%')

UNION ALL

SELECT
    ab.WorkflowName,
    ab.DefVersion,
    ISNULL(wo.Status, 'No Offering') AS RequestOfferingStatus,
    ab.BlockTitle,
    ab.BlockType,
    ab.TeamName
FROM #ApprovalBlocks ab
LEFT JOIN #WorkflowOffering wo ON wo.WorkflowId = ab.WorkflowDefinitionRecID
WHERE (@Status = '' OR ISNULL(wo.Status, 'No Offering') LIKE '%' + @Status + '%')

ORDER BY WorkflowName, BlockType, BlockTitle;

DROP TABLE #FilteredWorkflows;
DROP TABLE #AllBlocks;
DROP TABLE #Blocks;
DROP TABLE #QADefs;
DROP TABLE #TaskBlocks;
DROP TABLE #ApprovalGroupLookup;
DROP TABLE #ApprovalBlocks;
DROP TABLE #WorkflowOffering;
`;
}
