/**
 * Industry-standard HR report handling checklist (8 sections).
 * Used to generate report.responseChecklist with sectionId, order, and evidence support.
 */
export interface IndustryChecklistSection {
  id: string;
  label: string;
  objective: string;
  items: string[];
}

export const INDUSTRY_CHECKLIST_SECTIONS: IndustryChecklistSection[] = [
  {
    id: '1',
    label: 'Intake & Initial Documentation',
    objective: 'Capture accurate information without bias or conclusions.',
    items: [
      'Record date and time of report',
      'Record reporting party (if not anonymous)',
      'Record how report was received (portal, email, in-person, hotline)',
      'Capture facts only (who, what, when, where)',
      'Do not include assumptions or interpretations',
      'Assign a case ID',
      'Confirm receipt to reporting party (if identified)',
      'Preserve confidentiality to the extent possible',
      'If immediate safety risk: Escalate to designated authority immediately and follow emergency protocol',
    ],
  },
  {
    id: '2',
    label: 'Initial Risk & Policy Review',
    objective: 'Determine procedural path.',
    items: [
      'Identify applicable company policy/policies',
      'Determine whether interim measures are required',
      'Assess urgency (safety, retaliation risk, legal exposure)',
      'Determine whether external counsel consultation is appropriate',
      'Document initial assessment',
    ],
  },
  {
    id: '3',
    label: 'Assign Investigator',
    objective: 'Ensure impartial review.',
    items: [
      'Assign neutral investigator',
      'Confirm no conflict of interest',
      'Define scope of investigation',
      'Set expected timeline',
      'Document assignment',
    ],
  },
  {
    id: '4',
    label: 'Investigation Process',
    objective: 'Gather relevant facts in structured manner.',
    items: [
      'Interview reporting party',
      'Interview accused party',
      'Identify and interview relevant witnesses',
      'Collect relevant documents, emails, logs',
      'Preserve digital evidence',
      'Maintain consistent questioning format',
      'Document each interview with date/time',
      'Allow each party to respond to allegations',
    ],
  },
  {
    id: '5',
    label: 'Analysis & Findings',
    objective: 'Evaluate facts against policy.',
    items: [
      'Review all collected information',
      'Compare facts to relevant policy language',
      'Determine whether policy violation occurred (based on evidence)',
      'Avoid speculation',
      'Document reasoning',
      'If inconclusive: Document that evidence was insufficient and note any additional monitoring steps',
    ],
  },
  {
    id: '6',
    label: 'Resolution & Action',
    objective: 'Apply consistent, policy-aligned response.',
    items: [
      'Determine corrective action (if applicable)',
      'Ensure proportionality and consistency',
      'Review for precedent consistency',
      'Document final decision',
      'Communicate outcome to appropriate parties',
      'Remind parties of non-retaliation policy',
    ],
  },
  {
    id: '7',
    label: 'Follow-Up',
    objective: 'Ensure issue remains resolved.',
    items: [
      'Schedule follow-up check-in',
      'Confirm no retaliation',
      'Confirm corrective action implemented',
      'Update case status',
    ],
  },
  {
    id: '8',
    label: 'Record Retention & Audit',
    objective: 'Maintain defensible documentation.',
    items: [
      'Store investigation report securely',
      'Log all actions in case timeline',
      'Retain documentation per retention policy',
      'Ensure audit log reflects all status changes',
      'Close case formally',
    ],
  },
];
