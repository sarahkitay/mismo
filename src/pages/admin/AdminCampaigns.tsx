import { useEffect, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface AdminCampaignsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminCampaigns({ dataStore, onNavigate }: AdminCampaignsProps) {
  const { prompts, deliveries, sendNudge } = dataStore;
  
  // Active campaigns are prompts with ACTIVE status
  const activeCampaigns = prompts.filter(p => p.status === 'ACTIVE');
  const hasAnimatedRef = useRef(false);
  const [animatedStats, setAnimatedStats] = useState<Record<string, { total: number; completed: number; pending: number; completionRate: number }>>({});
  
  // Get campaign stats
  const getCampaignStats = (promptId: string) => {
    const campaignDeliveries = deliveries.filter(d => d.promptId === promptId);
    const total = campaignDeliveries.length;
    const completed = campaignDeliveries.filter(d => d.status === 'COMPLETED').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    return { total, completed, completionRate };
  };

  useEffect(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;
    const targetById = activeCampaigns.reduce<Record<string, { total: number; completed: number; pending: number; completionRate: number }>>(
      (acc, campaign) => {
        const stats = getCampaignStats(campaign.id);
        acc[campaign.id] = {
          total: stats.total,
          completed: stats.completed,
          pending: stats.total - stats.completed,
          completionRate: Math.round(stats.completionRate),
        };
        return acc;
      },
      {}
    );
    setAnimatedStats(
      Object.keys(targetById).reduce<Record<string, { total: number; completed: number; pending: number; completionRate: number }>>((acc, id) => {
        acc[id] = { total: 0, completed: 0, pending: 0, completionRate: 0 };
        return acc;
      }, {})
    );
    const start = performance.now();
    const durationMs = 850;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedStats(
        Object.keys(targetById).reduce<Record<string, { total: number; completed: number; pending: number; completionRate: number }>>((acc, id) => {
          const target = targetById[id];
          acc[id] = {
            total: Math.round(target.total * eased),
            completed: Math.round(target.completed * eased),
            pending: Math.round(target.pending * eased),
            completionRate: Math.round(target.completionRate * eased),
          };
          return acc;
        }, {})
      );
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [activeCampaigns, deliveries]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="campaigns-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Campaigns</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Monitor active compliance campaigns and their progress
          </p>
        </div>
        <Button 
          className="bg-[var(--mismo-blue)] hover:bg-blue-600"
          onClick={() => onNavigate('prompts')}
        >
          <Icons.add className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>
      
      {/* Campaigns List */}
      <div className="space-y-4">
        {activeCampaigns.length > 0 ? (
          activeCampaigns.map((campaign) => {
            const stats = getCampaignStats(campaign.id);
            const displayStats = animatedStats[campaign.id] ?? {
              total: stats.total,
              completed: stats.completed,
              pending: stats.total - stats.completed,
              completionRate: Math.round(stats.completionRate),
            };
            
            return (
              <Card key={campaign.id} className="campaign-card mismo-card">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-[var(--mismo-blue-light)] flex items-center justify-center flex-shrink-0">
                      <Icons.megaphone className="h-6 w-6 text-[var(--mismo-blue)]" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge className="status-chip status-chip--success">Running</Badge>
                        <Badge variant="outline">{campaign.type}</Badge>
                      </div>
                      
                      <h3 className="font-semibold text-[var(--mismo-text)] text-lg">
                        {campaign.title}
                      </h3>
                      <p className="text-[var(--mismo-text-secondary)] mt-1">
                        {campaign.description}
                      </p>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        <button type="button" className="p-3 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] text-left enterprise-interactive">
                          <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Recipients</p>
                          <p className="text-xl font-semibold text-[var(--color-text-primary)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">{displayStats.total}</p>
                        </button>
                        <button type="button" className="p-3 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] text-left enterprise-interactive">
                          <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Completed</p>
                          <p className="text-xl font-semibold text-[var(--color-text-primary)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">{displayStats.completed}</p>
                        </button>
                        <button type="button" className="p-3 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] text-left enterprise-interactive">
                          <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Pending</p>
                          <p className="text-xl font-semibold text-[var(--color-text-primary)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">{displayStats.pending}</p>
                        </button>
                        <button type="button" className="p-3 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] text-left enterprise-interactive">
                          <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Completion</p>
                          <p className="text-xl font-semibold text-[var(--color-text-primary)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">
                            {displayStats.completionRate}%
                          </p>
                        </button>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--mismo-blue)] rounded-full transition-all"
                            style={{ width: `${stats.completionRate}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Schedule */}
                      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-[var(--mismo-text-secondary)]">
                        <span className="flex items-center gap-1.5">
                          <Icons.calendar className="h-4 w-4" />
                          Started {formatDate(campaign.schedule.startAt)}
                        </span>
                        {campaign.schedule.endAt && (
                          <span className="flex items-center gap-1.5">
                            <Icons.clock className="h-4 w-4" />
                            Ends {formatDate(campaign.schedule.endAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => onNavigate('prompts', { filter: 'ACTIVE' })}>
                        <Icons.view className="h-4 w-4 mr-1.5" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pendingUserIds = deliveries
                            .filter((d) => d.promptId === campaign.id && d.status === 'PENDING')
                            .map((d) => d.userId);
                          pendingUserIds.forEach((userId) =>
                            sendNudge(userId, 'EMAIL', `Reminder: ${campaign.title} is waiting for your response.`, {
                              type: 'PROMPT_REMINDER',
                              promptId: campaign.id,
                            })
                          );
                          toast.success(`Sent reminders to ${pendingUserIds.length} employees.`);
                        }}
                      >
                        <Icons.send className="h-4 w-4 mr-1.5" />
                        Remind
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="mismo-card">
            <CardContent className="p-12 text-center">
              <Icons.megaphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-2">
                No active campaigns
              </h3>
              <p className="text-[var(--mismo-text-secondary)] mb-4">
                Create a new campaign to start collecting employee feedback
              </p>
              <Button 
                className="bg-[var(--mismo-blue)] hover:bg-blue-600"
                onClick={() => onNavigate('prompts')}
              >
                <Icons.add className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
