import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AdminAnnouncementsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminAnnouncements({ dataStore, onNavigate }: AdminAnnouncementsProps) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<DateRangeState>(defaultDateRange);
  const [type, setType] = useState<'ALL' | 'HOLIDAY' | 'GENERAL' | 'URGENT'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'SCHEDULED'>('ALL');
  const [statsId, setStatsId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const statsItem = dataStore.announcements.find((a) => a.id === statsId) ?? null;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    return dataStore.announcements
      .filter((announcement) => {
        const searchable = `${announcement.title} ${announcement.body} ${announcement.tags.join(' ')} ${announcement.audience}`.toLowerCase();
        return searchable.includes(query.toLowerCase()) &&
          inDateRange(announcement.createdAt, range) &&
          (type === 'ALL' || announcement.type === type) &&
          (status === 'ALL' || announcement.status === status);
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [dataStore.announcements, query, range, status, type]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-[var(--mismo-text-secondary)]">Search announcements by title, body, tags, audience, and date.</p>
        </div>
        <Button onClick={() => onNavigate('announcement-detail', { id: 'new' })}>Create Announcement</Button>
      </div>
      <Input placeholder="Search title, body, tags, audience..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <DateRangeFilter value={range} onChange={setRange} />
      <div className="flex gap-2">
        {(['ALL', 'HOLIDAY', 'GENERAL', 'URGENT'] as const).map((item) => (
          <button key={item} className={`interactive-control px-3 py-2 border text-sm ${type === item ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setType(item)}>{item}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['ALL', 'DRAFT', 'PUBLISHED', 'SCHEDULED'] as const).map((item) => (
          <button key={item} className={`interactive-control px-3 py-2 border text-sm ${status === item ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setStatus(item)}>{item}</button>
        ))}
      </div>
      <Card className="mismo-card">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">Loading announcements...</p>
          ) : filtered.map((announcement) => (
            <div key={announcement.id} className="w-full border-b px-4 py-3 flex items-center justify-between gap-3">
              <button className="interactive-control text-left flex-1" onClick={() => onNavigate('announcement-detail', { id: announcement.id })}>
                <p className="font-medium">{announcement.title}</p>
                <p className="text-sm text-[var(--mismo-text-secondary)]">{announcement.type} · {announcement.status} · {formatDate(announcement.createdAt)}</p>
              </button>
              <Button variant="outline" size="sm" onClick={() => setStatsId(announcement.id)}>View Stats</Button>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No announcements found.</p>}
        </CardContent>
      </Card>
      <Dialog open={!!statsItem} onOpenChange={(open) => !open && setStatsId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Announcement Stats</DialogTitle>
          </DialogHeader>
          {statsItem && (
            <div className="space-y-2 text-sm">
              <p><strong>Title:</strong> {statsItem.title}</p>
              <p><strong>Views:</strong> {statsItem.viewsCount}</p>
              <p><strong>Status:</strong> {statsItem.status}</p>
              <p><strong>Audience:</strong> {statsItem.audience}</p>
              <p><strong>Sent At:</strong> {statsItem.sentAt ? statsItem.sentAt.toLocaleString() : 'Not sent'}</p>
              <p><strong>Publish At:</strong> {statsItem.publishAt ? statsItem.publishAt.toLocaleString() : 'N/A'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
