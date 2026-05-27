import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ManualOutreachPayload {
  contactMethod: 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON';
  notes: string;
  outcome: string;
  followUpDate?: string;
  relatedItem?: string;
}

interface ManualOutreachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  relatedOptions?: { id: string; label: string }[];
  onSave: (payload: ManualOutreachPayload) => void;
}

export function ManualOutreachModal({
  open,
  onOpenChange,
  employeeName,
  relatedOptions = [],
  onSave,
}: ManualOutreachModalProps) {
  const [contactMethod, setContactMethod] = useState<ManualOutreachPayload['contactMethod']>('PHONE');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [relatedItem, setRelatedItem] = useState('');

  useEffect(() => {
    if (!open) return;
    setContactMethod('PHONE');
    setNotes('');
    setOutcome('');
    setFollowUpDate('');
    setRelatedItem('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log manual outreach — {employeeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contact method</Label>
            <Select value={contactMethod} onValueChange={(v) => setContactMethod(v as ManualOutreachPayload['contactMethod'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="PHONE">Phone call</SelectItem>
                <SelectItem value="IN_PERSON">In person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {relatedOptions.length > 0 && (
            <div className="space-y-2">
              <Label>Related item</Label>
              <Select value={relatedItem || '__none'} onValueChange={(v) => setRelatedItem(v === '__none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {relatedOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="manual-notes">Notes</Label>
            <Textarea id="manual-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-outcome">Outcome</Label>
            <Input id="manual-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Employee will respond by Friday" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-followup">Follow-up date</Label>
            <Input id="manual-followup" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave({
                contactMethod,
                notes,
                outcome,
                followUpDate: followUpDate || undefined,
                relatedItem: relatedItem || undefined,
              });
              onOpenChange(false);
            }}
            disabled={!notes.trim()}
          >
            Save outreach log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
