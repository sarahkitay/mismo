import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { downloadCsv } from '@/lib/exportCsv';
import { toast } from 'sonner';

export type ReportBuilderKind =
  | 'company'
  | 'employee'
  | 'investigation'
  | 'memo_ack'
  | 'prompt_response'
  | 'case_register';

interface ReportBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ReportBuilderKind;
  title?: string;
  /** Pre-filled filters from current page context */
  preset?: Record<string, string>;
  onExport?: (filters: Record<string, string>, format: 'CSV' | 'PDF') => void;
}

export function ReportBuilderDialog({
  open,
  onOpenChange,
  kind,
  title,
  preset = {},
  onExport,
}: ReportBuilderDialogProps) {
  const [employeeId, setEmployeeId] = useState(preset.employeeId ?? '');
  const [employeeName, setEmployeeName] = useState(preset.employeeName ?? '');
  const [department, setDepartment] = useState(preset.department ?? '');
  const [dateFrom, setDateFrom] = useState(preset.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(preset.dateTo ?? '');
  const [category, setCategory] = useState(preset.category ?? '');
  const [status, setStatus] = useState(preset.status ?? 'ALL');
  const [severity, setSeverity] = useState(preset.severity ?? 'ALL');

  const filters = {
    employeeId,
    employeeName,
    department,
    dateFrom,
    dateTo,
    category,
    status,
    severity,
    kind,
  };

  const runExport = (format: 'CSV' | 'PDF') => {
    if (onExport) {
      onExport(filters, format);
    } else {
      const headers = Object.keys(filters);
      downloadCsv(`mismo-${kind}-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, [
        headers.map((h) => filters[h as keyof typeof filters]),
      ]);
      toast.success(`${format} report generated (demo export with filter metadata).`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? 'Run report'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Export applies filters below. PDF export is structured for future backend integration; CSV downloads now.
        </p>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="rb-emp-id">Employee ID</Label>
            <Input id="rb-emp-id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-emp-name">Employee name</Label>
            <Input id="rb-emp-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-dept">Department / location</Label>
            <Input id="rb-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="rb-from">Date from</Label>
              <Input id="rb-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rb-to">Date to</Label>
              <Input id="rb-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="NEEDS_INFO">Needs info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rb-cat">Category</Label>
            <Input id="rb-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => runExport('PDF')}>
            Export PDF (stub)
          </Button>
          <Button type="button" onClick={() => runExport('CSV')}>
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
