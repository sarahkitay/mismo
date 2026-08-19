import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  ClientCompany,
  ClientContact,
  ClientDocument,
  ClientNote,
  ClientPayment,
  ClientSupportEntry,
  User,
} from '@/types';
import {
  persistClientCompany,
  persistClientContact,
  deleteClientContactRecord,
  persistClientDocument,
  deleteClientDocumentRecord,
  persistClientNote,
  persistClientPayment,
  persistClientSupportEntry,
} from '@/lib/supabase/clientCompanies';

export type ClientCrmDeps = {
  currentUser: User;
  effectiveOrgId: string;
  setClientCompanies: Dispatch<SetStateAction<ClientCompany[]>>;
  setClientContacts: Dispatch<SetStateAction<ClientContact[]>>;
  setClientDocuments: Dispatch<SetStateAction<ClientDocument[]>>;
  setClientNotes: Dispatch<SetStateAction<ClientNote[]>>;
  setClientPayments: Dispatch<SetStateAction<ClientPayment[]>>;
  setClientSupportEntries: Dispatch<SetStateAction<ClientSupportEntry[]>>;
};

export function useClientCrmActions(deps: ClientCrmDeps) {
  const {
    currentUser,
    effectiveOrgId,
    setClientCompanies,
    setClientContacts,
    setClientDocuments,
    setClientNotes,
    setClientPayments,
    setClientSupportEntries,
  } = deps;

  const emptyClientCompany = (overrides: Partial<ClientCompany> = {}): ClientCompany => {
    const now = new Date();
    return {
      id: `client-${Date.now()}`,
      managedByOrgId: effectiveOrgId,
      companyName: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
      telephone: '',
      fax: '',
      tollFree: '',
      website: '',
      jestarAccountRep: '',
      billingIncrement: '',
      paymentMode: '',
      inactiveReason: '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

 const createClientCompany = useCallback(
 (input: Partial<ClientCompany> = {}): ClientCompany | { error: string } => {
 const companyName = (input.companyName ?? '').trim();
 if (!companyName) return { error: 'Company name is required.' };
 const company = emptyClientCompany({
 ...input,
 companyName,
 country: input.country?.trim() || 'USA',
 state: (input.state ?? '').trim().toUpperCase().slice(0, 2),
 managedByOrgId: effectiveOrgId,
 });
 setClientCompanies((prev) => [company, ...prev]);
 void persistClientCompany(company);
 return company;
 },
 [effectiveOrgId]
 );

 const updateClientCompany = useCallback(
 (clientId: string, updates: Partial<ClientCompany>): ClientCompany | { error: string } | null => {
 if (updates.companyName !== undefined && !updates.companyName.trim()) {
 return { error: 'Company name is required.' };
 }
 let updated: ClientCompany | null = null;
 setClientCompanies((prev) =>
 prev.map((c) => {
 if (c.id !== clientId) return c;
 updated = {
 ...c,
 ...updates,
 companyName: updates.companyName !== undefined ? updates.companyName.trim() : c.companyName,
 state: updates.state !== undefined ? updates.state.trim().toUpperCase().slice(0, 2) : c.state,
 country: updates.country !== undefined ? updates.country.trim() || 'USA' : c.country,
 updatedAt: new Date(),
 };
 return updated;
 })
 );
 if (updated) void persistClientCompany(updated);
 return updated;
 },
 []
 );

 const addClientContact = useCallback(
 (clientId: string, input: Omit<ClientContact, 'id' | 'clientId' | 'createdAt' | 'updatedAt'>) => {
 const now = new Date();
 const office = input.officePhone || input.phone || '';
 const contact: ClientContact = {
 name: input.name,
 title: input.title ?? '',
 department: input.department ?? '',
 email: input.email ?? '',
 phone: office,
 officePhone: office,
 directPhone: input.directPhone ?? '',
 extension: input.extension ?? '',
 cellPhone: input.cellPhone ?? '',
 isPrimary: Boolean(input.isPrimary),
 id: `client-contact-${Date.now()}`,
 clientId,
 createdAt: now,
 updatedAt: now,
 };
 setClientContacts((prev) => [...prev, contact]);
 void persistClientContact(contact);
 return contact;
 },
 []
 );

 const updateClientContact = useCallback((contactId: string, updates: Partial<ClientContact>) => {
 let updated: ClientContact | null = null;
 setClientContacts((prev) =>
 prev.map((c) => {
 if (c.id !== contactId) return c;
 updated = { ...c, ...updates, updatedAt: new Date() };
 return updated;
 })
 );
 if (updated) void persistClientContact(updated);
 }, []);

 const deleteClientContact = useCallback((contactId: string) => {
 setClientContacts((prev) => prev.filter((c) => c.id !== contactId));
 void deleteClientContactRecord(contactId);
 }, []);

 const addClientDocument = useCallback(
 (clientId: string, input: { title: string; fileName: string; notes?: string }) => {
 const doc: ClientDocument = {
 id: `client-doc-${Date.now()}`,
 clientId,
 title: input.title.trim() || input.fileName,
 fileName: input.fileName,
 notes: input.notes ?? '',
 uploadedByUserId: currentUser.id,
 uploadedAt: new Date(),
 };
 setClientDocuments((prev) => [doc, ...prev]);
 void persistClientDocument(doc);
 return doc;
 },
 [currentUser.id]
 );

 const deleteClientDocument = useCallback((documentId: string) => {
 setClientDocuments((prev) => prev.filter((d) => d.id !== documentId));
 void deleteClientDocumentRecord(documentId);
 }, []);

 const addClientNote = useCallback(
 (clientId: string, body: string) => {
 const trimmed = body.trim();
 if (!trimmed) return null;
 const note: ClientNote = {
 id: `client-note-${Date.now()}`,
 clientId,
 body: trimmed,
 createdByUserId: currentUser.id,
 createdByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
 createdAt: new Date(),
 };
 setClientNotes((prev) => [note, ...prev]);
 void persistClientNote(note);
 return note;
 },
 [currentUser.id, currentUser.firstName, currentUser.lastName]
 );

 const addClientPayment = useCallback(
 (clientId: string, input: { amount: number; paidAt: Date; method: string; reference?: string; notes?: string }) => {
 const payment: ClientPayment = {
 id: `client-pay-${Date.now()}`,
 clientId,
 amount: input.amount,
 paidAt: input.paidAt,
 method: input.method,
 reference: input.reference ?? '',
 notes: input.notes ?? '',
 createdAt: new Date(),
 };
 setClientPayments((prev) => [payment, ...prev]);
 void persistClientPayment(payment);
 return payment;
 },
 []
 );

 const addClientSupportEntry = useCallback(
 (clientId: string, body: string) => {
 const trimmed = body.trim();
 if (!trimmed) return null;
 const entry: ClientSupportEntry = {
 id: `client-support-${Date.now()}`,
 clientId,
 body: trimmed,
 createdByUserId: currentUser.id,
 createdByName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
 createdAt: new Date(),
 };
 setClientSupportEntries((prev) => [entry, ...prev]);
 void persistClientSupportEntry(entry);
 return entry;
 },
 [currentUser.id, currentUser.firstName, currentUser.lastName]
 );


  return {
    createClientCompany,
    updateClientCompany,
    addClientContact,
    updateClientContact,
    deleteClientContact,
    addClientDocument,
    deleteClientDocument,
    addClientNote,
    addClientPayment,
    addClientSupportEntry,
  };
}
