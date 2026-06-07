export function buildBlockQuery(): string {
  return `
DECLARE @OfferingName NVARCHAR(255) = @on;
DECLARE @Status       NVARCHAR(50)  = @st;
DECLARE @BlockType    NVARCHAR(50)  = @bt;

IF OBJECT_ID('tempdb..#MatchingROs')  IS NOT NULL DROP TABLE #MatchingROs;
IF OBJECT_ID('tempdb..#Workflows')    IS NOT NULL DROP TABLE #Workflows;
IF OBJECT_ID('tempdb..#AllBlocks')    IS NOT NULL DROP TABLE #AllBlocks;
IF OBJECT_ID('tempdb..#QADefs')       IS NOT NULL DROP TABLE #QADefs;
IF OBJECT_ID('tempdb..#ApprovalLookup') IS NOT NULL DROP TABLE #ApprovalLookup;

SELECT
    srt.Name        AS OfferingName,
    srt.Status      AS OfferingStatus,
    fp.WorkflowId
INTO #MatchingROs
FROM ServiceReqTemplate srt WITH (NOLOCK)
OUTER APPLY (
    SELECT TOP 1 fp2.WorkflowId
    FROM FusionLink fl WITH (NOLOCK)
    JOIN ServiceReqFulfillmentPlan fp2 WITH (NOLOCK) ON fp2.RecId = fl.TargetID
    WHERE fl.SourceID         = srt.RecId
      AND fl.RelationshipName = 'ServiceReqTemplateAssociatedServiceReqFulfillmentP'
) fp
WHERE fp.WorkflowId IS NOT NULL
  AND (@OfferingName = '' OR srt.Name LIKE '%' + @OfferingName + '%')
  AND (@Status       = '' OR srt.Status = @Status);

SELECT
    mr.OfferingName,
    mr.OfferingStatus,
    wt.Name AS WorkflowName,
    CAST(
        REPLACE(REPLACE(CAST(wf.Details AS nvarchar(max)),
            '<?xml version=''1.0'' encoding=''utf-16le'' ?>', ''),
            ' xmlns=''http://frontrange.com/saas/workflow/Bpe_workflow.xsd''', '')
    AS XML) AS XmlData,
    ROW_NUMBER() OVER (
        PARTITION BY mr.OfferingName
        ORDER BY TRY_CAST(wf.DefVersion AS INT) DESC
    ) AS rn
INTO #Workflows
FROM #MatchingROs mr
JOIN frs_def_workflow_definition wf WITH (NOLOCK) ON UPPER(wf.RecID) = UPPER(mr.WorkflowId)
JOIN frs_def_workflow_type wt WITH (NOLOCK)        ON wt.RecID = wf.WorkflowTypeLink_RecID;

SELECT
    w.OfferingName,
    w.OfferingStatus,
    w.WorkflowName,
    LTRIM(RTRIM(b.block.value('(title)[1]', 'nvarchar(255)'))) AS BlockTitle,
    LTRIM(RTRIM(b.block.value('(type)[1]',  'nvarchar(50)')))  AS BlockType,
    b.block.query('.')                                          AS BlockXml
INTO #AllBlocks
FROM #Workflows w
CROSS APPLY w.XmlData.nodes('/scenario/blocks/block') b(block)
WHERE w.rn = 1
  AND (@BlockType = '' OR LTRIM(RTRIM(b.block.value('(type)[1]', 'nvarchar(50)'))) = @BlockType);

IF OBJECT_ID('tempdb..#QABlocks') IS NOT NULL DROP TABLE #QABlocks;
SELECT DISTINCT
    ab.OfferingName,
    ab.OfferingStatus,
    ab.WorkflowName,
    ab.BlockTitle,
    ab.BlockType,
    TRY_CAST(
        q.qaprop.value('(groups/group/param[name="QAID"]/value)[1]', 'nvarchar(100)')
    AS uniqueidentifier) AS QAID
INTO #QABlocks
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="QuickAction"]') q(qaprop);

SELECT DISTINCT qb.QAID, CONVERT(nvarchar(max), qa.Definition) AS Def
INTO #QADefs
FROM #QABlocks qb
JOIN frs_def_quick_actions qa WITH (NOLOCK) ON qa.Id = qb.QAID;

SELECT RecId, Name
INTO #ApprovalLookup
FROM ContactGroup WITH (NOLOCK)
WHERE Status = 'Active' AND GroupType = 'Service Request Approval';

SELECT
    qb.OfferingName,
    qb.OfferingStatus,
    qb.WorkflowName,
    qb.BlockTitle,
    CASE WHEN qb.BlockType = 'advancedtask' THEN 'advancedtask' ELSE qb.BlockType END AS BlockType,
    ISNULL(
        LEFT(
            SUBSTRING(qd.Def, cp.pos + 42, 500),
            CHARINDEX('"', SUBSTRING(qd.Def, cp.pos + 42, 500)) - 1
        ), ''
    ) AS TeamName,
    'QuickAction' AS AttributeSource
FROM #QABlocks qb
JOIN #QADefs qd ON qd.QAID = qb.QAID
CROSS APPLY (VALUES (CHARINDEX('"FieldName":"OwnerTeam","ExpressionText":"', qd.Def))) cp(pos)

UNION ALL

SELECT DISTINCT
    ab.OfferingName,
    ab.OfferingStatus,
    ab.WorkflowName,
    ab.BlockTitle,
    ab.BlockType,
    LTRIM(RTRIM(COALESCE(
        NULLIF(g.grp.value('(param[name="team"]/value)[1]',   'nvarchar(255)'), ''),
        NULLIF(g.grp.value('(param[name="teamEx"]/value)[1]', 'nvarchar(255)'), ''),
        ''
    ))) AS TeamName,
    'TeamBlock' AS AttributeSource
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="teamblock"]/groups/group') g(grp)

UNION ALL

SELECT DISTINCT
    ab.OfferingName,
    ab.OfferingStatus,
    ab.WorkflowName,
    ab.BlockTitle,
    ab.BlockType,
    ISNULL(cg.Name, '') AS TeamName,
    'ApprovalGroup' AS AttributeSource
FROM #AllBlocks ab
CROSS APPLY ab.BlockXml.nodes('block/blockProperties/property[name="approvers"]/groups/group') g(grp)
CROSS APPLY (VALUES (UPPER(LTRIM(RTRIM(g.grp.value('(param[name="contactgroup"]/value)[1]', 'nvarchar(50)')))))) av(ContactGroupId)
JOIN #ApprovalLookup cg ON cg.RecId = av.ContactGroupId
WHERE ab.BlockType IN ('vote0007', 'vote')

UNION ALL

SELECT DISTINCT
    ab.OfferingName,
    ab.OfferingStatus,
    ab.WorkflowName,
    ab.BlockTitle,
    ab.BlockType,
    '' AS TeamName,
    'None' AS AttributeSource
FROM #AllBlocks ab
WHERE NOT EXISTS (SELECT 1 FROM #QABlocks qb WHERE qb.OfferingName = ab.OfferingName AND qb.BlockTitle = ab.BlockTitle)
AND NOT EXISTS (
    SELECT 1 FROM #AllBlocks ab3
    CROSS APPLY ab3.BlockXml.nodes('block/blockProperties/property[name="teamblock"]') t(t)
    WHERE ab3.OfferingName = ab.OfferingName AND ab3.BlockTitle = ab.BlockTitle
)
AND ab.BlockType NOT IN ('vote0007', 'vote')

ORDER BY OfferingName, BlockType, BlockTitle;

DROP TABLE #MatchingROs;
DROP TABLE #Workflows;
DROP TABLE #AllBlocks;
DROP TABLE #QABlocks;
DROP TABLE #QADefs;
DROP TABLE #ApprovalLookup;
  `;
}
