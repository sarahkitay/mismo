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

export interface OutreachReminderPayload {
  subject: string;
  body: string;
  reason: string;
  channels: ('EMAIL' | 'SMS')[];
  dueDate?: string;
  internalNote?: string;
}

interface OutreachReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  relatedLabel?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onSend: (payload: OutreachReminderPayload) => void;
}

export function OutreachReminderModal({
  open,
  onOpenChange,
  employeeName,
  relatedLabel,
  defaultSubject = 'HR reminder',
  defaultBody = 'Please complete your pending HR item at your earliest convenience.',
  onSend,
}: OutreachReminderModalProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [reason, setReason] = useState(relatedLabel ?? '');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setBody(defaultBody);
    setReason(relatedLabel ?? '');
    setSendEmail(true);
    setSendSms(false);
    setDueDate('');
    setInternalNote('');
    setShowPreview(false);
  }, [open, defaultSubject, defaultBody, relatedLabel]);

  const channels: ('EMAIL' | 'SMS')[] = [
    ...(sendEmail ? (['EMAIL'] as const) : []),
    ...(sendSms ? (['SMS'] as const) : []),
  ];

  const handleSend = () => {
    if (channels.length === 0) return;
    onSend({ subject, body, reason, channels, dueDate: dueDate || undefined, internalNote: internalNote || undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send reminder to {employeeName}</DialogTitle>
        </DialogHeader>
        {showPreview ? (
          <div className="space-y-3 text-sm border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)]">
            <p>
              <span className="font-medium">To:</span> {employeeName}
            </p>
            <p>
              <span className="font-medium">Subject:</span> {subject}
            </p>
            <p>
              <span className="font-medium">Channels:</span> {channels.join(', ') || 'None selected'}
            </p>
            <p className="whitespace-pre-wrap">{body}</p>
            {reason && (
              <p className="text-[var(--color-text-secondary)]">
                <span className="font-medium">Reason:</span> {reason}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="outreach-subject">Message subject</Label>
              <Input id="outreach-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-body">Message body</Label>
              <Textarea id="outreach-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-reason">Reason / context</Label>
              <Input
                id="outreach-reason"
                placeholder="e.g. Unanswered check-in, memo acknowledgement"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
                SMS
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-due">Optional follow-up due date</Label>
              <Input id="outreach-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outreach-internal">Internal note (not sent to employee)</Label>
              <Textarea id="outreach-internal" rows={2} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={channels.length === 0 || !body.trim()}>
            Send reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
