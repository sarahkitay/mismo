import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AdminPolicyDetailProps {
  dataStore: DataStore;
  policyId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminPolicyDetail({ dataStore, policyId, onNavigate }: AdminPolicyDetailProps) {
  const isNew = policyId === 'new';
  const existing = useMemo(() => dataStore.policies.find((p) => p.id === policyId), [dataStore.policies, policyId]);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'>(existing?.status ?? 'DRAFT');
  const [effectiveDate, setEffectiveDate] = useState((existing?.effectiveDate ?? new Date()).toISOString().slice(0, 10));

  const acknowledgements = dataStore.policyAcknowledgements.filter((ack) => ack.policyId === policyId);

  const save = () => {
    if (isNew) {
      dataStore.createPolicy({
        title,
        content,
        type: 'GENERAL',
        effectiveDate: new Date(effectiveDate),
        publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
        acknowledgmentRequired: true,
        tags: [],
        status,
      });
    } else if (existing) {
      dataStore.updatePolicy(existing.id, {
        title,
        content,
        effectiveDate: new Date(effectiveDate),
        status,
        publishedAt: status === 'PUBLISHED' ? existing.publishedAt ?? new Date() : undefined,
      });
    }
    onNavigate('policies');
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => onNavigate('policies')}>Back to Policies</Button>
      <Card className="mismo-card">
        <CardContent className="p-5 space-y-3">
          <h1 className="text-xl font-semibold">{isNew ? 'Create Policy' : 'Policy Detail'}</h1>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Policy title" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Policy content" />
          <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <div className="flex gap-2">
            {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((item) => (
              <button key={item} className={`interactive-control px-3 py-2 border text-sm ${status === item ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setStatus(item)}>{item}</button>
            ))}
          </div>
          <Button onClick={save}>Save Changes</Button>
        </CardContent>
      </Card>
      {!isNew && (
        <Card className="mismo-card">
          <CardContent className="p-5">
            <h2 className="font-semibold">Acknowledgements</h2>
            <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">{acknowledgements.length} employees acknowledged.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
