import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ActivityEventType } from '@/types';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

interface AdminActivityProps {
  dataStore: DataStore;
}

const activityTypeLabels: Record<ActivityEventType, { label: string; icon: keyof typeof Icons; color: string }> = {
  PROMPT_CREATED: { label: 'Prompt Created', icon: 'message', color: 'blue' },
  PROMPT_SENT: { label: 'Prompt Sent', icon: 'send', color: 'blue' },
  PROMPT_RESPONSE: { label: 'Prompt Response', icon: 'checkCircle', color: 'green' },
  REPORT_CREATED: { label: 'Report Created', icon: 'reports', color: 'red' },
  REPORT_ASSIGNED: { label: 'Report Assigned', icon: 'userPlus', color: 'purple' },
  REPORT_STATUS_CHANGED: { label: 'Status Changed', icon: 'refresh', color: 'amber' },
  INVESTIGATION_CREATED: { label: 'Investigation Created', icon: 'search', color: 'purple' },
  INVESTIGATION_UPDATED: { label: 'Investigation Updated', icon: 'search', color: 'purple' },
  NUDGE_SENT: { label: 'Reminder Sent', icon: 'bell', color: 'teal' },
  EXPORT_PDF: { label: 'Export PDF', icon: 'reports', color: 'amber' },
  EXPORT_CSV: { label: 'Export CSV', icon: 'reports', color: 'amber' },
};

export function AdminActivity({ dataStore }: AdminActivityProps) {
  const { activities, users } = dataStore;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ActivityEventType | 'ALL'>('ALL');
  
  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const matchesType = filter === 'ALL' || activity.type === filter;
    const matchesSearch = searchQuery === '' || 
      activity.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesType && matchesSearch;
  });
  
  // Group by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = new Date(activity.createdAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, typeof activities>);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="activity-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Activity Log</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Track all system activities and events
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Type Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ActivityEventType | 'ALL')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[var(--mismo-blue)] focus:ring-2 focus:ring-[var(--mismo-blue-light)] outline-none"
        >
          <option value="ALL">All Types</option>
          {Object.entries(activityTypeLabels).map(([type, { label }]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
      </div>
      
      {/* Activity List */}
      <Card className="mismo-card">
        <CardContent className="p-0">
          {Object.entries(groupedActivities).length > 0 ? (
            <div className="divide-y divide-gray-100">
              {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                <div key={date}>
                  <div className="px-5 py-3 bg-gray-50">
                    <p className="text-sm font-medium text-[var(--mismo-text-secondary)]">
                      {new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayActivities.map((activity) => {
                      const typeInfo = activityTypeLabels[activity.type];
                      const Icon = Icons[typeInfo.icon];
                      const actor = activity.actorUserId 
                        ? users.find(u => u.id === activity.actorUserId)
                        : null;
                      
                      return (
                        <div key={activity.id} className="activity-item flex items-start gap-4 p-5 hover:bg-gray-50 transition-colors">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            typeInfo.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                            typeInfo.color === 'green' ? 'bg-green-100 text-green-600' :
                            typeInfo.color === 'red' ? 'bg-red-100 text-red-600' :
                            typeInfo.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                            typeInfo.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                            typeInfo.color === 'teal' ? 'bg-teal-100 text-teal-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[var(--mismo-text)]">
                                {typeInfo.label}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {activity.type}
                              </Badge>
                            </div>
                            
                            {actor && (
                              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                                by {actor.firstName} {actor.lastName}
                              </p>
                            )}
                            
                            {/* Metadata */}
                            {Object.keys(activity.metadata).length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {Object.entries(activity.metadata).slice(0, 3).map(([key, value]) => (
                                  <span key={key} className="text-xs px-2 py-1 bg-gray-100 rounded text-[var(--mismo-text-secondary)]">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <span className="text-sm text-[var(--mismo-text-secondary)] flex-shrink-0">
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Icons.activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-2">
                No activities found
              </h3>
              <p className="text-[var(--mismo-text-secondary)]">
                Try adjusting your filters to see more results
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
