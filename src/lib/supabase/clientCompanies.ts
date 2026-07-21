import type {
  ClientCompany,
  ClientContact,
  ClientDocument,
  ClientNote,
  ClientPayment,
  ClientSupportEntry,
} from '@/types';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';
import { sanitizeInfraError } from '@/lib/infraMessaging';
import { toast } from 'sonner';

function enabled(): boolean {
  return isSupabaseAppConfigured();
}

function notify(entity: string, error: { message: string }): void {
  toast.error(`Could not save ${entity}. ${sanitizeInfraError(error.message)}`);
}

function iso(value: Date | undefined | null): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function dateOnly(value: Date | undefined | null): string | null {
  const s = iso(value);
  return s ? s.slice(0, 10) : null;
}

function d(v: string | null | undefined): Date {
  if (!v) return new Date();
  return new Date(v);
}

function optDate(v: string | null | undefined): Date | undefined {
  return v ? new Date(v) : undefined;
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function mapClientCompany(row: Record<string, unknown>): ClientCompany {
  return {
    id: String(row.id),
    managedByOrgId: String(row.managed_by_org_id),
    linkedOrgId: row.linked_org_id ? String(row.linked_org_id) : undefined,
    companyName: String(row.company_name ?? ''),
    address1: String(row.address1 ?? ''),
    address2: String(row.address2 ?? ''),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    zip: String(row.zip ?? ''),
    country: String(row.country ?? 'USA'),
    telephone: String(row.telephone ?? ''),
    fax: String(row.fax ?? ''),
    tollFree: String(row.toll_free ?? ''),
    website: String(row.website ?? ''),
    employeeCount: optNum(row.employee_count),
    officeCount: optNum(row.office_count),
    jestarAccountRep: String(row.jestar_account_rep ?? ''),
    signupDate: optDate(row.signup_date as string | null),
    activeDate: optDate(row.active_date as string | null),
    initialSetupAmount: optNum(row.initial_setup_amount),
    initialSetupPaidDate: optDate(row.initial_setup_paid_date as string | null),
    monthlySupportFee: optNum(row.monthly_support_fee),
    monthlyEmployeeRate: optNum(row.monthly_employee_rate),
    billingIncrement: (row.billing_increment as ClientCompany['billingIncrement']) ?? '',
    paymentMode: (row.payment_mode as ClientCompany['paymentMode']) ?? '',
    clientLoginEmail: row.client_login_email ? String(row.client_login_email) : undefined,
    clientLoginPassword: row.client_login_password ? String(row.client_login_password) : undefined,
    inactiveDate: optDate(row.inactive_date as string | null),
    inactiveReason: String(row.inactive_reason ?? ''),
    status: (row.status as ClientCompany['status']) ?? 'active',
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

export function mapClientContact(row: Record<string, unknown>): ClientContact {
  const phone = String(row.phone ?? '');
  const officePhone = String(row.office_phone ?? '') || phone;
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name ?? ''),
    title: String(row.title ?? ''),
    department: String(row.department ?? ''),
    email: String(row.email ?? ''),
    phone: officePhone || phone,
    officePhone,
    directPhone: String(row.direct_phone ?? ''),
    extension: String(row.extension ?? ''),
    cellPhone: String(row.cell_phone ?? ''),
    isPrimary: Boolean(row.is_primary),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

export function mapClientDocument(row: Record<string, unknown>): ClientDocument {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    title: String(row.title ?? ''),
    fileName: String(row.file_name ?? ''),
    notes: String(row.notes ?? ''),
    uploadedByUserId: row.uploaded_by_user_id ? String(row.uploaded_by_user_id) : undefined,
    uploadedAt: d(row.uploaded_at as string),
  };
}

export function mapClientNote(row: Record<string, unknown>): ClientNote {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    body: String(row.body ?? ''),
    createdByUserId: String(row.created_by_user_id ?? ''),
    createdByName: String(row.created_by_name ?? ''),
    createdAt: d(row.created_at as string),
  };
}

export function mapClientPayment(row: Record<string, unknown>): ClientPayment {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    amount: Number(row.amount ?? 0),
    paidAt: d(row.paid_at as string),
    method: String(row.method ?? ''),
    reference: String(row.reference ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: d(row.created_at as string),
  };
}

export function mapClientSupportEntry(row: Record<string, unknown>): ClientSupportEntry {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    body: String(row.body ?? ''),
    createdByUserId: String(row.created_by_user_id ?? ''),
    createdByName: String(row.created_by_name ?? ''),
    createdAt: d(row.created_at as string),
  };
}

function companyRow(c: ClientCompany): Record<string, unknown> {
  return {
    id: c.id,
    managed_by_org_id: c.managedByOrgId,
    linked_org_id: c.linkedOrgId ?? null,
    company_name: c.companyName,
    address1: c.address1,
    address2: c.address2,
    city: c.city,
    state: c.state,
    zip: c.zip,
    country: c.country || 'USA',
    telephone: c.telephone,
    fax: c.fax,
    toll_free: c.tollFree,
    website: c.website,
    employee_count: c.employeeCount ?? null,
    office_count: c.officeCount ?? null,
    jestar_account_rep: c.jestarAccountRep,
    signup_date: dateOnly(c.signupDate),
    active_date: dateOnly(c.activeDate),
    initial_setup_amount: c.initialSetupAmount ?? null,
    initial_setup_paid_date: dateOnly(c.initialSetupPaidDate),
    monthly_support_fee: c.monthlySupportFee ?? null,
    monthly_employee_rate: c.monthlyEmployeeRate ?? null,
    billing_increment: c.billingIncrement || '',
    payment_mode: c.paymentMode || '',
    client_login_email: c.clientLoginEmail ?? null,
    client_login_password: c.clientLoginPassword ?? null,
    inactive_date: dateOnly(c.inactiveDate),
    inactive_reason: c.inactiveReason,
    status: c.status,
    updated_at: iso(c.updatedAt) ?? new Date().toISOString(),
  };
}

export type ClientDataSnapshot = {
  companies: ClientCompany[];
  contacts: ClientContact[];
  documents: ClientDocument[];
  notes: ClientNote[];
  payments: ClientPayment[];
  supportEntries: ClientSupportEntry[];
};

export async function loadClientData(managedByOrgId: string): Promise<ClientDataSnapshot> {
  if (!enabled()) {
    return { companies: [], contacts: [], documents: [], notes: [], payments: [], supportEntries: [] };
  }
  const supabase = getSupabaseClient();
  const { data: companies, error } = await supabase
    .from('client_companies')
    .select('*')
    .eq('managed_by_org_id', managedByOrgId);
  if (error) throw new Error(error.message);

  const ids = (companies ?? []).map((c) => String(c.id));
  if (ids.length === 0) {
    return { companies: [], contacts: [], documents: [], notes: [], payments: [], supportEntries: [] };
  }

  const [contacts, documents, notes, payments, support] = await Promise.all([
    supabase.from('client_contacts').select('*').in('client_id', ids),
    supabase.from('client_documents').select('*').in('client_id', ids),
    supabase.from('client_notes').select('*').in('client_id', ids),
    supabase.from('client_payments').select('*').in('client_id', ids),
    supabase.from('client_support_entries').select('*').in('client_id', ids),
  ]);

  const firstErr =
    contacts.error || documents.error || notes.error || payments.error || support.error;
  if (firstErr) throw new Error(firstErr.message);

  return {
    companies: (companies ?? []).map((r) => mapClientCompany(r as Record<string, unknown>)),
    contacts: (contacts.data ?? []).map((r) => mapClientContact(r as Record<string, unknown>)),
    documents: (documents.data ?? []).map((r) => mapClientDocument(r as Record<string, unknown>)),
    notes: (notes.data ?? []).map((r) => mapClientNote(r as Record<string, unknown>)),
    payments: (payments.data ?? []).map((r) => mapClientPayment(r as Record<string, unknown>)),
    supportEntries: (support.data ?? []).map((r) => mapClientSupportEntry(r as Record<string, unknown>)),
  };
}

export async function persistClientCompany(company: ClientCompany): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_companies').upsert(companyRow(company), { onConflict: 'id' });
    if (error) notify('client company', error);
  } catch (err) {
    notify('client company', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistClientContact(contact: ClientContact): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const office = contact.officePhone || contact.phone;
    const { error } = await supabase.from('client_contacts').upsert(
      {
        id: contact.id,
        client_id: contact.clientId,
        name: contact.name,
        title: contact.title,
        department: contact.department ?? '',
        email: contact.email,
        phone: office,
        office_phone: office,
        direct_phone: contact.directPhone ?? '',
        extension: contact.extension ?? '',
        cell_phone: contact.cellPhone ?? '',
        is_primary: contact.isPrimary,
        updated_at: iso(contact.updatedAt) ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) notify('contact', error);
  } catch (err) {
    notify('contact', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function deleteClientContactRecord(id: string): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_contacts').delete().eq('id', id);
    if (error) notify('contact', error);
  } catch (err) {
    notify('contact', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistClientDocument(doc: ClientDocument): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_documents').upsert(
      {
        id: doc.id,
        client_id: doc.clientId,
        title: doc.title,
        file_name: doc.fileName,
        notes: doc.notes,
        uploaded_by_user_id: doc.uploadedByUserId ?? null,
        uploaded_at: iso(doc.uploadedAt) ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) notify('document', error);
  } catch (err) {
    notify('document', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function deleteClientDocumentRecord(id: string): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_documents').delete().eq('id', id);
    if (error) notify('document', error);
  } catch (err) {
    notify('document', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistClientNote(note: ClientNote): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_notes').upsert(
      {
        id: note.id,
        client_id: note.clientId,
        body: note.body,
        created_by_user_id: note.createdByUserId || null,
        created_by_name: note.createdByName,
        created_at: iso(note.createdAt) ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) notify('note', error);
  } catch (err) {
    notify('note', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistClientPayment(payment: ClientPayment): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_payments').upsert(
      {
        id: payment.id,
        client_id: payment.clientId,
        amount: payment.amount,
        paid_at: iso(payment.paidAt) ?? new Date().toISOString(),
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        created_at: iso(payment.createdAt) ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) notify('payment', error);
  } catch (err) {
    notify('payment', { message: err instanceof Error ? err.message : String(err) });
  }
}

export async function persistClientSupportEntry(entry: ClientSupportEntry): Promise<void> {
  if (!enabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('client_support_entries').upsert(
      {
        id: entry.id,
        client_id: entry.clientId,
        body: entry.body,
        created_by_user_id: entry.createdByUserId || null,
        created_by_name: entry.createdByName,
        created_at: iso(entry.createdAt) ?? new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) notify('support history', error);
  } catch (err) {
    notify('support history', { message: err instanceof Error ? err.message : String(err) });
  }
}
