import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface AdminClientsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminClients({ dataStore, onNavigate }: AdminClientsProps) {
  const { clientCompanies, createClientCompany } = dataStore;
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...clientCompanies]
      .filter((c) => {
        if (!q) return true;
        return (
          c.companyName.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.jestarAccountRep.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [clientCompanies, search]);

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
          <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Clients</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Company profiles, contacts, documents, notes, and payment history
          </p>
        </div>
        <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={handleAdd}>
          <Icons.add className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="relative max-w-md">
        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="Search by company, city, state, or account rep…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="mismo-card">
          <CardContent className="p-8 text-center text-[var(--mismo-text-secondary)]">
            No clients yet. Click Add Client to create a company profile.
          </CardContent>
        </Card>
      ) : (
        <div className="border border-[var(--color-border-200)] rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-200)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Company Name</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">City / State</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">JeStar Account Rep</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Active Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                  onClick={() => onNavigate('client-detail', { id: c.id })}
                >
                  <td className="px-4 py-3 font-medium text-[var(--mismo-text)]">{c.companyName}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-[var(--mismo-text-secondary)]">
                    {[c.city, c.state].filter(Boolean).join(', ') || '—'}
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
