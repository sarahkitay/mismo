import { useState, useCallback, useEffect, useRef } from 'react';
import type {
 User,
 UserRole,
 Report,
 Prompt,
 PromptDelivery,
 PromptResponse,
 PromptAnswer,
 Investigation,
 Nudge,
 ActivityEvent,
 ReportStatusEvent,
 Policy,
 PolicyAcknowledgement,
 Announcement,
 Department,
 AuditLogEntry,
 NudgeContext,
 CompanyResource,
 EmergencyHotline,
 WageHourScreeningAcknowledgement,
 ClientCompany,
 ClientContact,
 ClientDocument,
 ClientNote,
 ClientPayment,
 ClientSupportEntry,
 LawDigestEntry,
 AppNotification,
} from '@/types';
import {
  computeOpenInvestigationWorkload,
  computePromptResponsesNavCount,
  openCaseRegisterReports,
} from '@/lib/investigationWorkload';
import {
 DEFAULT_ORG_ID,
 DEFAULT_ORG_NAME,
 DEFAULT_ORG_SETTINGS,
 isSupabaseAppConfigured,
} from '@/data/orgDefaults';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { loadOrgDataFromSupabase } from '@/lib/supabase/loadOrgData';
import { resolveAppSessionFromAuth } from '@/lib/supabase/resolveAppSession';
import {
 persistUsers,
 persistUserUpdate,
 persistPrompt,
 persistPromptUpdate,
 persistPromptResponse,
 persistPromptDelivery,
 persistPolicy,
 persistPolicyAck,
 persistDepartment,
 deleteDepartmentRecord,
 persistOrgSettings,
} from '@/lib/supabase/writeOrgData';
import { sendNotificationEmail, runPromptReminders } from '@/lib/api/notifications';
import { employeeNeedsPolicyAck } from '@/lib/lawDigestMemo';
import { loadClientData } from '@/lib/supabase/clientCompanies';
import { normalizeDemoEmail } from '@/data/demoLogins';
import { mergeCorePrompts, resolveDailyCheckInPrompt, isLockedCorePrompt, promptIsActiveForDelivery } from '@/lib/corePrompts';
import { INFRA_NOT_CONFIGURED, sanitizeInfraError } from '@/lib/infraMessaging';
import {
  filterReports,
  filterInvestigations,
  filterEmployees,
  computeAtRiskEmployees as computeAtRiskEmployeesQuery,
  computeEmployeeEngagement as computeEmployeeEngagementQuery,
} from '@/lib/storeQueries';
import { useInvestigationActions } from '@/hooks/useInvestigationActions';
import { useReportCaseActions } from '@/hooks/useReportCaseActions';
import { useReportLedgerActions } from '@/hooks/useReportLedgerActions';
import { useClientCrmActions } from '@/hooks/useClientCrmActions';

function formatAuditFieldValue(value: unknown): string {
 if (value === undefined || value === null) return '';
 if (value instanceof Date) return value.toISOString();
 return String(value);
}

function normalizeUserRoles(list: User[]): User[] {
 return list;
}

/** Production: cloud database is source of truth; localStorage is not used for org data. */
function useCloudBackend(): boolean {
 return isSupabaseAppConfigured();
}

/** Roles that receive the mandatory daily yes/no check-in prompt. */
const DAILY_CHECKIN_ROLES: UserRole[] = ['EMPLOYEE', 'HR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

function parseJwtClaims(accessToken: string): {
 orgId?: string;
 appUserId?: string;
 role?: UserRole;
} {
 try {
 const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as Record<string, string>;
 return {
 orgId: payload.org_id,
 appUserId: payload.app_user_id,
 role: payload.user_role as UserRole | undefined,
 };
 } catch {
 return {};
 }
}

const STORAGE_KEY = 'mismo_app_v2';
const SESSION_KEY = 'mismo_session';

export interface Session {
 userId: string;
 orgId: string;
 role: UserRole;
}

function readSession(): Session | null {
 try {
 const raw = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
 if (!raw) return null;
 return JSON.parse(raw) as Session;
 } catch {
 return null;
 }
}

function writeSession(session: Session | null) {
 try {
 if (typeof window === 'undefined') return;
 if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
 else localStorage.removeItem(SESSION_KEY);
 } catch {
 // ignore
 }
}

function reviveDates<T>(value: T): T {
 if (value === null || value === undefined) return value;
 if (typeof value === 'string') {
 if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
 return new Date(value) as T;
 }
 return value;
 }
 if (Array.isArray(value)) {
 return value.map((item) => reviveDates(item)) as T;
 }
 if (typeof value === 'object') {
 return Object.fromEntries(
 Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, reviveDates(v)])
 ) as T;
 }
 return value;
}

function readPersistedState() {
 try {
 const raw = localStorage.getItem(STORAGE_KEY);
 if (!raw) return null;
 const parsed = JSON.parse(raw);
 return reviveDates(parsed);
 } catch {
 return null;
 }
}

// Data store hook
export function useDataStore() {
 const persisted = !useCloudBackend() && typeof window !== 'undefined' ? readPersistedState() : null;
 const [dataLoading, setDataLoading] = useState(false);
 const [departments, setDepartments] = useState<Department[]>([]);
 const [orgSettings, setOrgSettings] = useState(DEFAULT_ORG_SETTINGS);
 const [organizationName, setOrganizationName] = useState(DEFAULT_ORG_NAME);

 // State
 const [users, setUsers] = useState<User[]>(
 persisted?.users ? normalizeUserRoles(persisted.users as User[]) : []
 );
 const [reports, setReports] = useState<Report[]>(persisted?.reports ?? []);
 const [prompts, setPrompts] = useState<Prompt[]>(persisted?.prompts ?? []);
 const [deliveries, setDeliveries] = useState<PromptDelivery[]>(persisted?.deliveries ?? []);
 const [responses, setResponses] = useState<PromptResponse[]>(persisted?.responses ?? []);
 const [investigations, setInvestigations] = useState<Investigation[]>(persisted?.investigations ?? []);
 const [nudges, setNudges] = useState<Nudge[]>(persisted?.nudges ?? []);
 const [appNotifications, setAppNotifications] = useState<AppNotification[]>(
   (persisted as { appNotifications?: AppNotification[] } | null)?.appNotifications ?? []
 );
 const [activities, setActivities] = useState<ActivityEvent[]>(persisted?.activities ?? []);
 const [reportStatusEvents, setReportStatusEvents] = useState<ReportStatusEvent[]>(
 persisted?.reportStatusEvents ?? []
 );
 const [policies, setPolicies] = useState<Policy[]>(persisted?.policies ?? []);
 const [companyResources, setCompanyResources] = useState<CompanyResource[]>([]);
 const [clientCompanies, setClientCompanies] = useState<ClientCompany[]>([]);
 const [clientContacts, setClientContacts] = useState<ClientContact[]>([]);
 const [clientDocuments, setClientDocuments] = useState<ClientDocument[]>([]);
 const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
 const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
 const [clientSupportEntries, setClientSupportEntries] = useState<ClientSupportEntry[]>([]);
 const [emergencyHotlines, setEmergencyHotlines] = useState<EmergencyHotline[]>([]);
 const [policyAcknowledgements, setPolicyAcknowledgements] = useState<PolicyAcknowledgement[]>(
 persisted?.policyAcknowledgements ?? []
 );
 const [announcements, setAnnouncements] = useState<Announcement[]>(persisted?.announcements ?? []);
 const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(persisted?.auditLogs ?? []);
 const [wageHourAcknowledgements, setWageHourAcknowledgements] = useState<WageHourScreeningAcknowledgement[]>(
 persisted?.wageHourAcknowledgements ?? []
 );
 const [currentRole, setCurrentRole] = useState<UserRole>(persisted?.currentRole ?? 'EMPLOYEE');
 const [session, setSessionState] = useState<Session | null>(readSession);
 const [previewUserId, setPreviewUserId] = useState<string | null>(null);
 const lastDailyDeliveryDateRef = useRef<string | null>(null);

 const setSession = useCallback((s: Session | null) => {
 setSessionState(s);
 writeSession(s);
 }, []);

 const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
 if (!useCloudBackend()) {
 return { ok: false, message: INFRA_NOT_CONFIGURED };
 }
 const trimmed = normalizeDemoEmail(email);
 const effectivePassword = password;
 if (!trimmed || !effectivePassword) {
 return { ok: false, message: 'Email and password are required.' };
 }

 try {
 const supabase = getSupabaseClient();
 const { data, error } = await supabase.auth.signInWithPassword({
 email: trimmed,
 password: effectivePassword,
 });
 if (error || !data.session) {
 return { ok: false, message: sanitizeInfraError(error?.message ?? 'Sign in failed.') };
 }

 const claims = parseJwtClaims(data.session.access_token);
 let appUserId = claims.appUserId;
 let orgId = claims.orgId;
 let role = claims.role;

 if (!appUserId || !orgId || !role) {
 const resolved = await resolveAppSessionFromAuth(supabase, data.session.access_token);
 if (!resolved) {
 return {
 ok: false,
 message:
 'Account signed in but no employee profile is linked. Ask HR to provision your user record.',
 };
 }
 appUserId = resolved.appUserId;
 orgId = resolved.orgId;
 role = resolved.role;
 await supabase.auth.refreshSession();
 }

 setSession({ userId: appUserId!, orgId: orgId!, role: role! });
 setCurrentRole(role!);
 if (typeof window !== 'undefined') {
 const path =
 role === 'EMPLOYEE'
 ? '/employee/dashboard'
 : role === 'CLIENT'
 ? '/admin/client-dashboard'
 : '/admin/dashboard';
 window.history.replaceState({}, '', path);
 }
 return { ok: true };
 } catch (err) {
 return { ok: false, message: sanitizeInfraError(err instanceof Error ? err.message : 'Sign in failed.') };
 }
 }, [setSession]);

 const logout = useCallback(async () => {
 if (useCloudBackend()) {
 await getSupabaseClient().auth.signOut();
 }
 setSession(null);
 setPreviewUserId(null);
 }, [setSession]);

 const resolveAppSession = useCallback(async (): Promise<Session | null> => {
 if (!useCloudBackend()) return readSession();
 const supabase = getSupabaseClient();
 const { data: authData } = await supabase.auth.getSession();
 const authSession = authData.session;
 if (!authSession) return null;

 const claims = parseJwtClaims(authSession.access_token);
 let appUserId = claims.appUserId;
 let orgId = claims.orgId;
 let role = claims.role;

 if (!appUserId || !orgId || !role) {
 const resolved = await resolveAppSessionFromAuth(supabase, authSession.access_token);
 if (resolved) {
 appUserId = resolved.appUserId;
 orgId = resolved.orgId;
 role = resolved.role;
 }
 }

 if (!appUserId || !orgId || !role) return null;
 return { userId: appUserId, orgId, role };
 }, []);

 useEffect(() => {
 if (!useCloudBackend()) return;
 const supabase = getSupabaseClient();

 void (async () => {
 const restored = await resolveAppSession();
 if (restored) {
 setSessionState(restored);
 writeSession(restored);
 setCurrentRole(restored.role);
 }
 })();

 const { data: authListener } = supabase.auth.onAuthStateChange((_event, authSession) => {
 if (!authSession) {
 setSessionState(null);
 writeSession(null);
 return;
 }
 void resolveAppSession().then((restored) => {
 if (restored) {
 setSessionState(restored);
 writeSession(restored);
 setCurrentRole(restored.role);
 }
 });
 });

 return () => authListener.subscription.unsubscribe();
 }, [resolveAppSession]);

 useEffect(() => {
 if (!useCloudBackend()) return;
 localStorage.removeItem(STORAGE_KEY);
 }, []);

 const hydrateFromSupabase = useCallback(async (orgId: string) => {
 if (!useCloudBackend()) return;
 setDataLoading(true);
 try {
 const snapshot = await loadOrgDataFromSupabase(orgId);
 setOrganizationName(snapshot.organizationName);
 setOrgSettings(snapshot.orgSettings);
 setDepartments(snapshot.departments);
 setUsers(normalizeUserRoles(snapshot.users));
 setReports(snapshot.reports);
 setPrompts(snapshot.prompts.length ? mergeCorePrompts(snapshot.prompts, orgId, session?.userId ?? 'system') : mergeCorePrompts([], orgId, session?.userId ?? 'system'));
 setDeliveries(snapshot.deliveries);
 setResponses(snapshot.responses);
 setInvestigations(snapshot.investigations);
 setPolicies(snapshot.policies);
 setPolicyAcknowledgements(snapshot.policyAcknowledgements);
 setAnnouncements(snapshot.announcements);
 setNudges(snapshot.nudges);
 setAppNotifications(snapshot.appNotifications ?? []);
 setActivities(snapshot.activities);
 setReportStatusEvents(snapshot.reportStatusEvents);
 setAuditLogs(snapshot.auditLogs);
 setCompanyResources(snapshot.companyResources);
 setEmergencyHotlines(snapshot.emergencyHotlines);
 try {
 const clients = await loadClientData(orgId);
 setClientCompanies(clients.companies);
 setClientContacts(clients.contacts);
 setClientDocuments(clients.documents);
 setClientNotes(clients.notes);
 setClientPayments(clients.payments);
 setClientSupportEntries(clients.supportEntries);
 } catch (clientErr) {
 console.error('Failed to load client companies:', clientErr);
 }
 } catch (err) {
 console.error('Failed to load organization data:', err);
 } finally {
 setDataLoading(false);
 }
 }, []);

 useEffect(() => {
 if (!session?.orgId || !useCloudBackend()) return;
 void hydrateFromSupabase(session.orgId);
 }, [session?.orgId, hydrateFromSupabase]);

 // After 3pm local: once per day, email employees with unanswered prompts.
 useEffect(() => {
 if (!session?.orgId || !useCloudBackend()) return;
 if (!['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(session.role)) return;
 if (new Date().getHours() < 15) return;
 const dayKey = new Date().toISOString().slice(0, 10);
 const storageKey = `mismo-prompt-reminders:${session.orgId}:${dayKey}`;
 try {
 if (localStorage.getItem(storageKey)) return;
 localStorage.setItem(storageKey, 'pending');
 } catch {
 // ignore storage failures
 }
 void runPromptReminders().then((result) => {
 try {
 if (result.ok) localStorage.setItem(storageKey, `sent:${result.sent ?? 0}`);
 else localStorage.removeItem(storageKey);
 } catch {
 // ignore
 }
 });
 }, [session?.orgId, session?.role]);

 useEffect(() => {
 if (useCloudBackend()) return;
 localStorage.setItem(
 STORAGE_KEY,
 JSON.stringify({
 users,
 reports,
 prompts,
 deliveries,
 responses,
 investigations,
 nudges,
 appNotifications,
 activities,
 reportStatusEvents,
 policies,
 policyAcknowledgements,
 announcements,
 auditLogs,
 wageHourAcknowledgements,
 currentRole,
 })
 );
 }, [
 activities,
 announcements,
 auditLogs,
 currentRole,
 deliveries,
 investigations,
 nudges,
 appNotifications,
 reportStatusEvents,
 policies,
 policyAcknowledgements,
 prompts,
 reports,
 responses,
 users,
 wageHourAcknowledgements,
 ]);

 useEffect(() => {
 if (!session?.orgId) return;
 setPrompts((prev) => {
 const orgPrompts = prev.filter((p) => p.orgId === session.orgId);
 const otherOrgs = prev.filter((p) => p.orgId !== session.orgId);
 const merged = mergeCorePrompts(orgPrompts, session.orgId, session.userId);
 if (merged.length === orgPrompts.length && merged.every((p, i) => p.id === orgPrompts[i]?.id && p.status === orgPrompts[i]?.status)) {
 return prev;
 }
 return [...otherOrgs, ...merged];
 });
 }, [session?.orgId, session?.userId]);

 // Ensure staff and employees get a daily prompt when they open the app (new day = new prompt).
 // Wait for cloud hydrate so an ephemeral delivery is not wiped; persist so it survives reloads.
 useEffect(() => {
 if (!session || !DAILY_CHECKIN_ROLES.includes(session.role)) return;
 if (useCloudBackend() && dataLoading) return;

 const orgId = session.orgId;
 const userId = session.userId;
 const startOfToday = new Date();
 startOfToday.setHours(0, 0, 0, 0);
 const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
 const yyyy = startOfToday.getFullYear();
 const mm = String(startOfToday.getMonth() + 1).padStart(2, '0');
 const dd = String(startOfToday.getDate()).padStart(2, '0');
 const dayStamp = `${yyyy}-${mm}-${dd}`;
 const dayUserKey = `${userId}:${dayStamp}`;

 const firstPrompt = resolveDailyCheckInPrompt(prompts, orgId);
 if (!firstPrompt) return;

 const orgDeliveries = deliveries.filter((d) => d.orgId === orgId);
 const hasPendingDueToday = orgDeliveries.some(
 (d) => d.userId === userId && d.status === 'PENDING' && d.dueAt && d.dueAt <= endOfToday
 );
 if (hasPendingDueToday) {
 lastDailyDeliveryDateRef.current = dayUserKey;
 return;
 }

 const alreadyDoneToday = orgDeliveries.some(
 (d) =>
 d.userId === userId &&
 d.promptId === firstPrompt.id &&
 d.status === 'COMPLETED' &&
 d.deliveredAt != null &&
 d.deliveredAt >= startOfToday &&
 d.deliveredAt <= endOfToday
 );
 if (alreadyDoneToday) {
 lastDailyDeliveryDateRef.current = dayUserKey;
 return;
 }

 const answeredToday = responses.some(
 (r) =>
 r.orgId === orgId &&
 r.userId === userId &&
 r.promptId === firstPrompt.id &&
 r.finalizedAt != null &&
 r.finalizedAt >= startOfToday &&
 r.finalizedAt <= endOfToday
 );
 if (answeredToday) {
 lastDailyDeliveryDateRef.current = dayUserKey;
 return;
 }

 const deliveryId = `delivery-daily-${userId}-${dayStamp}`;
 if (orgDeliveries.some((d) => d.id === deliveryId)) {
 lastDailyDeliveryDateRef.current = dayUserKey;
 return;
 }

 const newDelivery: PromptDelivery = {
 id: deliveryId,
 orgId,
 promptId: firstPrompt.id,
 userId,
 status: 'PENDING',
 deliveredAt: new Date(),
 dueAt: endOfToday,
 createdAt: new Date(),
 updatedAt: new Date(),
 };
 setDeliveries((prev) => (prev.some((d) => d.id === deliveryId) ? prev : [...prev, newDelivery]));
 lastDailyDeliveryDateRef.current = dayUserKey;
 void persistPromptDelivery(newDelivery, firstPrompt);
 }, [session, deliveries, prompts, responses, dataLoading]);

 // Org-scoped data when session exists (each company sees only their data)
 const effectiveOrgId = session?.orgId ?? DEFAULT_ORG_ID;
 const effectiveUsers = session ? users.filter((u) => u.orgId === session.orgId) : users;
 const effectiveReports = session ? reports.filter((r) => r.orgId === session.orgId) : reports;
 const effectivePrompts = session ? prompts.filter((p) => p.orgId === session.orgId) : prompts;
 const effectiveDeliveries = session ? deliveries.filter((d) => d.orgId === session.orgId) : deliveries;
 const effectiveResponses = session ? responses.filter((r) => r.orgId === session.orgId) : responses;
 const effectiveInvestigations = session ? investigations.filter((i) => i.orgId === session.orgId) : investigations;
 const effectiveNudges = session ? nudges.filter((n) => n.orgId === session.orgId) : nudges;
 const effectiveActivities = session ? activities.filter((a) => a.orgId === session.orgId) : activities;
 const effectiveReportStatusEvents = session
 ? reportStatusEvents.filter((e) => e.orgId === session.orgId)
 : reportStatusEvents;
 const effectivePolicies = session ? policies.filter((p) => p.orgId === session.orgId) : policies;
 const effectivePolicyAcknowledgements = session
 ? policyAcknowledgements.filter((a) => effectivePolicies.some((p) => p.id === a.policyId))
 : policyAcknowledgements;
 const effectiveAnnouncements = session ? announcements.filter((a) => a.orgId === session.orgId) : announcements;

 // Current user: from preview (HR viewing as employee) or from session; employees only see their own identity
 const currentUserFromSession = session ? effectiveUsers.find((u) => u.id === session.userId) : null;
 const currentUserFromPreview = previewUserId ? effectiveUsers.find((u) => u.id === previewUserId) : null;
 const currentUser =
 currentUserFromPreview ??
 currentUserFromSession ??
 (session
 ? {
 id: session.userId,
 orgId: session.orgId,
 role: session.role,
 firstName: '',
 lastName: '',
 email: '',
 status: 'active' as const,
 createdAt: new Date(),
 updatedAt: new Date(),
 }
 : ({
 id: '',
 orgId: effectiveOrgId,
 role: 'EMPLOYEE' as UserRole,
 firstName: '',
 lastName: '',
 email: '',
 status: 'active' as const,
 createdAt: new Date(),
 updatedAt: new Date(),
 } as User));
 const effectiveCurrentRole = previewUserId ? 'EMPLOYEE' : (session?.role ?? currentRole);

 // Switch role - only when not in preview and session allows (HR/Client)
 const switchRole = useCallback((role: UserRole) => {
 if (previewUserId) return;
 setCurrentRole(role);
 if (session) setSession({ ...session, role });
 }, [previewUserId, session]);
 
 // Submit prompt response (returns created response for linking cases)
 const submitPromptResponse = useCallback((
 deliveryId: string,
 answer: PromptAnswer,
 notes?: string,
 options?: { skipPersist?: boolean }
 ): PromptResponse | undefined => {
 const delivery = deliveries.find(d => d.id === deliveryId);
 if (!delivery) return undefined;

 // Idempotent: one response per delivery (DB unique on prompt_delivery_id).
 const existing = responses.find((r) => r.promptDeliveryId === deliveryId);
 if (existing) {
 const now = new Date();
 const updated: PromptResponse = {
 ...existing,
 answer,
 notes: notes ?? existing.notes,
 needsReview: answer === 'HAS_ISSUE',
 finalizedAt: existing.finalizedAt ?? now,
 submittedAt: existing.submittedAt ?? now,
 updatedAt: now,
 };
 setResponses((prev) => prev.map((r) => (r.id === existing.id ? updated : r)));
 const completedDelivery: PromptDelivery = {
 ...delivery,
 status: 'COMPLETED',
 completedAt: delivery.completedAt ?? now,
 updatedAt: now,
 };
 setDeliveries((prev) => prev.map((d) => (d.id === deliveryId ? completedDelivery : d)));
 if (!options?.skipPersist) {
 void persistPromptResponse(updated, completedDelivery);
 }
 return updated;
 }

 const now = new Date();
 // Stable id so retries upsert cleanly instead of colliding on delivery.
 const responseId = `response-${deliveryId}`;

 const newResponse: PromptResponse = {
 id: responseId,
 orgId: delivery.orgId,
 promptId: delivery.promptId,
 promptDeliveryId: deliveryId,
 userId: delivery.userId,
 answer,
 submittedAt: now,
 finalizedAt: now,
 notes,
 needsReview: answer === 'HAS_ISSUE',
 createdAt: now,
 updatedAt: now,
 };

 setResponses(prev => [...prev, newResponse]);

 const completedDelivery: PromptDelivery = {
 ...delivery,
 status: 'COMPLETED',
 completedAt: now,
 updatedAt: now,
 };
 setDeliveries(prev => prev.map(d => (d.id === deliveryId ? completedDelivery : d)));

 if (!options?.skipPersist) {
 void persistPromptResponse(newResponse, completedDelivery);
 }

 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: delivery.orgId,
 type: 'PROMPT_RESPONSE',
 actorUserId: delivery.userId,
 metadata: { promptId: delivery.promptId, answer, responseId, deliveryId },
 createdAt: now,
 };

 setActivities(prev => [newActivity, ...prev]);

 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'PROMPT_RESPONSE',
 recordId: responseId,
 field: 'answer',
 oldValue: '',
 newValue: answer,
 actorUserId: delivery.userId,
 createdAt: now,
 reason: notes,
 },
 ...prev,
 ]);

 return newResponse;
 }, [deliveries, responses, effectiveOrgId]);

 const ensureVoluntaryCheckInDelivery = useCallback((promptId?: string): PromptDelivery | null => {
 if (!session) return null;
 const orgId = session.orgId;
 const userId = session.userId;
 const targetPromptId = promptId ?? resolveDailyCheckInPrompt(prompts, orgId)?.id;
 if (!targetPromptId) return null;
 const prompt = prompts.find((p) => p.id === targetPromptId && p.orgId === orgId);
 if (!prompt || !promptIsActiveForDelivery(prompt)) return null;

 const endOfToday = new Date();
 endOfToday.setHours(23, 59, 59, 999);
 const now = new Date();
 const deliveryId = `delivery-voluntary-${userId}-${targetPromptId}-${now.getTime()}`;
 const newDelivery: PromptDelivery = {
 id: deliveryId,
 orgId,
 promptId: targetPromptId,
 userId,
 status: 'PENDING',
 deliveredAt: now,
 dueAt: endOfToday,
 createdAt: now,
 updatedAt: now,
 };
 setDeliveries((prev) => [...prev, newDelivery]);
 void persistPromptDelivery(newDelivery, prompt);
 return newDelivery;
 }, [session, prompts]);

 const {
 beginIncidentCaseFromPrompt,
 submitIncidentPromptYes,
 createReport,
 recordWageHourScreeningNo,
 beginWageHourCase,
 completeWageHourIntake,
 submitExpeditedPayrollReport,
 updateReportStatus,
 assignReport,
 completeIncidentIntake,
 } = useReportCaseActions({
 reports,
 prompts,
 users,
 deliveries,
 currentUser,
 effectiveOrgId,
 setReports,
 setActivities,
 setAuditLogs,
 setReportStatusEvents,
 setWageHourAcknowledgements,
 setResponses,
 submitPromptResponse,
 });

 
 const investigationActions = useInvestigationActions({
 reports,
 prompts,
 investigations,
 currentUser,
 effectiveOrgId,
 setInvestigations,
 setReports,
 setActivities,
 setAuditLogs,
 });
 const {
 createInvestigation,
 saveInvestigationProgress,
 pickUpInvestigation,
 assignInvestigationOwner,
 advanceInvestigationStage,
 setInvestigationInitialContactNotes,
 markInvestigationPageComplete,
 setInvestigationSubjectUsers,
 setInvestigationPersons,
 updateInvestigationChecklist,
 addInvestigationEvidence,
 addInvestigationResponseRequest,
 updateInvestigationResponseRequest,
 submitEmployeeInvestigationResponse,
 updateInvestigationAnalysis,
 addCorrectiveAction,
 updateCorrectiveAction,
 addFollowUp,
 completeFollowUp,
 sendNonRetaliationReminder,
 setInvestigationOutcomeClassification,
 addInvestigationNote,
 sendInvestigationOutcomeToEmployee,
 employeeAcknowledgeInvestigationOutcome,
 closeInvestigation,
 } = investigationActions;


 // Send nudge
 const sendNudge = useCallback((
 targetUserId: string,
 channel: 'EMAIL' | 'SMS' | 'MANUAL',
 message: string,
 context: NudgeContext
 ) => {
 const now = new Date();
 
 const newNudge: Nudge = {
 id: `nudge-${Date.now()}`,
 orgId: effectiveOrgId,
 targetUserId,
 channel,
 message,
 context,
 sentByAdminId: currentUser.id,
 sentAt: now,
 createdAt: now,
 updatedAt: now,
 };
 
 setNudges(prev => [...prev, newNudge]);
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'NUDGE_SENT',
 actorUserId: currentUser.id,
 metadata: { nudgeId: newNudge.id, targetUserId },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);

 if (channel === 'EMAIL' && orgSettings.enableEmail !== false) {
   const subjectMatch = message.match(/^Subject:\s*(.+?)(?:\n\n|\n)([\s\S]*)$/i);
   const subject = subjectMatch?.[1]?.trim() || context.relatedLabel || 'Message from HR on Mismo';
   const body = (subjectMatch?.[2] ?? message).trim();
   const actionPage =
     context.type === 'MEMO_REMINDER'
       ? 'resources'
       : context.type === 'CASE_REPORT_REMINDER'
         ? 'reports'
         : context.type === 'PROMPT_REMINDER'
           ? 'prompts'
           : 'dashboard';
   const actionParams: Record<string, string> = {};
   if (context.policyId) actionParams.id = context.policyId;
   if (context.reportId) actionParams.id = context.reportId;
   if (context.promptId) actionParams.promptId = context.promptId;

   const kind =
     context.type === 'MEMO_REMINDER'
       ? ('MEMO' as const)
       : context.type === 'PROMPT_REMINDER'
         ? ('PROMPT' as const)
         : ('MESSAGE' as const);

   void sendNotificationEmail({
     recipientUserId: targetUserId,
     subject,
     body,
     kind,
     actionPage,
     actionParams: Object.keys(actionParams).length ? actionParams : undefined,
     templateId: context.type === 'MEMO_REMINDER' ? 'new_memo' : context.type === 'PROMPT_REMINDER' ? 'prompt_notice' : 'new_message',
   }).then((result) => {
     if (!result) return;
     // Optimistically mirror recipient notification locally for the sender dashboard.
     const local: AppNotification = {
       id: result.notificationId ?? `notif-local-${Date.now()}`,
       orgId: effectiveOrgId,
       userId: targetUserId,
       kind,
       title: subject,
       body: body.slice(0, 500),
       actionPage,
       actionParams: Object.keys(actionParams).length ? actionParams : undefined,
       emailStatus: result.emailStatus,
       actorUserId: currentUser.id,
       createdAt: new Date(),
     };
     setAppNotifications((prev) => [local, ...prev.filter((n) => n.id !== local.id)]);
     const sentConfirm: AppNotification = {
       id: `notif-sent-${Date.now()}`,
       orgId: effectiveOrgId,
       userId: currentUser.id,
       kind: 'SYSTEM',
       title: `Sent: ${subject}`,
       body: `Emailed reminder to employee (${result.emailStatus ?? 'unknown'}).`,
       actionPage: 'users',
       actionParams: { id: targetUserId },
       emailStatus: result.emailStatus,
       actorUserId: currentUser.id,
       createdAt: new Date(),
     };
     setAppNotifications((prev) => [sentConfirm, ...prev]);
   });
 }
 }, [currentUser.id, orgSettings.enableEmail]);

 const markNotificationRead = useCallback((notificationId: string) => {
   const now = new Date();
   setAppNotifications((prev) =>
     prev.map((n) => (n.id === notificationId && !n.readAt ? { ...n, readAt: now } : n))
   );
   if (useCloudBackend()) {
     void getSupabaseClient()
       .from('app_notifications')
       .update({ read_at: now.toISOString() })
       .eq('id', notificationId)
       .then(() => undefined);
   }
 }, []);

 const markAllNotificationsRead = useCallback(() => {
   const now = new Date();
   const unreadIds = appNotifications
     .filter((n) => n.userId === currentUser.id && !n.readAt)
     .map((n) => n.id);
   if (unreadIds.length === 0) return;
   setAppNotifications((prev) =>
     prev.map((n) => (unreadIds.includes(n.id) ? { ...n, readAt: now } : n))
   );
   if (useCloudBackend()) {
     void getSupabaseClient()
       .from('app_notifications')
       .update({ read_at: now.toISOString() })
       .in('id', unreadIds)
       .then(() => undefined);
   }
 }, [appNotifications, currentUser.id]);

 const refreshAppNotifications = useCallback(async () => {
   if (!useCloudBackend() || !session?.orgId) return;
   try {
     const { data, error } = await getSupabaseClient()
       .from('app_notifications')
       .select('*')
       .eq('org_id', session.orgId)
       .order('created_at', { ascending: false })
       .limit(100);
     if (error || !data) return;
     setAppNotifications(
       data.map((row) => {
         const r = row as Record<string, unknown>;
         const params = r.action_params;
         return {
           id: String(r.id),
           orgId: String(r.org_id),
           userId: String(r.user_id),
           kind: r.kind as AppNotification['kind'],
           title: String(r.title ?? ''),
           body: String(r.body ?? ''),
           actionPage: r.action_page ? String(r.action_page) : undefined,
           actionParams:
             params && typeof params === 'object' && !Array.isArray(params)
               ? Object.fromEntries(
                   Object.entries(params as Record<string, unknown>).map(([k, v]) => [k, String(v)])
                 )
               : undefined,
           relatedEmail: r.related_email ? String(r.related_email) : undefined,
           emailStatus: r.email_status ? String(r.email_status) : undefined,
           actorUserId: r.actor_user_id ? String(r.actor_user_id) : undefined,
           readAt: r.read_at ? new Date(String(r.read_at)) : undefined,
           createdAt: new Date(String(r.created_at)),
         } satisfies AppNotification;
       })
     );
   } catch {
     // non-blocking
   }
 }, [session?.orgId]);

 const markPromptResponseReviewed = useCallback(
 (responseId: string) => {
 const now = new Date();
 setResponses((prev) =>
 prev.map((r) =>
 r.id === responseId
 ? {
 ...r,
 reviewedAt: now,
 reviewedByUserId: currentUser.id,
 needsReview: false,
 updatedAt: now,
 }
 : r
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'PROMPT_RESPONSE',
 actorUserId: currentUser.id,
 metadata: { responseId, action: 'REVIEWED' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

  const sendMemoReminderToUnacknowledged = useCallback(
    (payload: {
      policyId: string;
      channels: ('EMAIL' | 'SMS')[];
      subject: string;
      emailBody: string;
      smsBody: string;
    }) => {
      const policy = policies.find((p) => p.id === payload.policyId);
      if (!policy?.acknowledgmentRequired) return 0;
      const employees = users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
      let sent = 0;
      for (const u of employees) {
        const ack = policyAcknowledgements.find((a) => a.policyId === payload.policyId && a.userId === u.id);
        if (ack) continue;
        for (const channel of payload.channels) {
          if (channel === 'SMS' && !u.phone?.trim()) continue;
          const message =
            channel === 'EMAIL'
              ? `Subject: ${payload.subject}\n\n${payload.emailBody}`
              : payload.smsBody;
          sendNudge(u.id, channel, message, {
            type: 'MEMO_REMINDER',
            policyId: payload.policyId,
            relatedLabel: policy.title,
          });
          sent += 1;
        }
      }
      return sent;
    },
    [policies, users, policyAcknowledgements, sendNudge]
  );

 // Log export event for audit (append-only)
 const logExportEvent = useCallback((reportId: string, format: 'PDF' | 'CSV') => {
 const now = new Date();
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: format === 'PDF' ? 'EXPORT_PDF' : 'EXPORT_CSV',
 actorUserId: currentUser.id,
 metadata: { reportId, case_id: reportId },
 createdAt: now,
 };
 setActivities(prev => [newActivity, ...prev]);
 }, [currentUser.id]);
 
 // Create prompt
 const createPrompt = useCallback((promptData: Omit<Prompt, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
 const now = new Date();
 
 const newPrompt: Prompt = {
 ...promptData,
 id: `prompt-${Date.now()}`,
 orgId: effectiveOrgId,
 createdBy: currentUser.id,
 createdAt: now,
 updatedAt: now,
 };
 
 setPrompts(prev => [...prev, newPrompt]);
 
 // Create deliveries for targeted users
 const targetUserIds: string[] = [];
 if (promptData.targeting.audience === 'ALL') {
 targetUserIds.push(...users.filter(u => u.role === 'EMPLOYEE').map(u => u.id));
 } else if (promptData.targeting.audience === 'DEPARTMENT' && promptData.targeting.departmentIds) {
 targetUserIds.push(...users.filter(u => 
 u.role === 'EMPLOYEE' && 
 u.departmentId && 
 promptData.targeting.departmentIds!.includes(u.departmentId)
 ).map(u => u.id));
 } else if (promptData.targeting.audience === 'USER_LIST' && promptData.targeting.userIds) {
 targetUserIds.push(...promptData.targeting.userIds);
 }
 
 const newDeliveries: PromptDelivery[] = targetUserIds.map(userId => ({
 id: `delivery-${Date.now()}-${userId}`,
 orgId: effectiveOrgId,
 promptId: newPrompt.id,
 userId,
 status: 'PENDING',
 deliveredAt: now,
 dueAt: promptData.schedule.endAt,
 createdAt: now,
 updatedAt: now,
 }));
 
 setDeliveries(prev => [...prev, ...newDeliveries]);
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'PROMPT_CREATED',
 actorUserId: currentUser.id,
 metadata: { promptId: newPrompt.id, title: newPrompt.title },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);

 void persistPrompt(newPrompt, newDeliveries);

 return newPrompt;
 }, [users, currentUser.id, effectiveOrgId]);

 const updatePrompt = useCallback((promptId: string, updates: Partial<Prompt>) => {
 let persistTarget: Prompt | null = null;
 setPrompts((prev) =>
 prev.map((prompt) => {
 if (prompt.id !== promptId) return prompt;
 let next: Prompt;
 if (isLockedCorePrompt(prompt)) {
 const { status: _s, includeFinancialQuestion: _f, type: _t, id: _i, ...safe } = updates;
 next = {
 ...prompt,
 ...safe,
 status: 'ACTIVE',
 type: 'INCIDENT',
 includeFinancialQuestion: true,
 updatedAt: new Date(),
 };
 } else {
 next = { ...prompt, ...updates, updatedAt: new Date() };
 }
 persistTarget = next;
 return next;
 })
 );
 if (persistTarget) void persistPromptUpdate(persistTarget);
 }, []);

 const createPolicy = useCallback((payload: Omit<Policy, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => {
 const now = new Date();
 const policy: Policy = {
 ...payload,
 id: `policy-${Date.now()}`,
 orgId: effectiveOrgId,
 createdAt: now,
 updatedAt: now,
 };
 setPolicies((prev) => [policy, ...prev]);
 void persistPolicy(policy);
 return policy;
 }, [effectiveOrgId]);

 const updatePolicy = useCallback((id: string, updates: Partial<Policy>) => {
 let persistTarget: Policy | null = null;
 setPolicies((prev) =>
 prev.map((p) => {
 if (p.id !== id) return p;
 const next = { ...p, ...updates, updatedAt: new Date() };
 persistTarget = next;
 return next;
 })
 );
 if (persistTarget) void persistPolicy(persistTarget);
 }, []);

 const acknowledgePolicy = useCallback(
 (
 policyId: string,
 userId: string,
 opts?: {
 outcome?: 'READ_UNDERSTOOD' | 'REQUEST_CLARIFICATION';
 signatureDataUrl?: string;
 clarificationNote?: string;
 acknowledgedLawDigest?: LawDigestEntry[];
 }
 ) => {
 let persistTarget: PolicyAcknowledgement | null = null;
 setPolicyAcknowledgements((prev) => {
 const existing = prev.find((ack) => ack.policyId === policyId && ack.userId === userId);
 if (existing) {
 return prev.map((ack) => {
 if (ack.policyId !== policyId || ack.userId !== userId) return ack;
 const next: PolicyAcknowledgement = {
 ...ack,
 acknowledgedAt: new Date(),
 outcome: opts?.outcome ?? ack.outcome ?? 'READ_UNDERSTOOD',
 signatureDataUrl: opts?.signatureDataUrl ?? ack.signatureDataUrl,
 clarificationNote: opts?.clarificationNote ?? ack.clarificationNote,
 acknowledgedLawDigest: opts?.acknowledgedLawDigest ?? ack.acknowledgedLawDigest,
 };
 persistTarget = next;
 return next;
 });
 }
 const created: PolicyAcknowledgement = {
 policyId,
 userId,
 acknowledgedAt: new Date(),
 outcome: opts?.outcome ?? 'READ_UNDERSTOOD',
 signatureDataUrl: opts?.signatureDataUrl,
 clarificationNote: opts?.clarificationNote,
 acknowledgedLawDigest: opts?.acknowledgedLawDigest,
 };
 persistTarget = created;
 return [...prev, created];
 });
 if (persistTarget) void persistPolicyAck(persistTarget);
 },
 []
 );

 const createAnnouncement = useCallback((payload: Omit<Announcement, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => {
 const now = new Date();
 const item: Announcement = {
 ...payload,
 id: `announcement-${Date.now()}`,
 orgId: effectiveOrgId,
 createdAt: now,
 updatedAt: now,
 };
 setAnnouncements((prev) => [item, ...prev]);
 return item;
 }, []);

 const updateAnnouncement = useCallback((id: string, updates: Partial<Announcement>) => {
 setAnnouncements((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item)));
 }, []);

 useEffect(() => {
 const timer = setInterval(() => {
 const now = new Date();
 setAnnouncements((prev) =>
 prev.map((item) =>
 item.status === 'SCHEDULED' && item.publishAt && item.publishAt.getTime() <= now.getTime()
 ? { ...item, status: 'PUBLISHED', sentAt: now, updatedAt: now }
 : item
 )
 );
 }, 30000);
 return () => clearInterval(timer);
 }, []);

 const {
 addReportMessage,
 addReportHandlingEntry,
 addReportLedgerFile,
 updateReportHandling,
 toggleReportChecklistItem,
 updateReportChecklistItemEvidence,
 } = useReportLedgerActions({
 reports,
 currentUser,
 effectiveOrgId,
 orgSettings,
 setReports,
 setAppNotifications,
 });


 const updateUser = useCallback((userId: string, updates: Partial<User>) => {
 const now = new Date();
 const auditEntries: AuditLogEntry[] = [];
 const clearableKeys: (keyof User)[] = [
 'phone',
 'employeeId',
 'location',
 'archiveStartDate',
 'archiveEndDate',
 'departmentId',
 'managerId',
 'hiredDate',
 'state',
 ];
 let persistTarget: User | null = null;
 setUsers((prev) => {
 const prevUser = prev.find((u) => u.id === userId);
 if (!prevUser) return prev;
 const next: User = { ...prevUser, updatedAt: now };
 for (const [key, value] of Object.entries(updates) as [keyof User, User[keyof User]][]) {
 if (key === 'updatedAt' || key === 'createdAt' || key === 'id' || key === 'orgId') continue;
      if (value === undefined && clearableKeys.includes(key)) {
        const mutable = next as unknown as Record<string, unknown>;
        delete mutable[key as string];
      } else if (value !== undefined) {
        (next as unknown as Record<string, unknown>)[key as string] = value;
      }
 }
 for (const key of Object.keys(updates) as (keyof User)[]) {
 if (key === 'updatedAt' || key === 'createdAt') continue;
 const before = prevUser[key];
 const after = next[key];
 if (before === after) continue;
 auditEntries.push({
 id: `audit-${now.getTime()}-${String(key)}-${Math.random().toString(36).slice(2, 6)}`,
 orgId: effectiveOrgId,
 recordType: 'User',
 recordId: userId,
 field: String(key),
 oldValue: formatAuditFieldValue(before),
 newValue: formatAuditFieldValue(after),
 actorUserId: currentUser.id,
 createdAt: now,
 });
 }
 persistTarget = next;
 return prev.map((user) => (user.id === userId ? next : user));
 });
 if (auditEntries.length) {
 setAuditLogs((prev) => [...auditEntries, ...prev]);
 }
 if (persistTarget) void persistUserUpdate(persistTarget);
 }, [currentUser.id, effectiveOrgId]);

 const createUsers = useCallback((newUsers: Array<Omit<User, 'id' | 'orgId' | 'createdAt' | 'updatedAt'> & { id?: string }>) => {
 const now = new Date();
 const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'user';
 const existingIds = new Set(users.map((u) => u.id));
 const created: User[] = newUsers.map((user, index) => {
 let id: string;
 if (user.id && String(user.id).trim()) {
 id = String(user.id).trim();
 if (existingIds.has(id)) id = `${id}-${Date.now()}-${index}`;
 } else {
 const base = `${slug(user.firstName)}-${slug(user.lastName)}`;
 id = base;
 let n = 1;
 while (existingIds.has(id)) {
 id = `${base}-${n}`;
 n += 1;
 }
 }
 existingIds.add(id);
 const { id: _omit, ...rest } = user;
 return {
 ...rest,
 id,
 orgId: effectiveOrgId,
 createdAt: now,
 updatedAt: now,
 };
 });
 setUsers((prev) => [...prev, ...created]);
 void persistUsers(created);
 return created;
 }, [users, effectiveOrgId]);

 const createDepartment = useCallback(
 (name: string): Department | { error: string } => {
 const trimmed = name.trim();
 if (!trimmed) return { error: 'Department name is required.' };
 const duplicate = departments.some(
 (d) => d.orgId === effectiveOrgId && d.name.toLowerCase() === trimmed.toLowerCase()
 );
 if (duplicate) return { error: 'A department with that name already exists.' };
 const now = new Date();
 const slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'dept';
 let id = `dept-${slug}`;
 let n = 1;
 const existingIds = new Set(departments.map((d) => d.id));
 while (existingIds.has(id)) {
 id = `dept-${slug}-${n}`;
 n += 1;
 }
 const dept: Department = {
 id,
 orgId: effectiveOrgId,
 name: trimmed,
 createdAt: now,
 updatedAt: now,
 };
 setDepartments((prev) => [...prev, dept]);
 void persistDepartment(dept);
 return dept;
 },
 [departments, effectiveOrgId]
 );

 const updateDepartment = useCallback(
 (departmentId: string, name: string): Department | { error: string } | null => {
 const trimmed = name.trim();
 if (!trimmed) return { error: 'Department name is required.' };
 const duplicate = departments.some(
 (d) =>
 d.id !== departmentId &&
 d.orgId === effectiveOrgId &&
 d.name.toLowerCase() === trimmed.toLowerCase()
 );
 if (duplicate) return { error: 'A department with that name already exists.' };
 let updated: Department | null = null;
 setDepartments((prev) =>
 prev.map((d) => {
 if (d.id !== departmentId) return d;
 updated = { ...d, name: trimmed, updatedAt: new Date() };
 return updated;
 })
 );
 if (updated) void persistDepartment(updated);
 return updated;
 },
 [departments, effectiveOrgId]
 );

 const deleteDepartment = useCallback(
 (departmentId: string) => {
 setDepartments((prev) => prev.filter((d) => d.id !== departmentId));
 setUsers((prev) =>
 prev.map((u) =>
 u.departmentId === departmentId ? { ...u, departmentId: undefined, updatedAt: new Date() } : u
 )
 );
 void deleteDepartmentRecord(departmentId);
 },
 []
 );

 const updateOrgSettings = useCallback(
 (patch: Partial<typeof DEFAULT_ORG_SETTINGS>) => {
 setOrgSettings((prev) => {
 const next = { ...prev, ...patch, thresholds: { ...prev.thresholds, ...patch.thresholds } };
 void persistOrgSettings(effectiveOrgId, next);
 return next;
 });
 },
 [effectiveOrgId]
 );

 /** Add an org-defined role / job title for employee Role dropdowns. */
 const addCustomRole = useCallback(
 (name: string): string | { error: string } => {
 const trimmed = name.trim();
 if (!trimmed) return { error: 'Role name is required.' };
 const existing = orgSettings.customRoles ?? [];
 const systemLabels = new Set(['Employee', 'Human Resources', 'Management', 'Admin', 'Mismo Internal', 'Client']);
 if (systemLabels.has(trimmed) || existing.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
 return { error: 'A role with that name already exists.' };
 }
 const nextRoles = [...existing, trimmed].sort((a, b) => a.localeCompare(b));
 updateOrgSettings({ customRoles: nextRoles });
 return trimmed;
 },
 [orgSettings.customRoles, updateOrgSettings]
 );

 const {
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
 } = useClientCrmActions({
 currentUser,
 effectiveOrgId,
 setClientCompanies,
 setClientContacts,
 setClientDocuments,
 setClientNotes,
 setClientPayments,
 setClientSupportEntries,
 });


 // Get filtered reports (org-scoped)
 const getFilteredReports = useCallback(
 (filters: Parameters<typeof filterReports>[1]) => filterReports(effectiveReports, filters),
 [effectiveReports]
 );

 const getFilteredInvestigations = useCallback(
 (filters: Parameters<typeof filterInvestigations>[1]) =>
 filterInvestigations(effectiveInvestigations, filters),
 [effectiveInvestigations]
 );

 const engagementOpts = {
 responses: effectiveResponses,
 deliveries: effectiveDeliveries,
 thresholds: orgSettings.thresholds,
 };

 const getFilteredEmployees = useCallback(
 (filters: Parameters<typeof filterEmployees>[1]) =>
 filterEmployees(effectiveUsers, filters, engagementOpts),
 [effectiveUsers, effectiveResponses, effectiveDeliveries, orgSettings.thresholds]
 );

 const computeAtRiskEmployees = useCallback(
 () => computeAtRiskEmployeesQuery(effectiveUsers, engagementOpts),
 [effectiveUsers, effectiveResponses, effectiveDeliveries, orgSettings.thresholds]
 );

 const computeEmployeeEngagement = useCallback(
 (userId: string) => computeEmployeeEngagementQuery(userId, engagementOpts),
 [effectiveResponses, effectiveDeliveries, orgSettings.thresholds]
 );


 const atRiskEmployees = computeAtRiskEmployees();
 const endOfToday = (() => {
 const e = new Date();
 e.setHours(23, 59, 59, 999);
 return e;
 })();
 const receivesDailyCheckIn =
 effectiveCurrentRole === 'EMPLOYEE' ||
 (!previewUserId && session != null && DAILY_CHECKIN_ROLES.includes(session.role));
 const pendingPromptsForEmployee = receivesDailyCheckIn
 ? effectiveDeliveries
 .filter(
 (d) =>
 d.userId === currentUser.id &&
 d.status === 'PENDING' &&
 d.dueAt &&
 d.dueAt <= endOfToday
 )
 .map((d) => ({ ...d, prompt: effectivePrompts.find((p) => p.id === d.promptId)! }))
 .filter((d) => Boolean(d.prompt))
 : [];
 const employeeReports =
 effectiveCurrentRole === 'EMPLOYEE' ? effectiveReports.filter((r) => r.createdByUserId === currentUser.id) : [];

 const dashboardCounts = {
 criticalReports:
 effectiveReports.filter(
 (r) =>
 (r.severity === 'HIGH' || r.severity === 'CRITICAL') &&
 !['RESOLVED', 'CLOSED'].includes(r.status)
 ).length +
 effectiveResponses.filter((response) => {
 if (response.answer !== 'HAS_ISSUE') return false;
 const prompt = effectivePrompts.find((p) => p.id === response.promptId);
 return prompt ? prompt.severityOnHasIssue === 'HIGH' || prompt.severityOnHasIssue === 'CRITICAL' : false;
 }).length,
 activeInvestigations: effectiveInvestigations.filter((i) => i.status === 'OPEN').length,
 needsAssignment: effectiveReports.filter((r) => !r.assignedTo && ['NEW', 'TRIAGED'].includes(r.status)).length,
 atRiskEmployees: atRiskEmployees.length,
 scheduledMemos: effectiveDeliveries.filter((d) => {
 if (d.status !== 'PENDING' || !d.dueAt) return false;
 const now = new Date();
 const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
 return d.dueAt <= nextWeek || d.dueAt < now;
 }).length,
 activeCampaigns: effectivePrompts.filter((p) => p.status === 'ACTIVE').length,
 yesResponsesNeedingReview: effectiveResponses.filter(
 (r) => r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false
 ).length,
 // Only employee check-ins still awaiting an answer (not HR/admin's own gate, not closed prompts).
 unansweredPromptDeliveries: effectiveDeliveries.filter((d) => {
 if (d.status !== 'PENDING') return false;
 const user = effectiveUsers.find((u) => u.id === d.userId);
 if (!user || user.role !== 'EMPLOYEE' || user.status !== 'active') return false;
 const prompt = effectivePrompts.find((p) => p.id === d.promptId);
 if (!prompt || prompt.status !== 'ACTIVE') return false;
 return true;
 }).length,
 reportsNeedingClarification: effectiveReports.filter((r) => r.status === 'NEEDS_INFO').length,
 memoAcknowledgementsPending: (() => {
 const activeEmployees = effectiveUsers.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
 const requiredPolicies = effectivePolicies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
 let pending = 0;
 for (const emp of activeEmployees) {
 for (const policy of requiredPolicies) {
 const ack = effectivePolicyAcknowledgements.find((a) => a.policyId === policy.id && a.userId === emp.id);
 if (employeeNeedsPolicyAck(policy, ack)) pending += 1;
 }
 }
 return pending;
 })(),
 memosNeedingClarification: effectivePolicyAcknowledgements.filter((a) => a.outcome === 'REQUEST_CLARIFICATION').length,
 actionRequiredTotal: 0,
 openCaseRegisterCount: openCaseRegisterReports(effectiveReports, effectiveInvestigations).length,
 wageHourPendingReview: effectiveReports.filter((r) => r.status === 'PENDING_WAGE_HOUR_REVIEW').length,
 payrollExpeditedOpen: effectiveReports.filter(
 (r) => r.status === 'PAYROLL_EXPEDITED' && r.expeditedPayroll
 ).length,
 };
 const investigationWorkload = computeOpenInvestigationWorkload(
 effectiveInvestigations,
 effectiveResponses,
 effectiveReports
 );
 const unansweredPromptDeliveries = dashboardCounts.unansweredPromptDeliveries;
 const promptResponsesNavCount = computePromptResponsesNavCount({
 responses: effectiveResponses,
 reports: effectiveReports,
 investigations: effectiveInvestigations,
 unansweredPromptDeliveries,
 });
 const dashboardCountsWithWorkload = {
 ...dashboardCounts,
 openInvestigationWorkload: investigationWorkload.totalCount,
 promptResponsesNavCount,
 };
 const actionRequiredTotal =
 dashboardCountsWithWorkload.yesResponsesNeedingReview +
 dashboardCountsWithWorkload.unansweredPromptDeliveries +
 dashboardCountsWithWorkload.activeInvestigations +
 dashboardCountsWithWorkload.reportsNeedingClarification +
 dashboardCountsWithWorkload.payrollExpeditedOpen;
 const dashboardCountsWithAction = { ...dashboardCountsWithWorkload, actionRequiredTotal };
 
 return {
 // State (org-scoped when session exists)
 users: effectiveUsers,
 reports: effectiveReports,
 prompts: effectivePrompts,
 deliveries: effectiveDeliveries,
 responses: effectiveResponses,
 investigations: effectiveInvestigations,
 nudges: effectiveNudges,
 appNotifications,
 activities: effectiveActivities,
 reportStatusEvents: effectiveReportStatusEvents,
 policies: effectivePolicies,
 policyAcknowledgements: effectivePolicyAcknowledgements,
 companyResources,
 emergencyHotlines,
 announcements: effectiveAnnouncements,
 auditLogs,
 currentUser,
 currentRole: effectiveCurrentRole,
 orgSettings,
 organizationName,
 dataLoading,
 departments: session ? departments.filter((d) => d.orgId === session.orgId) : departments,
 clientCompanies,
 clientContacts,
 clientDocuments,
 clientNotes,
 clientPayments,
 clientSupportEntries,
 session,
 previewUserId,
 login,
 logout,
 setSession,
 setPreviewUserId,
 
 // Derived data
 dashboardCounts: dashboardCountsWithAction,
 pendingPromptsForEmployee,
 employeeReports,
 atRiskEmployees,
 
 // Functions
 getEmployeeEngagement: computeEmployeeEngagement,
 
 // Actions
 switchRole,
 submitPromptResponse,
 ensureVoluntaryCheckInDelivery,
 submitIncidentPromptYes,
 beginIncidentCaseFromPrompt,
 createReport,
 recordWageHourScreeningNo,
 beginWageHourCase,
 completeWageHourIntake,
 submitExpeditedPayrollReport,
 wageHourAcknowledgements,
 updateReportStatus,
 assignReport,
 createInvestigation,
 saveInvestigationProgress,
 pickUpInvestigation,
 assignInvestigationOwner,
 advanceInvestigationStage,
 setInvestigationInitialContactNotes,
 markInvestigationPageComplete,
 setInvestigationSubjectUsers,
 setInvestigationPersons,
 updateInvestigationChecklist,
 addInvestigationEvidence,
 addInvestigationResponseRequest,
 updateInvestigationResponseRequest,
 submitEmployeeInvestigationResponse,
 updateInvestigationAnalysis,
 addCorrectiveAction,
 updateCorrectiveAction,
 addFollowUp,
 completeFollowUp,
 sendNonRetaliationReminder,
 setInvestigationOutcomeClassification,
 addInvestigationNote,
 sendInvestigationOutcomeToEmployee,
 employeeAcknowledgeInvestigationOutcome,
 closeInvestigation,
 completeIncidentIntake,
 sendNudge,
 markNotificationRead,
 markAllNotificationsRead,
 refreshAppNotifications,
 markPromptResponseReviewed,
 sendMemoReminderToUnacknowledged,
 createPrompt,
 updatePrompt,
 createPolicy,
 updatePolicy,
 acknowledgePolicy,
 createAnnouncement,
 updateAnnouncement,
 updateUser,
 createUsers,
 createDepartment,
 updateDepartment,
 deleteDepartment,
 updateOrgSettings,
 addCustomRole,
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
 addReportMessage,
 addReportHandlingEntry,
 addReportLedgerFile,
 updateReportHandling,
 toggleReportChecklistItem,
 updateReportChecklistItemEvidence,
 getFilteredReports,
 getFilteredInvestigations,
 getFilteredEmployees,
 logExportEvent,
 };
}

export type DataStore = ReturnType<typeof useDataStore>;
