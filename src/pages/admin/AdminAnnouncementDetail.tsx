import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AdminAnnouncementDetailProps {
  dataStore: DataStore;
  announcementId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminAnnouncementDetail({ dataStore, announcementId, onNavigate }: AdminAnnouncementDetailProps) {
  const isNew = announcementId === 'new';
  const existing = useMemo(
    () => dataStore.announcements.find((announcement) => announcement.id === announcementId),
    [announcementId, dataStore.announcements]
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [type, setType] = useState<'HOLIDAY' | 'GENERAL' | 'URGENT'>(existing?.type ?? 'GENERAL');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'SCHEDULED'>(existing?.status ?? 'DRAFT');
  const [publishAt, setPublishAt] = useState(existing?.publishAt ? existing.publishAt.toISOString().slice(0, 16) : '');

  const save = () => {
    if (isNew) {
      dataStore.createAnnouncement({
        title,
        body,
        audience: 'ALL',
        tags: [],
        type,
        status,
        viewsCount: existing?.viewsCount ?? 0,
        publishAt: status === 'SCHEDULED' && publishAt ? new Date(publishAt) : undefined,
        sentAt: status === 'PUBLISHED' ? new Date() : undefined,
      });
    } else if (existing) {
      dataStore.updateAnnouncement(existing.id, {
        title,
        body,
        type,
        status,
        viewsCount: existing.viewsCount ?? 0,
        publishAt: status === 'SCHEDULED' && publishAt ? new Date(publishAt) : undefined,
        sentAt: status === 'PUBLISHED' ? existing.sentAt ?? new Date() : undefined,
      });
    }
    onNavigate('announcements');
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => onNavigate('announcements')}>Back to Announcements</Button>
      <Card className="mismo-card">
        <CardContent className="p-5 space-y-3">
          <h1 className="text-xl font-semibold">{isNew ? 'Create Announcement' : 'Announcement Detail'}</h1>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Announcement body" />
          <div className="flex gap-2">
            {(['HOLIDAY', 'GENERAL', 'URGENT'] as const).map((value) => (
              <button key={value} className={`interactive-control px-3 py-2 border text-sm ${type === value ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setType(value)}>{value}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['DRAFT', 'PUBLISHED', 'SCHEDULED'] as const).map((value) => (
              <button key={value} className={`interactive-control px-3 py-2 border text-sm ${status === value ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setStatus(value)}>{value}</button>
            ))}
          </div>
          {status === 'SCHEDULED' && (
            <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          )}
          <Button onClick={save}>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
