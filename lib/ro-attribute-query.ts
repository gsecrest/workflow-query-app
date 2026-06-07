export function buildAttributeQuery(): string {
  return `
DECLARE @OfferingName NVARCHAR(255) = @on;
DECLARE @Status       NVARCHAR(50)  = @st;
DECLARE @FieldType    NVARCHAR(50)  = @ft;

SELECT
    srt.Name                                    AS OfferingName,
    srt.Status                                  AS OfferingStatus,
    ISNULL(wflow.WorkflowName, 'No Workflow')   AS WorkflowName,
    p.SequenceNum,
    p.Name                                      AS FieldName,
    p.DisplayName,
    p.DisplayType                               AS FieldType,
    CASE WHEN p.ReadOnly = 1 THEN 'Yes' ELSE 'No' END AS ReadOnly,
    CASE
        WHEN p.RequiredExpression IS NULL
          OR LTRIM(RTRIM(p.RequiredExpression)) = ''
          OR LTRIM(RTRIM(p.RequiredExpression)) = '$(false)' THEN 'No'
        WHEN LTRIM(RTRIM(p.RequiredExpression)) = '$(true)'  THEN 'Yes'
        ELSE 'Conditional'
    END                                         AS Required
FROM ServiceReqTemplate srt WITH (NOLOCK)
OUTER APPLY (
    SELECT TOP 1 fp.WorkflowId
    FROM FusionLink fl WITH (NOLOCK)
    JOIN ServiceReqFulfillmentPlan fp WITH (NOLOCK) ON fp.RecId = fl.TargetID
    WHERE fl.SourceID         = srt.RecId
      AND fl.RelationshipName = 'ServiceReqTemplateAssociatedServiceReqFulfillmentP'
) latest_fp
OUTER APPLY (
    SELECT TOP 1 wt.Name AS WorkflowName
    FROM frs_def_workflow_definition wf WITH (NOLOCK)
    JOIN frs_def_workflow_type wt WITH (NOLOCK) ON wt.RecID = wf.WorkflowTypeLink_RecID
    WHERE UPPER(wf.RecID) = UPPER(latest_fp.WorkflowId)
    ORDER BY TRY_CAST(wf.DefVersion AS INT) DESC
) wflow
JOIN ServiceReqTemplateParam p WITH (NOLOCK) ON p.ParentLink_RecID = srt.RecId
WHERE
    (@OfferingName = '' OR srt.Name LIKE '%' + @OfferingName + '%')
    AND (@Status   = '' OR srt.Status = @Status)
    AND (@FieldType = '' OR p.DisplayType = @FieldType)
ORDER BY srt.Name, p.SequenceNum;
  `;
}
