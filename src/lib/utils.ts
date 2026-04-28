import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Investigation, InvestigationWorkflowPhase, Policy, Report } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Employee app: list/detail title — prefer what they wrote in description; summary is HR-facing. */
export function employeeIncidentReportHeadline(report: Pick<Report, 'summary' | 'description'>): string {
  const d = report.description?.trim();
  if (d) return d.length > 96 ? `${d.slice(0, 93)}…` : d;
  const s = report.summary?.trim();
  if (s) return s.length > 96 ? `${s.slice(0, 93)}…` : s;
  return 'Incident report';
}

// Format date to relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(date);
}

// Format date
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

// Format date with time
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Format percentage
export function formatPercent(num: number, decimals = 0): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

// Format duration in hours to days/hours
export function formatDuration(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

// Get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Get status color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'status-chip status-chip--info',
    TRIAGED: 'status-chip status-chip--neutral',
    ASSIGNED: 'status-chip status-chip--info',
    IN_REVIEW: 'status-chip status-chip--warn',
    NEEDS_INFO: 'status-chip status-chip--warn',
    RESOLVED: 'status-chip status-chip--success',
    CLOSED: 'status-chip status-chip--neutral',
    OPEN: 'status-chip status-chip--warn',
    PENDING: 'status-chip status-chip--warn',
    COMPLETED: 'status-chip status-chip--success',
    EXPIRED: 'status-chip status-chip--alert',
    ACTIVE: 'status-chip status-chip--success',
    DRAFT: 'status-chip status-chip--neutral',
    SCHEDULED: 'status-chip status-chip--info',
    ARCHIVED: 'status-chip status-chip--neutral',
  };
  return colors[status] || 'status-chip status-chip--neutral';
}

// Get severity color
export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    LOW: 'status-chip status-chip--neutral',
    MEDIUM: 'status-chip status-chip--info',
    HIGH: 'status-chip status-chip--warn',
    CRITICAL: 'status-chip status-chip--alert',
  };
  return colors[severity] || 'status-chip status-chip--neutral';
}

// Get category color
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    HARASSMENT: 'status-chip status-chip--alert',
    THEFT: 'status-chip status-chip--warn',
    SAFETY: 'status-chip status-chip--warn',
    DISCRIMINATION: 'status-chip status-chip--info',
    WAGE_HOURS: 'status-chip status-chip--info',
    RETALIATION: 'status-chip status-chip--alert',
    OTHER: 'status-chip status-chip--neutral',
  };
  return colors[category] || 'status-chip status-chip--neutral';
}

// Get risk level color
export function getRiskLevelColor(riskLevel: string): string {
  const colors: Record<string, string> = {
    LOW: 'status-chip status-chip--success',
    MEDIUM: 'status-chip status-chip--warn',
    HIGH: 'status-chip status-chip--alert',
  };
  return colors[riskLevel] || 'status-chip status-chip--neutral';
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Generate unique ID
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Group array by key
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// Sort array by date
export function sortByDate<T extends { createdAt: Date }>(
  array: T[],
  order: 'asc' | 'desc' = 'desc'
): T[] {
  return [...array].sort((a, b) => {
    const diff = a.createdAt.getTime() - b.createdAt.getTime();
    return order === 'asc' ? diff : -diff;
  });
}

// Get category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    HARASSMENT: 'Harassment',
    THEFT: 'Theft',
    SAFETY: 'Safety',
    DISCRIMINATION: 'Discrimination',
    WAGE_HOURS: 'Wage & Hours',
    RETALIATION: 'Retaliation',
    OTHER: 'Other',
  };
  return labels[category] || category;
}

// Get prompt type label
export function getPromptTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INCIDENT: 'Incident Query',
    TEAM_DYNAMIC: 'Team Dynamic Check-In',
    MONTHLY_CHECKIN: 'Monthly Health Check',
    CUSTOM: 'Custom',
  };
  return labels[type] || type;
}

/** Extended portal intake is required and not yet submitted */
export function isIncidentIntakeComplete(report: Report): boolean {
  if (report.needsExtendedIncidentIntake === true) {
    return Boolean(report.incidentIntakeCompletedAt);
  }
  return true;
}

export type EffectiveInvestigationPhase = InvestigationWorkflowPhase | 'CLOSED';

export function getEffectiveInvestigationPhase(inv: Investigation): EffectiveInvestigationPhase {
  if (inv.status === 'CLOSED') return 'CLOSED';
  return inv.workflowPhase ?? 'IN_PROGRESS';
}

export function investigationWorkflowLabel(phase: EffectiveInvestigationPhase): string {
  const labels: Record<EffectiveInvestigationPhase, string> = {
    QUEUED: 'Queued',
    IN_PROGRESS: 'In progress',
    AWAITING_OUTCOME_ACK: 'Awaiting employee response',
    CLOSED: 'Closed',
  };
  return labels[phase];
}

const POLICY_TYPE_LABELS: Record<Policy['type'], string> = {
  GENERAL: 'General',
  SAFETY: 'Safety',
  CONDUCT: 'Conduct',
  LEGAL: 'Legal',
};

export function getMemoCategoryDisplay(policy: Policy): string {
  return policy.memoCategory?.trim() || POLICY_TYPE_LABELS[policy.type] || policy.type;
}

/** Suggest other memos that may be superseded (same vein): shared tokens in title or same display category */
export function findRelatedMemos(
  candidateTitle: string,
  candidateCategory: string,
  policies: Policy[],
  excludeId?: string
): Policy[] {
  const t = candidateTitle.trim().toLowerCase();
  const cat = candidateCategory.trim().toLowerCase();
  const tokens = t.split(/\W+/).filter((w) => w.length > 2);
  const scored = policies
    .filter((p) => p.id !== excludeId && p.status !== 'ARCHIVED')
    .map((p) => {
      const pt = p.title.toLowerCase();
      const pc = getMemoCategoryDisplay(p).toLowerCase();
      let score = 0;
      if (cat && pc === cat) score += 4;
      for (const w of tokens) {
        if (w.length > 2 && pt.includes(w)) score += 2;
      }
      if (t.length > 3 && pt.includes(t.slice(0, Math.min(12, t.length)))) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!cat && tokens.length === 0 && t.length < 3) return [];
  return scored.slice(0, 8).map((x) => x.p);
}
