import type { ClientCompany, ClientContact, ClientNote, ClientSupportEntry } from '@/types';
import { formatDate } from '@/lib/utils';

function dash(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '________________';
  return String(value);
}

function money(value?: number): string {
  if (value == null || Number.isNaN(value)) return '______________';
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function billingLabel(value: ClientCompany['billingIncrement']): string {
  if (value === 'MONTHLY') return 'Monthly';
  if (value === 'QUARTERLY') return 'Quarterly';
  if (value === 'ANNUALLY') return 'Annually';
  return '__________________';
}

function phoneLine(value?: string): string {
  return value?.trim() ? value : '(___) ___-_____';
}

interface AdminClientSummaryProps {
  company: ClientCompany;
  contacts: ClientContact[];
  notes: ClientNote[];
  supportEntries: ClientSupportEntry[];
}

export function AdminClientSummary({
  company,
  contacts,
  notes,
  supportEntries,
}: AdminClientSummaryProps) {
  const main = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const others = contacts.filter((c) => !main || c.id !== main.id);
  const sortedNotes = [...notes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const sortedSupport = [...supportEntries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className="client-summary print:bg-white space-y-6 text-[var(--mismo-text)]">
      <div className="border border-[var(--color-border-200)] rounded-md p-6 space-y-4 bg-white">
        <h2 className="text-lg font-bold tracking-wide uppercase border-b border-[var(--color-border-200)] pb-2">
          Client Summary
        </h2>

        <div className="space-y-2 text-sm leading-relaxed">
          <p>
            <span className="font-semibold">Company Name:</span> {dash(company.companyName)}
          </p>
          <p>
            <span className="font-semibold">Address:</span> {dash(company.address1)}
          </p>
          {company.address2 ? <p className="pl-[4.5rem]">{company.address2}</p> : <p className="pl-[4.5rem]">____________________________</p>}
          <p>
            <span className="font-semibold">City:</span> {dash(company.city)}{' '}
            <span className="font-semibold ml-3">State:</span> {dash(company.state || '__')}{' '}
            <span className="font-semibold ml-3">Zip:</span> {dash(company.zip)}
          </p>
          <p>
            <span className="font-semibold">Main Phone:</span> {phoneLine(company.telephone)}{' '}
            <span className="font-semibold ml-3">Fax:</span> {phoneLine(company.fax)}{' '}
            <span className="font-semibold ml-3">Website:</span> {dash(company.website)}
          </p>
          <p>
            <span className="font-semibold">Toll Free:</span> {phoneLine(company.tollFree)}
          </p>
          <p>
            <span className="font-semibold">Sign Up Date:</span>{' '}
            {company.signupDate ? formatDate(company.signupDate) : '____________'}{' '}
            <span className="font-semibold ml-3">Go Live Date:</span>{' '}
            {company.activeDate ? formatDate(company.activeDate) : '____________'}
          </p>
          <p>
            <span className="font-semibold">Initial Set Up Fee:</span> {money(company.initialSetupAmount)}
          </p>
          <p>
            <span className="font-semibold">Monthly Maintenance/Support Fee:</span>{' '}
            {money(company.monthlySupportFee)}
          </p>
          <p>
            <span className="font-semibold">Price per employee:</span> {money(company.monthlyEmployeeRate)}
          </p>
          <p>
            <span className="font-semibold">Billing Increment:</span> {billingLabel(company.billingIncrement)}
          </p>
        </div>

        <div className="pt-2">
          <h3 className="font-bold text-sm uppercase mb-2">Special Requirements / Information</h3>
          <div className="border border-[var(--color-border-200)] rounded overflow-hidden">
            <div className="grid grid-cols-[6rem_1fr_8rem] gap-2 bg-[var(--color-surface-200)] px-3 py-2 text-xs font-semibold">
              <span>Date</span>
              <span>Note</span>
              <span>By</span>
            </div>
            {sortedNotes.length === 0 ? (
              <p className="px-3 py-3 text-sm text-[var(--mismo-text-secondary)]">No notes yet.</p>
            ) : (
              sortedNotes.map((n) => (
                <div
                  key={n.id}
                  className="grid grid-cols-[6rem_1fr_8rem] gap-2 px-3 py-2 text-sm border-t border-[var(--color-border-200)]"
                >
                  <span>{formatDate(n.createdAt)}</span>
                  <span className="whitespace-pre-wrap">{n.body}</span>
                  <span>{n.createdByName || '—'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <h3 className="font-bold text-sm uppercase">Main Contact</h3>
          {main ? (
            <div className="text-sm space-y-1">
              <p>
                <span className="font-semibold">{main.name}</span>
                {main.title ? `, ${main.title}` : ''}
              </p>
              <p>
                Off: {phoneLine(main.officePhone || main.phone)} Direct: {phoneLine(main.directPhone)} Extension:{' '}
                {main.extension || '___'}
              </p>
              <p>
                Cell: {phoneLine(main.cellPhone)} email: {main.email || '________________'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--mismo-text-secondary)]">No main contact set.</p>
          )}
        </div>

        <div className="pt-2 space-y-2">
          <h3 className="font-bold text-sm uppercase">Other Contacts</h3>
          <div className="border border-[var(--color-border-200)] rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-200)] text-left text-xs">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Dept.</th>
                  <th className="px-3 py-2">Off / Ext</th>
                  <th className="px-3 py-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {others.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-[var(--mismo-text-secondary)]">
                      No additional contacts.
                    </td>
                  </tr>
                ) : (
                  others.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--color-border-200)]">
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">{c.title || '—'}</td>
                      <td className="px-3 py-2">{c.department || '—'}</td>
                      <td className="px-3 py-2">
                        {phoneLine(c.officePhone || c.phone)}
                        {c.extension ? ` Ext: ${c.extension}` : ''}
                      </td>
                      <td className="px-3 py-2">{c.email || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-sm pt-2">
          <span className="font-semibold">JeStar Representative:</span> {dash(company.jestarAccountRep)}
        </p>
      </div>

      <div className="border border-[var(--color-border-200)] rounded-md p-6 space-y-3 bg-white print:break-before-page">
        <h2 className="text-lg font-bold tracking-wide uppercase border-b border-[var(--color-border-200)] pb-2">
          Customer Support History
        </h2>
        <p className="text-xs text-[var(--mismo-text-secondary)]">Page 2 of 2</p>
        {sortedSupport.length === 0 ? (
          <p className="text-sm text-[var(--mismo-text-secondary)]">No support history entries yet.</p>
        ) : (
          <div className="space-y-0 divide-y divide-[var(--color-border-200)] border border-[var(--color-border-200)] rounded">
            {sortedSupport.map((e) => (
              <div key={e.id} className="p-3 text-sm">
                <p className="text-xs text-[var(--mismo-text-secondary)] mb-1">
                  {formatDate(e.createdAt)} · {e.createdByName || '—'}
                </p>
                <p className="whitespace-pre-wrap">{e.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
