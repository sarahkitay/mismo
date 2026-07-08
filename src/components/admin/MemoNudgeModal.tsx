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
import type { Policy, User } from '@/types';
import { buildMemoReminderContent } from '@/lib/memoReminder';

export interface MemoNudgePayload {
  channels: ('EMAIL' | 'SMS')[];
  subject: string;
  emailBody: string;
  smsBody: string;
}

interface MemoNudgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo: Policy;
  recipients: User[];
  enableEmail?: boolean;
  enableSms?: boolean;
  onSend: (payload: MemoNudgePayload) => void;
}

export function MemoNudgeModal({
  open,
  onOpenChange,
  memo,
  recipients,
  enableEmail = true,
  enableSms = true,
  onSend,
}: MemoNudgeModalProps) {
  const defaults = buildMemoReminderContent(memo);
  const [subject, setSubject] = useState(defaults.subject);
  const [emailBody, setEmailBody] = useState(defaults.emailBody);
  const [smsBody, setSmsBody] = useState(defaults.smsBody);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = buildMemoReminderContent(memo);
    setSubject(next.subject);
    setEmailBody(next.emailBody);
    setSmsBody(next.smsBody);
    setSendEmail(enableEmail);
    setSendSms(false);
    setShowPreview(false);
  }, [open, memo, enableEmail]);

  const channels: ('EMAIL' | 'SMS')[] = [
    ...(sendEmail && enableEmail ? (['EMAIL'] as const) : []),
    ...(sendSms && enableSms ? (['SMS'] as const) : []),
  ];

  const smsEligible = recipients.filter((r) => r.phone?.trim()).length;

  const handleSend = () => {
    if (channels.length === 0 || recipients.length === 0) return;
    onSend({ channels, subject, emailBody, smsBody });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send memo reminder</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[var(--color-text-secondary)]">
          This reminder goes only to employees who have <span className="font-medium">not acknowledged</span>{' '}
          <span className="font-medium text-[var(--mismo-text)]">{memo.title}</span>. You can edit the message below
          so employees understand why they are receiving it.
        </p>

        <p className="text-sm font-medium text-[var(--mismo-text)]">
          {recipients.length} employee{recipients.length === 1 ? '' : 's'} will receive this reminder
        </p>

        {showPreview ? (
          <div className="space-y-3 text-sm border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)]">
            <p>
              <span className="font-medium">Memo:</span> {memo.title}
            </p>
            <p>
              <span className="font-medium">Recipients:</span>{' '}
              {recipients.map((r) => `${r.firstName} ${r.lastName}`).join(', ')}
            </p>
            {sendEmail && enableEmail && (
              <div>
                <p className="font-medium">Email</p>
                <p>
                  <span className="text-[var(--color-text-secondary)]">Subject:</span> {subject}
                </p>
                <p className="whitespace-pre-wrap mt-1">{emailBody}</p>
              </div>
            )}
            {sendSms && enableSms && (
              <div>
                <p className="font-medium">SMS ({smsEligible} with phone on file)</p>
                <p className="whitespace-pre-wrap mt-1">{smsBody}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--mismo-text)]">Why they receive this:</span>{' '}
              {defaults.reason}
            </div>

            <div className="flex flex-wrap gap-4">
              {enableEmail && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                  Send email reminder
                </label>
              )}
              {enableSms && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sendSms} onChange={(e) => setSendSms(e.target.checked)} />
                  Send SMS reminder
                </label>
              )}
            </div>

            {sendEmail && enableEmail && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="memo-nudge-subject">Email subject</Label>
                  <Input id="memo-nudge-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memo-nudge-email">Email body</Label>
                  <Textarea id="memo-nudge-email" rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                </div>
              </>
            )}

            {sendSms && enableSms && (
              <div className="space-y-2">
                <Label htmlFor="memo-nudge-sms">SMS message</Label>
                <Textarea id="memo-nudge-sms" rows={3} value={smsBody} onChange={(e) => setSmsBody(e.target.value)} />
                {smsEligible < recipients.length && (
                  <p className="text-xs text-amber-800">
                    {recipients.length - smsEligible} recipient(s) have no phone number; SMS will skip them.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setShowPreview((p) => !p)}>
            {showPreview ? 'Edit' : 'Preview'}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={channels.length === 0 || recipients.length === 0 || (sendEmail && !emailBody.trim()) || (sendSms && !smsBody.trim())}
          >
            Send to {recipients.length} employee{recipients.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
