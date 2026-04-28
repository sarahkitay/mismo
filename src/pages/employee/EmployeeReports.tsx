import { useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ReportStatus } from '@/types';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import {
  formatRelativeTime,
  getStatusColor,
  getSeverityColor,
  getCategoryColor,
  getCategoryLabel,
  truncateText,
  isIncidentIntakeComplete,
} from '@/lib/utils';

interface EmployeeReportsProps {
  dataStore: DataStore;
  onNavigate: (page: string) => void;
}

const statusFilters: { value: ReportStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Reports' },
  { value: 'NEW', label: 'New' },
  { value: 'TRIAGED', label: 'Triaged' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'NEEDS_INFO', label: 'Needs Info' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export function EmployeeReports({ dataStore, onNavigate }: EmployeeReportsProps) {
  const { employeeReports } = dataStore;
  const [filter, setFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeState>(defaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);
  
  // Filter reports
  const filteredReports = employeeReports.filter(report => {
    const matchesStatus = filter === 'ALL' || report.status === filter;
    const matchesSearch = 
      searchQuery === '' ||
      report.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getCategoryLabel(report.category).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = inDateRange(report.createdAt, dateRange);
    
    return matchesStatus && matchesSearch && matchesDate;
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="reports-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">My Reports</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          View and track all your submitted reports
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Icons.search className="report-icon-shift absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[var(--mismo-blue)] focus:ring-2 focus:ring-[var(--mismo-blue-light)] outline-none transition-all"
          />
        </div>
        
        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {statusFilters.map((status) => (
            <button
              key={status.value}
              onClick={() => setFilter(status.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === status.value
                  ? 'bg-[var(--mismo-blue)] text-white'
                  : 'bg-white text-[var(--mismo-text-secondary)] hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>
      <DateRangeFilter value={dateRange} onChange={setDateRange} />
      
      {/* Reports List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="mismo-card">
            <CardContent className="p-6 text-sm text-[var(--mismo-text-secondary)]">Loading reports...</CardContent>
          </Card>
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="report-card mismo-card mismo-card-hover cursor-pointer"
              onClick={() => onNavigate(`report-detail/${report.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Severity Indicator */}
                  <div className={`w-1 h-full min-h-[60px] rounded-full flex-shrink-0 self-start -ml-2 -mt-1 ${
                    report.severity === 'CRITICAL' ? 'bg-red-500' :
                    report.severity === 'HIGH' ? 'bg-orange-500' :
                    report.severity === 'MEDIUM' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(report.category)}>
                        {getCategoryLabel(report.category)}
                      </Badge>
                      <Badge className={getSeverityColor(report.severity)}>
                        {report.severity}
                      </Badge>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                      {report.isAnonymous && (
                        <Badge variant="outline" className="text-gray-500">
                          <Icons.lock className="report-icon-shift h-3 w-3 mr-1" />
                          Anonymous
                        </Badge>
                      )}
                      {!isIncidentIntakeComplete(report) && (
                        <Badge
                          className="bg-amber-100 text-amber-900 border-amber-300 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`incident-intake/${report.id}`);
                          }}
                        >
                          Incident form needed
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-[var(--mismo-text)] text-lg">
                      {report.summary}
                    </h3>
                    <p className="text-[var(--mismo-text-secondary)] mt-1">
                      {truncateText(report.description, 150)}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--mismo-text-secondary)]">
                      <span className="flex items-center gap-1.5">
                        <Icons.calendar className="report-icon-shift h-4 w-4" />
                        Submitted {formatRelativeTime(report.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icons.clock className="report-icon-shift h-4 w-4" />
                        Updated {formatRelativeTime(report.updatedAt)}
                      </span>
                      {report.assignedTo && (
                        <span className="flex items-center gap-1.5 text-[var(--mismo-blue)]">
                          <Icons.user className="report-icon-shift h-4 w-4" />
                          Assigned
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <Icons.chevronRight className="report-icon-shift h-5 w-5 text-gray-400 flex-shrink-0 self-center" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="mismo-card">
            <CardContent className="p-12 text-center">
              <Icons.searchX className="report-icon-shift h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-2">
                No reports found
              </h3>
              <p className="text-[var(--mismo-text-secondary)] max-w-md mx-auto">
                {searchQuery 
                  ? "No reports match your search criteria. Try adjusting your filters."
                  : "You haven't submitted any reports yet. Use the prompts to report any issues."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
