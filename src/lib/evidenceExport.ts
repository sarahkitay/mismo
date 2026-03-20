import type { Report, ReportStatusEvent, User } from '@/types';

interface EvidenceExportInput {
  report: Report;
  statusEvents: ReportStatusEvent[];
  reporter: User | null;
  assignee: User | null;
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCaseCsv(input: EvidenceExportInput) {
  const { report, statusEvents, reporter, assignee } = input;
  const rows: string[] = [];
  const pushRow = (key: string, value: string) => {
    rows.push(`"${key.replaceAll('"', '""')}","${value.replaceAll('"', '""')}"`);
  };

  pushRow('Case ID', report.id);
  pushRow('Summary', report.summary);
  pushRow('Category', report.category);
  pushRow('Severity', report.severity);
  pushRow('Status', report.status);
  pushRow('Reporter', reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Anonymous');
  pushRow('Assigned HR', assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned');
  pushRow('Created At', report.createdAt.toISOString());
  pushRow('Updated At', report.updatedAt.toISOString());
  pushRow('Response Plan', report.responsePlan ?? '');
  pushRow('Action Taken', report.responseActionTaken ?? '');
  pushRow('Employee Outcome', report.employeeResponseOutcome ?? '');
  pushRow('Gina Notes', report.ginaBuildNotes ?? '');

  (report.responseChecklist ?? []).forEach((item, idx) => {
    pushRow(`Checklist ${idx + 1}`, `${item.completed ? 'Completed' : 'Pending'} - ${item.label}`);
  });
  (report.handlingLedger ?? []).forEach((entry, idx) => {
    pushRow(`Handling Entry ${idx + 1}`, `${entry.type} | ${entry.createdAt.toISOString()} | ${entry.text}`);
  });
  (report.messages ?? []).forEach((message, idx) => {
    pushRow(`Message ${idx + 1}`, `${message.createdAt.toISOString()} | ${message.body}`);
  });
  statusEvents.forEach((event, idx) => {
    pushRow(`Status Event ${idx + 1}`, `${event.fromStatus} -> ${event.toStatus} | ${event.createdAt.toISOString()}`);
  });

  downloadBlob(`${report.id}-evidence.csv`, ['Field,Value', ...rows].join('\n'), 'text/csv;charset=utf-8;');
}

export function exportCasePdf(input: EvidenceExportInput) {
  const { report, statusEvents, reporter, assignee } = input;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1000,height=800');
  if (!popup) return;

  const checklistHtml = (report.responseChecklist ?? [])
    .map((item) => `<li>${item.completed ? '[x]' : '[ ]'} ${item.label}</li>`)
    .join('');
  const ledgerHtml = (report.handlingLedger ?? [])
    .map((entry) => `<li>${entry.createdAt.toLocaleString()} - <strong>${entry.type}</strong>: ${entry.text}</li>`)
    .join('');
  const statusHtml = statusEvents
    .map((event) => `<li>${event.createdAt.toLocaleString()} - ${event.fromStatus} -> ${event.toStatus}</li>`)
    .join('');
  const messageHtml = (report.messages ?? [])
    .map((msg) => `<li>${msg.createdAt.toLocaleString()} - ${msg.body}</li>`)
    .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${report.id} Evidence Package</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #0f1b2a; }
          h1, h2 { color: #1f3f68; margin-bottom: 8px; }
          .meta { margin-bottom: 18px; padding: 10px; border: 1px solid #d9e2ef; }
          ul { margin-top: 4px; }
          li { margin-bottom: 5px; }
          .label { font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Case Evidence Package</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <div class="meta">
          <p><span class="label">Case ID:</span> ${report.id}</p>
          <p><span class="label">Summary:</span> ${report.summary}</p>
          <p><span class="label">Status:</span> ${report.status}</p>
          <p><span class="label">Reporter:</span> ${reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Anonymous'}</p>
          <p><span class="label">Assigned HR:</span> ${assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}</p>
        </div>
        <h2>Planned Response</h2><p>${report.responsePlan ?? 'Not recorded'}</p>
        <h2>Action Taken</h2><p>${report.responseActionTaken ?? 'Not recorded'}</p>
        <h2>Employee Outcome</h2><p>${report.employeeResponseOutcome ?? 'Not recorded'}</p>
        <h2>Checklist</h2><ul>${checklistHtml || '<li>No checklist items</li>'}</ul>
        <h2>Handling Ledger</h2><ul>${ledgerHtml || '<li>No handling entries</li>'}</ul>
        <h2>Status Timeline</h2><ul>${statusHtml || '<li>No status events</li>'}</ul>
        <h2>Messages</h2><ul>${messageHtml || '<li>No messages</li>'}</ul>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}
