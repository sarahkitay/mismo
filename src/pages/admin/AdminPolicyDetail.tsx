import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Policy, PolicyBodySource } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { findRelatedMemos, formatDate, getMemoCategoryDisplay } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminPolicyDetailProps {
  dataStore: DataStore;
  policyId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const MEMO_CATEGORY_PRESETS = [
  'General',
  'Safety',
  'Conduct & ethics',
  'Legal',
  'HR',
  'Operations',
  'IT & security',
  'Payroll & benefits',
];

function inferPolicyType(category: string): Policy['type'] {
  const c = category.toLowerCase();
  if (c.includes('safety')) return 'SAFETY';
  if (c.includes('conduct') || c.includes('ethics')) return 'CONDUCT';
  if (c.includes('legal')) return 'LEGAL';
  return 'GENERAL';
}

export function AdminPolicyDetail({ dataStore, policyId, onNavigate }: AdminPolicyDetailProps) {
  const isNew = policyId === 'new';
  const existing = useMemo(() => dataStore.policies.find((p) => p.id === policyId), [dataStore.policies, policyId]);

  const [memoCategory, setMemoCategory] = useState('');
  const [memoCategoryCustom, setMemoCategoryCustom] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>('DRAFT');
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [completionDueDateStr, setCompletionDueDateStr] = useState('');
  const [acknowledgmentRequired, setAcknowledgmentRequired] = useState(true);
  const [bodySource, setBodySource] = useState<PolicyBodySource>('EDITOR');
  const [bodySourceUrl, setBodySourceUrl] = useState('');
  const [bodyAttachmentFileName, setBodyAttachmentFileName] = useState('');
  const [bodyAttachmentDataUrl, setBodyAttachmentDataUrl] = useState('');
  const [supersedeTargetId, setSupersedeTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setMemoCategory(MEMO_CATEGORY_PRESETS[0]);
      setMemoCategoryCustom('');
      setUseCustomCategory(false);
      setTitle('');
      setContent('');
      setStatus('DRAFT');
      setPublishDate(new Date().toISOString().slice(0, 10));
      setCompletionDueDateStr('');
      setAcknowledgmentRequired(true);
      setBodySource('EDITOR');
      setBodySourceUrl('');
      setBodyAttachmentFileName('');
      setBodyAttachmentDataUrl('');
      setSupersedeTargetId(null);
      return;
    }
    if (!existing) return;
    const displayCat = getMemoCategoryDisplay(existing);
    const presetHit = MEMO_CATEGORY_PRESETS.includes(displayCat);
    setUseCustomCategory(!presetHit);
    setMemoCategory(presetHit ? displayCat : MEMO_CATEGORY_PRESETS[0]);
    setMemoCategoryCustom(presetHit ? '' : displayCat);
    setTitle(existing.title);
    setContent(existing.content);
    setStatus(existing.status);
    setPublishDate(existing.effectiveDate.toISOString().slice(0, 10));
    setCompletionDueDateStr(
      existing.completionDueDate ? existing.completionDueDate.toISOString().slice(0, 10) : ''
    );
    setAcknowledgmentRequired(existing.acknowledgmentRequired);
    setBodySource(existing.bodySource ?? 'EDITOR');
    setBodySourceUrl(existing.bodySourceUrl ?? '');
    setBodyAttachmentFileName(existing.bodyAttachmentFileName ?? '');
    setBodyAttachmentDataUrl(existing.bodyAttachmentDataUrl ?? '');
    setSupersedeTargetId(null);
  }, [isNew, existing, policyId]);

  const resolvedCategory = (useCustomCategory ? memoCategoryCustom : memoCategory).trim();

  const related = useMemo(
    () => findRelatedMemos(title, resolvedCategory || memoCategory, dataStore.policies, existing?.id),
    [title, resolvedCategory, memoCategory, dataStore.policies, existing?.id]
  );

  const acknowledgements = dataStore.policyAcknowledgements.filter((ack) => ack.policyId === policyId);

  const importFromLink = async () => {
    const url = bodySourceUrl.trim();
    if (!url) {
      toast.error('Enter a URL first.');
      return;
    }
    try {
      const res = await fetch(url, { mode: 'cors' });
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok) throw new Error('bad status');
      if (ct.includes('text') || ct.includes('json')) {
        const text = await res.text();
        setContent(text.slice(0, 200_000));
        setBodySource('LINK');
        toast.success('Imported text from link.');
      } else {
        toast.info('Non-text response', {
          description: 'Save the URL as reference and paste or upload the memo body manually.',
        });
      }
    } catch {
      toast.error('Could not read URL (CORS or network). Paste the memo body below or use file upload.');
    }
  };

  const onBodyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_500_000) {
      toast.error('File must be under 2.5 MB in this demo.');
      return;
    }
    if (file.type.startsWith('text/') || file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = () => {
        setContent(String(reader.result ?? ''));
        setBodySource('UPLOAD');
        setBodyAttachmentFileName(file.name);
        setBodyAttachmentDataUrl('');
        toast.success('Text file loaded into memo body.');
      };
      reader.readAsText(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setBodyAttachmentDataUrl(dataUrl);
      setBodyAttachmentFileName(file.name);
      setBodySource('UPLOAD');
      setContent((prev) => prev || `[Attached file: ${file.name}]`);
      toast.success('File attached. Add any summary text in the body field if needed.');
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    const cat = resolvedCategory;
    if (!cat) {
      toast.error('Choose or enter a memo category.');
      return;
    }
    if (!title.trim()) {
      toast.error('Enter a memo title.');
      return;
    }
    const type = inferPolicyType(cat);
    const completionDueDate = completionDueDateStr ? new Date(completionDueDateStr) : undefined;
    const pub = new Date(publishDate);

    const base: Omit<Policy, 'id' | 'orgId' | 'createdAt' | 'updatedAt'> = {
      title: title.trim(),
      content: content.trim() || '(No body text)',
      type,
      effectiveDate: pub,
      publishedAt: status === 'PUBLISHED' ? (existing?.publishedAt ?? new Date()) : undefined,
      acknowledgmentRequired,
      tags: [],
      status,
      memoCategory: cat,
      completionDueDate,
      bodySource,
      bodyAttachmentFileName: bodyAttachmentFileName || undefined,
      bodyAttachmentDataUrl: bodyAttachmentDataUrl || undefined,
      bodySourceUrl: bodySource === 'LINK' && bodySourceUrl.trim() ? bodySourceUrl.trim() : undefined,
    };

    if (isNew) {
      const created = dataStore.createPolicy(base);
      if (supersedeTargetId) {
        dataStore.updatePolicy(supersedeTargetId, { supersededBy: created.id });
        toast.success('Memo published. Previous memo marked superseded.');
      } else {
        toast.success('Memo saved.');
      }
    } else if (existing) {
      dataStore.updatePolicy(existing.id, {
        ...base,
        publishedAt: status === 'PUBLISHED' ? existing.publishedAt ?? new Date() : undefined,
      });
      toast.success('Memo updated.');
    }
    onNavigate('policies');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" className="px-0" onClick={() => onNavigate('policies')}>
        Back to company memos
      </Button>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6 space-y-6">
          <h1 className="mismo-heading text-2xl text-[var(--color-primary-900)]">
            {isNew ? 'Add company memo' : 'Edit company memo'}
          </h1>

          <div className="space-y-2">
            <Label>Memo category</Label>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!useCustomCategory} onChange={() => setUseCustomCategory(false)} />
                Preset
              </label>
              {!useCustomCategory ? (
                <Select value={memoCategory} onValueChange={setMemoCategory}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMO_CATEGORY_PRESETS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="max-w-md"
                  placeholder="e.g. Facilities — winter 2025"
                  value={memoCategoryCustom}
                  onChange={(e) => setMemoCategoryCustom(e.target.value)}
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={useCustomCategory} onChange={() => setUseCustomCategory(true)} />
                Custom category
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo-title">Memo title</Label>
            <Input id="memo-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clear, specific title" />
          </div>

          {related.length > 0 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/90 p-4 space-y-2">
              <p className="text-sm font-medium text-[var(--mismo-text)]">Similar memos (same vein)</p>
              <p className="text-xs text-[var(--mismo-text-secondary)]">
                You may need to supersede an older version. Opening a memo lets you archive it; when publishing this one,
                you can link the memo it replaces.
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {related.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border border-[var(--color-border-200)] rounded-md px-3 py-2 bg-white">
                    <span className="text-[var(--mismo-text)]">
                      {p.title}{' '}
                      <span className="text-[var(--mismo-text-secondary)]">({getMemoCategoryDisplay(p)})</span>
                    </span>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onNavigate('policy-detail', { id: p.id })}>
                        Open
                      </Button>
                      {isNew && (
                        <Button
                          type="button"
                          size="sm"
                          variant={supersedeTargetId === p.id ? 'default' : 'secondary'}
                          onClick={() => setSupersedeTargetId((cur) => (cur === p.id ? null : p.id))}
                        >
                          {supersedeTargetId === p.id ? 'Will supersede ✓' : 'Supersedes this'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publish-date">Publish date</Label>
              <Input id="publish-date" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
              <p className="text-xs text-[var(--mismo-text-secondary)]">When this memo is considered live for staff.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">End / completion due date (optional)</Label>
              <Input
                id="due-date"
                type="date"
                value={completionDueDateStr}
                onChange={(e) => setCompletionDueDateStr(e.target.value)}
              />
              <p className="text-xs text-[var(--mismo-text-secondary)]">If something must be read or completed by a deadline.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Memo body</Label>
            <div className="flex flex-wrap gap-2">
              {(['EDITOR', 'UPLOAD', 'LINK'] as const).map((src) => (
                <Button
                  key={src}
                  type="button"
                  size="sm"
                  variant={bodySource === src ? 'default' : 'outline'}
                  onClick={() => setBodySource(src)}
                >
                  {src === 'EDITOR' ? 'Type in' : src === 'UPLOAD' ? 'Upload file' : 'From link'}
                </Button>
              ))}
            </div>

            {bodySource === 'LINK' && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="src-url">Source URL</Label>
                  <Input
                    id="src-url"
                    placeholder="https://…"
                    value={bodySourceUrl}
                    onChange={(e) => setBodySourceUrl(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => void importFromLink()}>
                  Try import text
                </Button>
              </div>
            )}

            {bodySource === 'UPLOAD' && (
              <div className="space-y-1">
                <Label htmlFor="body-file">Upload (.txt, .md, or PDF / images up to 2.5 MB)</Label>
                <Input id="body-file" type="file" accept="text/*,.md,.txt,application/pdf,image/jpeg,image/png" onChange={onBodyFile} />
                {bodyAttachmentFileName && (
                  <p className="text-xs text-[var(--mismo-text-secondary)]">
                    Last file: {bodyAttachmentFileName}
                    {bodyAttachmentDataUrl ? ' (binary attached)' : ''}
                  </p>
                )}
              </div>
            )}

            <Textarea
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Memo body — type here, paste imported text, or combine with an attachment."
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={acknowledgmentRequired} onChange={(e) => setAcknowledgmentRequired(e.target.checked)} />
            Require employee acknowledgement in the portal
          </label>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((item) => (
                <Button key={item} type="button" size="sm" variant={status === item ? 'default' : 'outline'} onClick={() => setStatus(item)}>
                  {item}
                </Button>
              ))}
            </div>
          </div>

          <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={save}>
            Save memo
          </Button>
        </CardContent>
      </Card>

      {!isNew && existing && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5 space-y-2">
            <h2 className="font-semibold text-[var(--mismo-text)]">Acknowledgements</h2>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              {acknowledgements.length} employees have acknowledged this memo as of {formatDate(new Date())}.
            </p>
            {existing.supersededBy && (
              <p className="text-xs text-amber-800">
                This memo was superseded by <code className="bg-[var(--color-surface-200)] px-1 rounded">{existing.supersededBy}</code>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
