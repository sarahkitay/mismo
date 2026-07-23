import { useMemo } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface AdminClientPortfolioProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Mismo Internal analytics: client companies portfolio, not employee directory. */
export function AdminClientPortfolio({ dataStore, onNavigate }: AdminClientPortfolioProps) {
  const { clientCompanies } = dataStore;

  const stats = useMemo(() => {
    const active = clientCompanies.filter((c) => c.status === 'active');
    const inactive = clientCompanies.filter((c) => c.status !== 'active');
    const totalEmployees = clientCompanies.reduce((sum, c) => sum + (c.employeeCount ?? 0), 0);
    const activeEmployees = active.reduce((sum, c) => sum + (c.employeeCount ?? 0), 0);
    const monthlyRecurring = active.reduce(
      (sum, c) => sum + (c.monthlySupportFee ?? 0) + (c.monthlyEmployeeRate ?? 0) * (c.employeeCount ?? 0),
      0
    );
    const byState = [...clientCompanies].reduce<Record<string, number>>((acc, c) => {
      const key = (c.state || '-').toUpperCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    const topStates = Object.entries(byState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const largest = [...clientCompanies]
      .sort((a, b) => (b.employeeCount ?? 0) - (a.employeeCount ?? 0))
      .slice(0, 8);
    const recent = [...clientCompanies]
      .sort((a, b) => (b.activeDate?.getTime() ?? b.createdAt.getTime()) - (a.activeDate?.getTime() ?? a.createdAt.getTime()))
      .slice(0, 8);
    return {
      total: clientCompanies.length,
      active: active.length,
      inactive: inactive.length,
      totalEmployees,
      activeEmployees,
      monthlyRecurring,
      topStates,
      largest,
      recent,
    };
  }, [clientCompanies]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mismo-text-secondary)]">
            Mismo Internal
          </p>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)] mt-1">Portfolio analytics</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Overview of client companies, rostered employees, and estimated recurring fees.
          </p>
        </div>
        <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => onNavigate('clients')}>
          View all companies
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Companies</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats.total}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              {stats.active} active · {stats.inactive} inactive
            </p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Employees (roster)</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats.totalEmployees}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              {stats.activeEmployees} at active companies
            </p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Active accounts</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Est. monthly</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{money(stats.monthlyRecurring)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-[var(--mismo-text)]">Largest companies</h2>
            {stats.largest.length === 0 ? (
              <p className="text-sm text-[var(--mismo-text-secondary)]">No companies yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.largest.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left text-sm hover:text-[var(--mismo-blue)]"
                      onClick={() => onNavigate('client-detail', { id: c.id })}
                    >
                      <span className="font-medium">{c.companyName}</span>
                      <span className="text-[var(--mismo-text-secondary)] float-right tabular-nums">
                        {c.employeeCount != null ? c.employeeCount : '-'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mismo-card">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-[var(--mismo-text)]">By state</h2>
            {stats.topStates.length === 0 ? (
              <p className="text-sm text-[var(--mismo-text-secondary)]">No location data yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.topStates.map(([state, count]) => (
                  <li key={state} className="text-sm flex justify-between">
                    <span>{state}</span>
                    <span className="tabular-nums text-[var(--mismo-text-secondary)]">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mismo-card">
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold text-[var(--mismo-text)]">Recent go-lives</h2>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-[var(--mismo-text-secondary)]">No companies yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.recent.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left text-sm hover:text-[var(--mismo-blue)]"
                      onClick={() => onNavigate('client-detail', { id: c.id })}
                    >
                      <span className="font-medium">{c.companyName}</span>
                      <span className="block text-xs text-[var(--mismo-text-secondary)]">
                        {c.activeDate ? formatDate(c.activeDate) : 'No go-live date'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
