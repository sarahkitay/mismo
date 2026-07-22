import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface AdminClientsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type StatusFilter = 'ALL' | 'active' | 'inactive';

function money(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function AdminClients({ dataStore, onNavigate }: AdminClientsProps) {
  const { clientCompanies, createClientCompany } = dataStore;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const overview = useMemo(() => {
    const active = clientCompanies.filter((c) => c.status === 'active');
    const inactive = clientCompanies.filter((c) => c.status !== 'active');
    const totalEmployees = clientCompanies.reduce((sum, c) => sum + (c.employeeCount ?? 0), 0);
    const activeEmployees = active.reduce((sum, c) => sum + (c.employeeCount ?? 0), 0);
    const monthlyRecurring = active.reduce(
      (sum, c) => sum + (c.monthlySupportFee ?? 0) + (c.monthlyEmployeeRate ?? 0) * (c.employeeCount ?? 0),
      0
    );
    return {
      total: clientCompanies.length,
      active: active.length,
      inactive: inactive.length,
      totalEmployees,
      activeEmployees,
      monthlyRecurring,
    };
  }, [clientCompanies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...clientCompanies]
      .filter((c) => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (!q) return true;
        return (
          c.companyName.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.jestarAccountRep.toLowerCase().includes(q) ||
          (c.clientLoginEmail ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [clientCompanies, search, statusFilter]);

  const handleAdd = () => {
    const result = createClientCompany({ companyName: 'New Company', country: 'USA' });
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('Client company created. Complete the profile and save.');
    onNavigate('client-detail', { id: result.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mismo-text-secondary)]">
            Mismo Internal
          </p>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)] mt-1">Client companies</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Create and oversee all companies. Open a company for profile, contacts, billing, and printable Client Summary.
          </p>
        </div>
        <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={handleAdd}>
          <Icons.add className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Companies</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{overview.total}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              {overview.active} active · {overview.inactive} inactive
            </p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Employees (roster)</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{overview.totalEmployees}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              {overview.activeEmployees} at active companies
            </p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Active accounts</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{overview.active}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">Go-live / billing ready</p>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-xs text-[var(--mismo-text-secondary)] uppercase tracking-wide">Est. monthly</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{money(overview.monthlyRecurring)}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">Support + per-employee fees</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Search companies, city, state, rep, or login email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="mismo-card">
          <CardContent className="p-8 text-center text-[var(--mismo-text-secondary)]">
            {clientCompanies.length === 0
              ? 'No client companies yet. Click Add Client to create one.'
              : 'No companies match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="border border-[var(--color-border-200)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-200)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Location</th>
                <th className="px-4 py-3 font-medium text-right">Employees</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Account rep</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Go live</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                  onClick={() => onNavigate('client-detail', { id: c.id })}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--mismo-text)]">{c.companyName}</p>
                    {c.clientLoginEmail ? (
                      <p className="text-xs text-[var(--mismo-text-secondary)] mt-0.5">{c.clientLoginEmail}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[var(--mismo-text-secondary)]">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {c.employeeCount != null ? c.employeeCount : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[var(--mismo-text-secondary)]">
                    {c.jestarAccountRep || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        c.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[var(--mismo-text-secondary)]">
                    {c.activeDate ? formatDate(c.activeDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
