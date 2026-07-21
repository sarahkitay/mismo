import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ClientBillingIncrement, ClientCompany, ClientPaymentMode } from '@/types';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { AdminClientSummary } from '@/components/admin/AdminClientSummary';

interface AdminClientDetailProps {
  dataStore: DataStore;
  clientId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type ClientTab = 'SUMMARY' | 'PROFILE' | 'CONTACTS' | 'DOCUMENTS' | 'NOTES' | 'SUPPORT' | 'PAYMENTS';

function toDateInput(d: Date | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseOptionalDate(raw: string): Date | undefined {
  if (!raw.trim()) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseOptionalNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Label + control on one row for a denser, scannable form. */
function FieldRow({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-[minmax(9rem,11rem)_1fr] gap-x-3 gap-y-1 items-center ${className}`}>
      <Label className="text-sm text-[var(--mismo-text)] whitespace-nowrap">{label}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminClientDetail({ dataStore, clientId, onNavigate }: AdminClientDetailProps) {
  const {
    clientCompanies,
    clientContacts,
    clientDocuments,
    clientNotes,
    clientPayments,
    clientSupportEntries,
    updateClientCompany,
    addClientContact,
    updateClientContact,
    deleteClientContact,
    addClientDocument,
    deleteClientDocument,
    addClientNote,
    addClientPayment,
    addClientSupportEntry,
  } = dataStore;

  const client = clientCompanies.find((c) => c.id === clientId);
  const [tab, setTab] = useState<ClientTab>('SUMMARY');
  const [draft, setDraft] = useState<ClientCompany | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactDept, setContactDept] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactOffice, setContactOffice] = useState('');
  const [contactDirect, setContactDirect] = useState('');
  const [contactExt, setContactExt] = useState('');
  const [contactCell, setContactCell] = useState('');
  const [contactPrimary, setContactPrimary] = useState(false);

  const [docTitle, setDocTitle] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docNotes, setDocNotes] = useState('');

  const [noteBody, setNoteBody] = useState('');
  const [supportBody, setSupportBody] = useState('');

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('');
  const [payRef, setPayRef] = useState('');

  useEffect(() => {
    if (client) setDraft({ ...client });
  }, [client?.id, client?.updatedAt]);

  const contacts = useMemo(
    () => clientContacts.filter((c) => c.clientId === clientId).sort((a, b) => a.name.localeCompare(b.name)),
    [clientContacts, clientId]
  );
  const documents = useMemo(
    () =>
      clientDocuments
        .filter((d) => d.clientId === clientId)
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    [clientDocuments, clientId]
  );
  const notes = useMemo(
    () =>
      clientNotes
        .filter((n) => n.clientId === clientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [clientNotes, clientId]
  );
  const payments = useMemo(
    () =>
      clientPayments
        .filter((p) => p.clientId === clientId)
        .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
    [clientPayments, clientId]
  );
  const supportEntries = useMemo(
    () =>
      clientSupportEntries
        .filter((e) => e.clientId === clientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [clientSupportEntries, clientId]
  );

  if (!client || !draft) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => onNavigate('clients')}>
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
        <p className="text-[var(--mismo-text-secondary)]">Client company not found.</p>
      </div>
    );
  }

  const setField = <K extends keyof ClientCompany>(key: K, value: ClientCompany[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setProfileError(null);
  };

  const saveProfile = () => {
    if (!draft.companyName.trim()) {
      setProfileError('Company name is required.');
      return;
    }
    const result = updateClientCompany(clientId, {
      ...draft,
      companyName: draft.companyName.trim(),
      state: draft.state.trim().toUpperCase().slice(0, 2),
      country: draft.country.trim() || 'USA',
      status: draft.inactiveDate ? 'inactive' : draft.status,
    });
    if (!result) return;
    if ('error' in result) {
      setProfileError(result.error);
      return;
    }
    toast.success('Company information saved.');
  };

  const tabs: { id: ClientTab; label: string }[] = [
    { id: 'SUMMARY', label: 'Client Summary' },
    { id: 'PROFILE', label: 'Company Profile' },
    { id: 'CONTACTS', label: 'Contacts' },
    { id: 'DOCUMENTS', label: 'Documents' },
    { id: 'NOTES', label: 'Notes' },
    { id: 'SUPPORT', label: 'Support History' },
    { id: 'PAYMENTS', label: 'Payment History' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 print:hidden">
        <div>
          <Button variant="ghost" className="px-0 mb-1" onClick={() => onNavigate('clients')}>
            <Icons.arrowLeft className="h-4 w-4 mr-2" />
            Clients
          </Button>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)] truncate">{draft.companyName || 'Client'}</h1>
          <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
            Client Summary is the printable overview. Edit details in the other tabs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {tab === 'SUMMARY' && (
            <Button type="button" variant="outline" onClick={() => window.print()}>
              Print summary
            </Button>
          )}
          {tab === 'PROFILE' && (
            <Button type="button" className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={saveProfile}>
              <Icons.check className="h-4 w-4 mr-2" />
              Save company information
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-200)] pb-3 print:hidden">
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'SUMMARY' && (
        <AdminClientSummary
          company={draft}
          contacts={contacts}
          notes={notes}
          supportEntries={supportEntries}
        />
      )}

      {tab === 'PROFILE' && (
        <Card className="mismo-card">
          <CardContent className="p-6 space-y-5">
            {profileError && <p className="text-xs text-[var(--color-alert-600)]">{profileError}</p>}

            <FieldRow label="Company Name:">
              <Input
                value={draft.companyName}
                onChange={(e) => setField('companyName', e.target.value)}
                className="overflow-x-auto"
              />
            </FieldRow>
            <FieldRow label="Address 1:">
              <Input value={draft.address1} onChange={(e) => setField('address1', e.target.value)} />
            </FieldRow>
            <FieldRow label="Address 2:">
              <Input value={draft.address2} onChange={(e) => setField('address2', e.target.value)} />
            </FieldRow>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <FieldRow label="City:" className="sm:col-span-1">
                <Input value={draft.city} onChange={(e) => setField('city', e.target.value)} />
              </FieldRow>
              <FieldRow label="State:">
                <Input
                  value={draft.state}
                  maxLength={2}
                  placeholder="CA"
                  onChange={(e) => setField('state', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                  className="uppercase"
                />
              </FieldRow>
              <FieldRow label="Zip:">
                <Input value={draft.zip} onChange={(e) => setField('zip', e.target.value)} />
              </FieldRow>
              <FieldRow label="Country:">
                <Input
                  value={draft.country}
                  onChange={(e) => setField('country', e.target.value)}
                  placeholder="USA"
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldRow label="Telephone No.:">
                <Input value={draft.telephone} onChange={(e) => setField('telephone', e.target.value)} />
              </FieldRow>
              <FieldRow label="Fax No.:">
                <Input value={draft.fax} onChange={(e) => setField('fax', e.target.value)} />
              </FieldRow>
              <FieldRow label="Toll Free No.:">
                <Input value={draft.tollFree} onChange={(e) => setField('tollFree', e.target.value)} />
              </FieldRow>
              <FieldRow label="Website:">
                <Input value={draft.website} onChange={(e) => setField('website', e.target.value)} />
              </FieldRow>
              <FieldRow label="No. of Employees:">
                <Input
                  type="number"
                  min={0}
                  value={draft.employeeCount ?? ''}
                  onChange={(e) => setField('employeeCount', parseOptionalNumber(e.target.value))}
                />
              </FieldRow>
              <FieldRow label="No. of Offices:">
                <Input
                  type="number"
                  min={0}
                  value={draft.officeCount ?? ''}
                  onChange={(e) => setField('officeCount', parseOptionalNumber(e.target.value))}
                />
              </FieldRow>
            </div>

            <div className="border-t border-[var(--color-border-200)] pt-4 space-y-3">
              <FieldRow label="JeStar Account Rep.:">
                <Input
                  value={draft.jestarAccountRep}
                  onChange={(e) => setField('jestarAccountRep', e.target.value)}
                  placeholder="Add account rep"
                />
              </FieldRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="Signup Date:">
                  <Input
                    type="date"
                    value={toDateInput(draft.signupDate)}
                    onChange={(e) => setField('signupDate', parseOptionalDate(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Go Live Date:">
                  <Input
                    type="date"
                    value={toDateInput(draft.activeDate)}
                    onChange={(e) => setField('activeDate', parseOptionalDate(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Initial Setup Amt.: $">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.initialSetupAmount ?? ''}
                    onChange={(e) => setField('initialSetupAmount', parseOptionalNumber(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Date Paid:">
                  <Input
                    type="date"
                    value={toDateInput(draft.initialSetupPaidDate)}
                    onChange={(e) => setField('initialSetupPaidDate', parseOptionalDate(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Monthly Maintenance/Support Fee: $">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.monthlySupportFee ?? ''}
                    onChange={(e) => setField('monthlySupportFee', parseOptionalNumber(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Price per employee: $">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.monthlyEmployeeRate ?? ''}
                    onChange={(e) => setField('monthlyEmployeeRate', parseOptionalNumber(e.target.value))}
                  />
                </FieldRow>
                <FieldRow label="Billing Increment:">
                  <Select
                    value={draft.billingIncrement || 'NONE'}
                    onValueChange={(v) =>
                      setField('billingIncrement', (v === 'NONE' ? '' : v) as ClientBillingIncrement)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="ANNUALLY">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Payment Mode:">
                  <Select
                    value={draft.paymentMode || 'NONE'}
                    onValueChange={(v) =>
                      setField('paymentMode', (v === 'NONE' ? '' : v) as ClientPaymentMode)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      <SelectItem value="INVOICE">Invoice</SelectItem>
                      <SelectItem value="ACH">ACH</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="CHECK">Check</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </div>

            <div className="border-t border-[var(--color-border-200)] pt-4 space-y-3">
              <p className="text-sm font-medium text-[var(--mismo-text)]">
                Optional client login (no password restrictions)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="Client login email:">
                  <Input
                    type="email"
                    value={draft.clientLoginEmail ?? ''}
                    onChange={(e) => setField('clientLoginEmail', e.target.value || undefined)}
                  />
                </FieldRow>
                <FieldRow label="Client login password:">
                  <Input
                    type="text"
                    autoComplete="off"
                    value={draft.clientLoginPassword ?? ''}
                    onChange={(e) => setField('clientLoginPassword', e.target.value || undefined)}
                    placeholder="Any value; no complexity rules"
                  />
                </FieldRow>
              </div>
            </div>

            <div className="border-t border-[var(--color-border-200)] pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldRow label="Inactive Date:">
                  <Input
                    type="date"
                    value={toDateInput(draft.inactiveDate)}
                    onChange={(e) => {
                      const d = parseOptionalDate(e.target.value);
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              inactiveDate: d,
                              status: d ? 'inactive' : 'active',
                            }
                          : prev
                      );
                    }}
                  />
                </FieldRow>
                <FieldRow label="Reason:">
                  <Input
                    value={draft.inactiveReason}
                    onChange={(e) => setField('inactiveReason', e.target.value)}
                  />
                </FieldRow>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={saveProfile}>
                <Icons.check className="h-4 w-4 mr-2" />
                Save company information
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'CONTACTS' && (
        <Card className="mismo-card print:hidden">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Mark one contact as Main Contact for the Client Summary. Others appear under Other Contacts.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Dept.</Label>
                <Input value={contactDept} onChange={(e) => setContactDept(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Office</Label>
                <Input value={contactOffice} onChange={(e) => setContactOffice(e.target.value)} placeholder="(XXX) XXX-XXXX" />
              </div>
              <div className="space-y-1">
                <Label>Direct</Label>
                <Input value={contactDirect} onChange={(e) => setContactDirect(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Extension</Label>
                <Input value={contactExt} onChange={(e) => setContactExt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cell</Label>
                <Input value={contactCell} onChange={(e) => setContactCell(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contactPrimary || contacts.length === 0}
                onChange={(e) => setContactPrimary(e.target.checked)}
              />
              Set as Main Contact
            </label>
            <Button
              type="button"
              onClick={() => {
                if (!contactName.trim()) {
                  toast.error('Contact name is required.');
                  return;
                }
                const makePrimary = contactPrimary || contacts.length === 0;
                if (makePrimary) {
                  contacts.forEach((other) => {
                    if (other.isPrimary) updateClientContact(other.id, { isPrimary: false });
                  });
                }
                addClientContact(clientId, {
                  name: contactName.trim(),
                  title: contactTitle.trim(),
                  department: contactDept.trim(),
                  email: contactEmail.trim(),
                  phone: contactOffice.trim(),
                  officePhone: contactOffice.trim(),
                  directPhone: contactDirect.trim(),
                  extension: contactExt.trim(),
                  cellPhone: contactCell.trim(),
                  isPrimary: makePrimary,
                });
                setContactName('');
                setContactTitle('');
                setContactDept('');
                setContactEmail('');
                setContactOffice('');
                setContactDirect('');
                setContactExt('');
                setContactCell('');
                setContactPrimary(false);
                toast.success('Contact added.');
              }}
            >
              <Icons.add className="h-4 w-4 mr-2" />
              Add contact
            </Button>

            <ul className="divide-y divide-[var(--color-border-200)] border border-[var(--color-border-200)] rounded-md">
              {contacts.length === 0 && (
                <li className="p-4 text-sm text-[var(--mismo-text-secondary)]">No contacts yet.</li>
              )}
              {contacts.map((c) => (
                <li key={c.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                  <div>
                    <p className="font-medium">
                      {c.name}
                      {c.isPrimary ? (
                        <span className="ml-2 text-xs text-[var(--mismo-blue)]">Main Contact</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">
                      {[c.title, c.department, c.email, c.officePhone || c.phone, c.cellPhone]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!c.isPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          contacts.forEach((other) => {
                            if (other.isPrimary) updateClientContact(other.id, { isPrimary: false });
                          });
                          updateClientContact(c.id, { isPrimary: true });
                          toast.success('Main contact updated.');
                        }}
                      >
                        Make main
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => deleteClientContact(c.id)}>
                      <Icons.delete className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tab === 'DOCUMENTS' && (
        <Card className="mismo-card">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>File name</Label>
                <Input value={docFileName} onChange={(e) => setDocFileName(e.target.value)} placeholder="agreement.pdf" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notes</Label>
                <Input value={docNotes} onChange={(e) => setDocNotes(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                if (!docFileName.trim() && !docTitle.trim()) {
                  toast.error('Enter a title or file name.');
                  return;
                }
                addClientDocument(clientId, {
                  title: docTitle,
                  fileName: docFileName || docTitle,
                  notes: docNotes,
                });
                setDocTitle('');
                setDocFileName('');
                setDocNotes('');
                toast.success('Document recorded.');
              }}
            >
              <Icons.add className="h-4 w-4 mr-2" />
              Add document
            </Button>
            <ul className="divide-y divide-[var(--color-border-200)] border border-[var(--color-border-200)] rounded-md">
              {documents.length === 0 && (
                <li className="p-4 text-sm text-[var(--mismo-text-secondary)]">No documents yet.</li>
              )}
              {documents.map((d) => (
                <li key={d.id} className="p-3 flex justify-between gap-2 items-start">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">
                      {d.fileName} · {formatDate(d.uploadedAt)}
                    </p>
                    {d.notes ? <p className="text-sm mt-1">{d.notes}</p> : null}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => deleteClientDocument(d.id)}>
                    <Icons.delete className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tab === 'NOTES' && (
        <Card className="mismo-card">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Special Requirements / Information. Each note shows date and who entered it.
            </p>
            <Textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note…"
              rows={4}
            />
            <Button
              type="button"
              onClick={() => {
                const note = addClientNote(clientId, noteBody);
                if (!note) {
                  toast.error('Note cannot be empty.');
                  return;
                }
                setNoteBody('');
                toast.success('Note added.');
              }}
            >
              <Icons.add className="h-4 w-4 mr-2" />
              Add note
            </Button>
            <div className="space-y-0 border border-[var(--color-border-200)] rounded-md divide-y divide-[var(--color-border-200)]">
              {notes.length === 0 && (
                <p className="p-4 text-sm text-[var(--mismo-text-secondary)]">No notes yet.</p>
              )}
              {notes.map((n) => (
                <div key={n.id} className="p-4 space-y-1">
                  <p className="text-xs text-[var(--mismo-text-secondary)]">
                    {formatDate(n.createdAt)} · {n.createdByName || 'Unknown'}
                  </p>
                  <p className="text-sm text-[var(--mismo-text)] whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'SUPPORT' && (
        <Card className="mismo-card print:hidden">
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Customer Support History (page 2 of the Client Summary).
            </p>
            <Textarea
              value={supportBody}
              onChange={(e) => setSupportBody(e.target.value)}
              placeholder="Add a support history entry…"
              rows={4}
            />
            <Button
              type="button"
              onClick={() => {
                const entry = addClientSupportEntry(clientId, supportBody);
                if (!entry) {
                  toast.error('Entry cannot be empty.');
                  return;
                }
                setSupportBody('');
                toast.success('Support history entry added.');
              }}
            >
              <Icons.add className="h-4 w-4 mr-2" />
              Add support entry
            </Button>
            <div className="space-y-0 border border-[var(--color-border-200)] rounded-md divide-y divide-[var(--color-border-200)]">
              {supportEntries.length === 0 && (
                <p className="p-4 text-sm text-[var(--mismo-text-secondary)]">No support history yet.</p>
              )}
              {supportEntries.map((e) => (
                <div key={e.id} className="p-4 space-y-1">
                  <p className="text-xs text-[var(--mismo-text-secondary)]">
                    {formatDate(e.createdAt)} · {e.createdByName || 'Unknown'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{e.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'PAYMENTS' && (
        <Card className="mismo-card">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($)</Label>
                <Input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Date paid</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="ACH, check…" />
              </div>
              <div className="space-y-1">
                <Label>Reference</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                const amount = Number(payAmount);
                if (!Number.isFinite(amount) || amount < 0) {
                  toast.error('Enter a valid amount.');
                  return;
                }
                const paidAt = parseOptionalDate(payDate) ?? new Date();
                addClientPayment(clientId, {
                  amount,
                  paidAt,
                  method: payMethod,
                  reference: payRef,
                });
                setPayAmount('');
                setPayMethod('');
                setPayRef('');
                toast.success('Payment recorded.');
              }}
            >
              <Icons.add className="h-4 w-4 mr-2" />
              Add payment
            </Button>
            <ul className="divide-y divide-[var(--color-border-200)] border border-[var(--color-border-200)] rounded-md">
              {payments.length === 0 && (
                <li className="p-4 text-sm text-[var(--mismo-text-secondary)]">No payments recorded.</li>
              )}
              {payments.map((p) => (
                <li key={p.id} className="p-3 flex justify-between gap-2">
                  <div>
                    <p className="font-medium">${p.amount.toFixed(2)}</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">
                      {formatDate(p.paidAt)}
                      {p.method ? ` · ${p.method}` : ''}
                      {p.reference ? ` · Ref ${p.reference}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
