import { useState, useCallback, useEffect, useRef } from 'react';
import type {
 User,
 UserRole,
 Report,
 ReportStatus,
 Prompt,
 PromptDelivery,
 PromptResponse,
 PromptAnswer,
 Investigation,
 InvestigationNote,
 InvestigationEmployeeContactPreference,
 InvestigationAttachment,
 Nudge,
 ActivityEvent,
 ReportStatusEvent,
 Policy,
 PolicyAcknowledgement,
 Announcement,
 Department,
 ReportHandlingEntry,
 ReportHandlingEntryType,
 ReportChecklistItem,
 AuditLogEntry,
 NudgeContext,
 CompanyResource,
 EmergencyHotline,
 InvestigationPerson,
 InvestigationStage,
 InvestigationChecklistStage,
 OutcomeClassification,
 InvestigationPriority,
 InvestigationEvidenceRecord,
 InvestigationResponseRequest,
 InvestigationCorrectiveAction,
 InvestigationFollowUp,
 InvestigationNoteType,
 WageHourIntakeData,
 WageHourScreeningAcknowledgement,
} from '@/types';
import {
 buildDefaultChecklistStages,
 buildStageHistoryEntry,
 inferReportSourceType,
} from '@/lib/investigationWorkflow';
import { allocateCaseReferenceNumber } from '@/lib/caseReference';
import { computeOpenInvestigationWorkload } from '@/lib/investigationWorkload';
import {
 DEFAULT_ORG_ID,
 DEFAULT_ORG_NAME,
 DEFAULT_ORG_SETTINGS,
 isSupabaseAppConfigured,
} from '@/data/orgDefaults';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { findAppUserByEmail, loadOrgDataFromSupabase } from '@/lib/supabase/loadOrgData';
import { normalizeDemoEmail, resolveDemoPassword } from '@/data/demoLogins';
import { INDUSTRY_CHECKLIST_SECTIONS } from '@/data/industryChecklist';

function formatAuditFieldValue(value: unknown): string {
 if (value === undefined || value === null) return '';
 if (value instanceof Date) return value.toISOString();
 return String(value);
}

function normalizeUserRoles(list: User[]): User[] {
 return list;
}

/** Production: Supabase is source of truth; localStorage is not used for org data. */
const USE_SUPABASE = isSupabaseAppConfigured();

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

function createIndustryChecklistForReport(): ReportChecklistItem[] {
 const items: ReportChecklistItem[] = [];
 let globalOrder = 0;
 for (const section of INDUSTRY_CHECKLIST_SECTIONS) {
 for (const label of section.items) {
 items.push({
 id: `check-${section.id}-${globalOrder}`,
 sectionId: section.id,
 sectionLabel: section.label,
 label,
 order: globalOrder,
 completed: false,
 });
 globalOrder += 1;
 }
 }
 return items;
}

// Data store hook
export function useDataStore() {
 const persisted = !USE_SUPABASE && typeof window !== 'undefined' ? readPersistedState() : null;
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
 const [activities, setActivities] = useState<ActivityEvent[]>(persisted?.activities ?? []);
 const [reportStatusEvents, setReportStatusEvents] = useState<ReportStatusEvent[]>(
 persisted?.reportStatusEvents ?? []
 );
 const [policies, setPolicies] = useState<Policy[]>(persisted?.policies ?? []);
 const [companyResources, setCompanyResources] = useState<CompanyResource[]>([]);
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
 if (!USE_SUPABASE) {
 return { ok: false, message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
 }
 const trimmed = normalizeDemoEmail(email);
 const effectivePassword = resolveDemoPassword(trimmed, password);
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
 return { ok: false, message: error?.message ?? 'Sign in failed.' };
 }

 const claims = parseJwtClaims(data.session.access_token);
 let appUserId = claims.appUserId;
 let orgId = claims.orgId;
 let role = claims.role;

 if (!appUserId || !orgId || !role) {
 const { data: userRow, error: userErr } = await supabase
 .from('users')
 .select('*')
 .eq('auth_user_id', data.session.user.id)
 .maybeSingle();
 if (userErr || !userRow) {
 const byEmail = await findAppUserByEmail(trimmed);
 if (!byEmail) {
 return {
 ok: false,
 message: 'Account signed in but no employee profile is linked. Ask HR to provision your user record.',
 };
 }
 appUserId = byEmail.id;
 orgId = byEmail.orgId;
 role = byEmail.role;
 } else {
 appUserId = String(userRow.id);
 orgId = String(userRow.org_id);
 role = userRow.role as UserRole;
 }
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
 return { ok: false, message: err instanceof Error ? err.message : 'Sign in failed.' };
 }
 }, [setSession]);

 const logout = useCallback(async () => {
 if (USE_SUPABASE) {
 await getSupabaseClient().auth.signOut();
 }
 setSession(null);
 setPreviewUserId(null);
 }, [setSession]);

 const resolveAppSession = useCallback(async (): Promise<Session | null> => {
 if (!USE_SUPABASE) return readSession();
 const supabase = getSupabaseClient();
 const { data: authData } = await supabase.auth.getSession();
 const authSession = authData.session;
 if (!authSession) return null;

 const claims = parseJwtClaims(authSession.access_token);
 let appUserId = claims.appUserId;
 let orgId = claims.orgId;
 let role = claims.role;

 if (!appUserId || !orgId || !role) {
 const { data: userRow } = await supabase
 .from('users')
 .select('*')
 .eq('auth_user_id', authSession.user.id)
 .maybeSingle();
 if (userRow) {
 appUserId = String(userRow.id);
 orgId = String(userRow.org_id);
 role = userRow.role as UserRole;
 } else if (authSession.user.email) {
 const byEmail = await findAppUserByEmail(authSession.user.email);
 if (byEmail) {
 appUserId = byEmail.id;
 orgId = byEmail.orgId;
 role = byEmail.role;
 }
 }
 }

 if (!appUserId || !orgId || !role) return null;
 return { userId: appUserId, orgId, role };
 }, []);

 useEffect(() => {
 if (!USE_SUPABASE) return;
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
 if (!USE_SUPABASE) return;
 localStorage.removeItem(STORAGE_KEY);
 }, []);

 const hydrateFromSupabase = useCallback(async (orgId: string) => {
 if (!USE_SUPABASE) return;
 setDataLoading(true);
 try {
 const snapshot = await loadOrgDataFromSupabase(orgId);
 setOrganizationName(snapshot.organizationName);
 setOrgSettings(snapshot.orgSettings);
 setDepartments(snapshot.departments);
 setUsers(normalizeUserRoles(snapshot.users));
 setReports(snapshot.reports);
 setPrompts(snapshot.prompts);
 setDeliveries(snapshot.deliveries);
 setResponses(snapshot.responses);
 setInvestigations(snapshot.investigations);
 setPolicies(snapshot.policies);
 setPolicyAcknowledgements(snapshot.policyAcknowledgements);
 setAnnouncements(snapshot.announcements);
 setNudges(snapshot.nudges);
 setActivities(snapshot.activities);
 setReportStatusEvents(snapshot.reportStatusEvents);
 setAuditLogs(snapshot.auditLogs);
 setCompanyResources(snapshot.companyResources);
 setEmergencyHotlines(snapshot.emergencyHotlines);
 } catch (err) {
 console.error('Failed to load organization data:', err);
 } finally {
 setDataLoading(false);
 }
 }, []);

 useEffect(() => {
 if (!session?.orgId || !USE_SUPABASE) return;
 void hydrateFromSupabase(session.orgId);
 }, [session?.orgId, hydrateFromSupabase]);

 useEffect(() => {
 if (USE_SUPABASE) return;
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
 reportStatusEvents,
 policies,
 policyAcknowledgements,
 prompts,
 reports,
 responses,
 users,
 wageHourAcknowledgements,
 ]);

 // Ensure staff and employees get a daily prompt when they open the app (new day = new prompt)
 useEffect(() => {
 if (!session || !DAILY_CHECKIN_ROLES.includes(session.role)) return;
 const orgId = session.orgId;
 const userId = session.userId;
 const startOfToday = new Date();
 startOfToday.setHours(0, 0, 0, 0);
 const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
 const dayKey = startOfToday.toDateString();
 const dayUserKey = `${userId}:${dayKey}`;
 if (lastDailyDeliveryDateRef.current === dayUserKey) return;
 const orgDeliveries = deliveries.filter((d) => d.orgId === orgId);
 const hasPendingDueToday = orgDeliveries.some(
 (d) => d.userId === userId && d.status === 'PENDING' && d.dueAt && d.dueAt <= endOfToday
 );
 if (hasPendingDueToday) return;
 const firstPrompt = prompts.find((p) => p.orgId === orgId && p.status === 'ACTIVE') ?? prompts.find((p) => p.orgId === orgId);
 if (!firstPrompt) return;
 const newDelivery: PromptDelivery = {
 id: `delivery-daily-${userId}-${startOfToday.getTime()}`,
 orgId,
 promptId: firstPrompt.id,
 userId,
 status: 'PENDING',
 deliveredAt: new Date(),
 dueAt: endOfToday,
 createdAt: new Date(),
 updatedAt: new Date(),
 };
 setDeliveries((prev) => [...prev, newDelivery]);
 lastDailyDeliveryDateRef.current = dayUserKey;
 }, [session, deliveries, prompts]);

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
 notes?: string
 ): PromptResponse | undefined => {
 const delivery = deliveries.find(d => d.id === deliveryId);
 if (!delivery) return undefined;
 
 const now = new Date();
 const responseId = `response-${Date.now()}`;
 
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
 
 setDeliveries(prev => prev.map(d => 
 d.id === deliveryId 
 ? { ...d, status: 'COMPLETED', completedAt: now, updatedAt: now }
 : d
 ));
 
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
 }, [deliveries]);

 const beginIncidentCaseFromPrompt = useCallback(
 (userId: string, delivery: PromptDelivery, response: PromptResponse) => {
 const now = new Date();
 const prompt = prompts.find((p) => p.id === delivery.promptId);
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WORKPLACE_INVESTIGATION');
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const severity = prompt?.severityOnHasIssue ?? 'HIGH';
 const screeningNote = response.notes?.trim();
 const ledger: Report['handlingLedger'] = [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Case opened from incident prompt Yes response.',
 createdAt: now,
 createdBy: userId,
 },
 ];
 if (screeningNote?.startsWith('Financial follow-up:')) {
 ledger.push({
 id: `ledger-${Date.now()}-fin`,
 type: 'NOTE',
 text: screeningNote,
 createdAt: now,
 createdBy: userId,
 });
 }
 const newReport: Report = {
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 sourcePromptId: delivery.promptId,
 sourcePromptResponseId: response.id,
 reportSourceType: 'EMPLOYEE_PROMPT_RESPONSE',
 caseType: 'WORKPLACE_INVESTIGATION',
 referenceNumber: refNum,
 category: 'OTHER',
 severity,
 summary: 'Incident query - concern indicated',
 description:
 'Employee answered Yes on the mandatory incident query. Complete the secure intake form to provide details.',
 status: 'NEW',
 assignedTo: defaultAdmin?.id,
 needsExtendedIncidentIntake: true,
 messages: [],
 responseChecklist: createIndustryChecklistForReport(),
 handlingLedger: ledger,
 createdAt: now,
 updatedAt: now,
 };
 setReports((prev) => [newReport, ...prev]);
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_CREATED',
 actorUserId: userId,
 metadata: {
 reportId: newReport.id,
 source: 'EMPLOYEE_PROMPT_RESPONSE',
 promptResponseId: response.id,
 referenceNumber: refNum,
 },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'caseType',
 oldValue: '',
 newValue: 'WORKPLACE_INVESTIGATION',
 actorUserId: userId,
 createdAt: now,
 reason: `Linked prompt response ${response.id}`,
 },
 ...prev,
 ]);
 return newReport;
 },
 [prompts, reports, effectiveOrgId, users]
 );

 /** Finalize incident prompt Yes: log response, open case shell, alert HR queue */
 const submitIncidentPromptYes = useCallback(
 (deliveryId: string, notes?: string) => {
 const delivery = deliveries.find((d) => d.id === deliveryId);
 if (!delivery) return undefined;
 const response = submitPromptResponse(deliveryId, 'HAS_ISSUE', notes);
 if (!response) return undefined;
 const report = beginIncidentCaseFromPrompt(delivery.userId, delivery, response);
 return { response, report };
 },
 [deliveries, submitPromptResponse, beginIncidentCaseFromPrompt]
 );
 
 // Create report
 const createReport = useCallback((reportData: Omit<Report, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'status'>) => {
 const now = new Date();
 
 const needsExtended = Boolean(reportData.needsExtendedIncidentIntake);
 const caseType = reportData.caseType ?? (reportData.category === 'WAGE_HOURS' ? 'WAGE_HOUR' : 'WORKPLACE_INVESTIGATION');
 const refNum =
 reportData.referenceNumber ??
 allocateCaseReferenceNumber(reports, effectiveOrgId, caseType);
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const newReport: Report = {
 ...reportData,
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 caseType,
 referenceNumber: refNum,
 status: 'NEW',
 assignedTo: reportData.assignedTo ?? defaultAdmin?.id,
 needsExtendedIncidentIntake: needsExtended,
 incidentIntakeCompletedAt: needsExtended ? undefined : now,
 messages: reportData.messages ?? [],
 responseChecklist: reportData.responseChecklist ?? createIndustryChecklistForReport(),
 handlingLedger: reportData.handlingLedger ?? [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Case intake recorded in HR command log.',
 createdAt: now,
 createdBy: reportData.createdByUserId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };
 
 setReports(prev => [newReport, ...prev]);
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_CREATED',
 actorUserId: reportData.createdByUserId,
 metadata: { reportId: newReport.id, category: reportData.category },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);
 
 return newReport;
 }, [effectiveOrgId, reports, users]);

 const recordWageHourScreeningNo = useCallback(
 (userId: string) => {
 const now = new Date();
 const ack: WageHourScreeningAcknowledgement = {
 id: `wh-ack-${Date.now()}`,
 orgId: effectiveOrgId,
 userId,
 hasConcern: false,
 acknowledgedAt: now,
 };
 setWageHourAcknowledgements((prev) => [...prev, ack]);
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SCREENING',
 actorUserId: userId,
 metadata: { hasConcern: false, acknowledgementId: ack.id },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'WAGE_HOUR_SCREENING',
 recordId: ack.id,
 field: 'hasConcern',
 oldValue: '',
 newValue: 'false',
 actorUserId: userId,
 createdAt: now,
 },
 ...prev,
 ]);
 return ack;
 },
 [effectiveOrgId]
 );

 const beginWageHourCase = useCallback(
 (userId: string, sourceType: Report['reportSourceType'] = 'SELF_REPORTED') => {
 const now = new Date();
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WAGE_HOUR');
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const newReport: Report = {
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 reportSourceType: sourceType,
 caseType: 'WAGE_HOUR',
 referenceNumber: refNum,
 category: 'WAGE_HOURS',
 severity: 'MEDIUM',
 summary: 'Wage & Hour Concern',
 description: 'Protected wage and hour concern - complete intake to submit details.',
 status: 'PENDING_WAGE_HOUR_REVIEW',
 assignedTo: defaultAdmin?.id,
 needsExtendedWageHourIntake: true,
 messages: [],
 responseChecklist: createIndustryChecklistForReport(),
 handlingLedger: [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Protected wage & hour case opened from employee portal screening.',
 createdAt: now,
 createdBy: userId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };
 setReports((prev) => [newReport, ...prev]);
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SCREENING',
 actorUserId: userId,
 metadata: { hasConcern: true, reportId: newReport.id, referenceNumber: refNum, alert: 'CLIENT_ADMIN' },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'caseType',
 oldValue: '',
 newValue: 'WAGE_HOUR',
 actorUserId: userId,
 createdAt: now,
 },
 ...prev,
 ]);
 return newReport;
 },
 [effectiveOrgId, reports, users]
 );

 const completeWageHourIntake = useCallback(
 (reportId: string, intake: WageHourIntakeData) => {
 const now = new Date();
 const submitted: WageHourIntakeData = { ...intake, submittedAt: now };
 setReports((prev) =>
 prev.map((r) =>
 r.id === reportId
 ? {
 ...r,
 wageHourIntake: submitted,
 needsExtendedWageHourIntake: false,
 wageHourIntakeCompletedAt: now,
 status: 'PENDING_WAGE_HOUR_REVIEW',
 description: intake.concernDescription,
 summary: `Wage & Hour: ${intake.issueTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}`,
 updatedAt: now,
 handlingLedger: [
 ...(r.handlingLedger ?? []),
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Employee completed wage & hour intake form.',
 createdAt: now,
 createdBy: r.createdByUserId,
 },
 ],
 }
 : r
 )
 );
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SUBMITTED',
 actorUserId: reports.find((r) => r.id === reportId)?.createdByUserId,
 metadata: { reportId },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: reportId,
 field: 'wageHourIntake',
 oldValue: 'draft',
 newValue: 'submitted',
 actorUserId: reports.find((r) => r.id === reportId)?.createdByUserId ?? currentUser.id,
 createdAt: now,
 },
 ...prev,
 ]);
 },
 [reports, currentUser.id]
 );

 /** Payroll memo only: quick flag with no employee details - skips triage, 24h admin SLA. */
 const submitExpeditedPayrollReport = useCallback(
 (
 userId: string,
 opts?: {
 deliveryId?: string;
 promptId?: string;
 promptNotes?: string;
 sourceType?: Report['reportSourceType'];
 }
 ) => {
 const now = new Date();
 const slaDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WAGE_HOUR');
 const defaultAdmin = users.find((u) => u.role === 'ADMIN' || u.role === 'HR');

 let responseId: string | undefined;
 if (opts?.deliveryId) {
 const delivery = deliveries.find((d) => d.id === opts.deliveryId);
 if (delivery) {
 const note =
 opts.promptNotes ??
 'Payroll memo: employee reported a payroll issue with no additional details (expedited 24h path).';
 const response = submitPromptResponse(delivery.id, 'HAS_ISSUE', note);
 responseId = response?.id;
 if (responseId) {
 setResponses((prev) =>
 prev.map((r) =>
 r.id === responseId
 ? { ...r, needsReview: false, reviewedAt: now }
 : r
 )
 );
 }
 }
 }

 const intakeNote =
 'Employee reported a payroll issue through the expedited payroll memo path. No additional details were provided. Administrator must review and resolve within 24 hours.';

 const newReport: Report = {
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 sourcePromptId: opts?.promptId,
 sourcePromptResponseId: responseId,
 reportSourceType: opts?.sourceType ?? 'WAGE_HOUR_PROMPT',
 caseType: 'WAGE_HOUR',
 referenceNumber: refNum,
 category: 'WAGE_HOURS',
 severity: 'HIGH',
 summary: 'Payroll issue - expedited (no details)',
 description: intakeNote,
 status: 'PAYROLL_EXPEDITED',
 assignedTo: defaultAdmin?.id,
 expeditedPayroll: true,
 payrollSlaDueAt: slaDue,
 needsExtendedWageHourIntake: false,
 wageHourIntakeCompletedAt: now,
 wageHourIntake: {
 issueTypes: ['OTHER'],
 concernDescription: intakeNote,
 submittedAt: now,
 },
 handlingLedger: [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Expedited payroll memo submitted. Routed directly to administrator - triage skipped. 24-hour resolution SLA.',
 createdAt: now,
 createdBy: userId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };

 setReports((prev) => [newReport, ...prev]);
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'PAYROLL_EXPEDITED',
 actorUserId: userId,
 metadata: {
 reportId: newReport.id,
 referenceNumber: refNum,
 payrollSlaDueAt: slaDue.toISOString(),
 alert: 'ADMIN_24H',
 },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'status',
 oldValue: '',
 newValue: 'PAYROLL_EXPEDITED',
 actorUserId: userId,
 createdAt: now,
 reason: 'Expedited payroll memo - no triage',
 },
 ...prev,
 ]);

 return newReport;
 },
 [effectiveOrgId, reports, users, deliveries, submitPromptResponse]
 );
 
 // Update report status
 const updateReportStatus = useCallback((
 reportId: string,
 newStatus: ReportStatus,
 _note?: string,
 assignedTo?: string
 ) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();
 const oldStatus = report.status;
 
 setReports(prev => prev.map(r => 
 r.id === reportId 
 ? { 
 ...r, 
 status: newStatus, 
 assignedTo: assignedTo || r.assignedTo,
 updatedAt: now 
 }
 : r
 ));
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_STATUS_CHANGED',
 actorUserId: currentUser.id,
 metadata: { reportId, from: oldStatus, to: newStatus },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);
 const statusEvent: ReportStatusEvent = {
 id: `status-event-${Date.now()}`,
 orgId: effectiveOrgId,
 reportId,
 fromStatus: oldStatus,
 toStatus: newStatus,
 changedBy: currentUser.id,
 note: _note,
 createdAt: now,
 updatedAt: now,
 };
 setReportStatusEvents((prev) => [statusEvent, ...prev]);
 }, [reports, currentUser.id]);
 
 // Assign report
 const assignReport = useCallback((reportId: string, adminId: string) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();
 
 setReports(prev => prev.map(r => 
 r.id === reportId 
 ? { ...r, assignedTo: adminId, status: 'ASSIGNED', updatedAt: now }
 : r
 ));
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_ASSIGNED',
 actorUserId: currentUser.id,
 metadata: { reportId, assignedTo: adminId },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);
 if (report.status !== 'ASSIGNED') {
 const statusEvent: ReportStatusEvent = {
 id: `status-event-${Date.now()}`,
 orgId: effectiveOrgId,
 reportId,
 fromStatus: report.status,
 toStatus: 'ASSIGNED',
 changedBy: currentUser.id,
 note: `Assigned to ${adminId}`,
 createdAt: now,
 updatedAt: now,
 };
 setReportStatusEvents((prev) => [statusEvent, ...prev]);
 }
 }, [reports, currentUser.id]);
 
 // Create investigation
 const createInvestigation = useCallback((reportId: string, ownerId: string) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();
 
 const refNum =
 report.referenceNumber ??
 allocateCaseReferenceNumber(reports, report.orgId, report.caseType ?? 'WORKPLACE_INVESTIGATION');
 const prompt = report.sourcePromptId ? prompts.find((p) => p.id === report.sourcePromptId) : undefined;
 const sourceType = inferReportSourceType(report, prompt);
 const priority: InvestigationPriority =
 report.severity === 'CRITICAL' ? 'CRITICAL' : report.severity === 'HIGH' ? 'HIGH' : report.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';
 const stageHistory = [
 buildStageHistoryEntry('INTAKE_RECEIVED', currentUser.id, ownerId, 'Investigation shell created from linked report'),
 buildStageHistoryEntry('PENDING_REVIEW', currentUser.id, ownerId),
 ];
 const newInvestigation: Investigation = {
 id: `inv-${Date.now()}`,
 orgId: effectiveOrgId,
 referenceNumber: refNum,
 status: 'OPEN',
 ownerId,
 linkedReportIds: [reportId],
 category: report.category,
 severity: report.severity,
 priority,
 riskLevel: report.severity === 'CRITICAL' || report.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
 reportSourceType: sourceType,
 linkedPromptId: report.sourcePromptId,
 linkedPromptResponseId: report.sourcePromptResponseId,
 openedAt: now,
 lastUpdateAt: now,
 createdAt: now,
 updatedAt: now,
 workflowPhase: 'QUEUED',
 stage: 'PENDING_REVIEW',
 stageHistory,
 checklistStages: buildDefaultChecklistStages(),
 subjectUserIds:
 report.createdByUserId && !report.isAnonymous ? [report.createdByUserId] : [],
 persons: [],
 notes: [],
 workflowPagesCompleted: { intake: false, gathering: false, outcome: false },
 };
 
 setInvestigations(prev => [...prev, newInvestigation]);
 
 const checklist = (report.responseChecklist ?? []).length > 0 ? report.responseChecklist : createIndustryChecklistForReport();
 setReports(prev => prev.map(r => 
 r.id === reportId 
 ? {
 ...r,
 investigationId: newInvestigation.id,
 referenceNumber: r.referenceNumber ?? refNum,
 responseChecklist: checklist,
 updatedAt: now,
 }
 : r
 ));
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_CREATED',
 actorUserId: currentUser.id,
 metadata: { investigationId: newInvestigation.id, reportId },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);

 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}-inv`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: newInvestigation.id,
 field: 'status',
 oldValue: '',
 newValue: 'OPEN',
 actorUserId: currentUser.id,
 createdAt: now,
 reason: `Investigation created from report ${reportId}`,
 },
 {
 id: `audit-${Date.now()}-report`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: reportId,
 field: 'investigationId',
 oldValue: '',
 newValue: newInvestigation.id,
 actorUserId: currentUser.id,
 createdAt: now,
 },
 ...prev,
 ]);
 
 return newInvestigation;
 }, [reports, investigations, currentUser.id]);

 const appendInvestigationAudit = useCallback(
 (investigationId: string, field: string, oldValue: string, newValue: string, reason?: string) => {
 const entry: AuditLogEntry = {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: investigationId,
 field,
 oldValue,
 newValue,
 actorUserId: currentUser.id,
 createdAt: new Date(),
 reason,
 };
 setAuditLogs((prev) => [entry, ...prev]);
 },
 [currentUser.id]
 );

 const advanceInvestigationStage = useCallback(
 (investigationId: string, stage: InvestigationStage, note?: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => {
 if (inv.id !== investigationId) return inv;
 const history = [...(inv.stageHistory ?? []), buildStageHistoryEntry(stage, currentUser.id, inv.ownerId, note)];
 return {
 ...inv,
 stage,
 stageHistory: history,
 lastUpdateAt: now,
 updatedAt: now,
 workflowPhase:
 stage === 'IN_PROGRESS' || stage === 'EMPLOYEE_FOLLOW_UP' || stage === 'EVIDENCE_REVIEW'
 ? 'IN_PROGRESS'
 : stage === 'OUTCOME_PENDING'
 ? 'AWAITING_OUTCOME_ACK'
 : inv.workflowPhase,
 };
 })
 );
 appendInvestigationAudit(investigationId, 'stage', '', stage, note);
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const assignInvestigationOwner = useCallback(
 (investigationId: string, ownerId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 ownerId,
 stage: inv.stage === 'PENDING_REVIEW' || !inv.stage ? 'ASSIGNED' : inv.stage,
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('ASSIGNED', currentUser.id, ownerId, 'Lead investigator assigned'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'ownerId', '', ownerId);
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const setInvestigationPersons = useCallback((investigationId: string, persons: InvestigationPerson[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, persons, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const updateInvestigationChecklist = useCallback(
 (investigationId: string, stages: InvestigationChecklistStage[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, checklistStages: stages, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 },
 []
 );

 const addInvestigationEvidence = useCallback(
 (investigationId: string, record: Omit<InvestigationEvidenceRecord, 'id' | 'uploadedAt' | 'uploadedByUserId' | 'preserved'>) => {
 const now = new Date();
 const entry: InvestigationEvidenceRecord = {
 ...record,
 id: `ev-${Date.now()}`,
 uploadedAt: now,
 uploadedByUserId: currentUser.id,
 preserved: true,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, evidenceRecords: [...(inv.evidenceRecords ?? []), entry], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'evidence', '', entry.fileName, 'Evidence uploaded');
 return entry;
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const addInvestigationResponseRequest = useCallback(
 (investigationId: string, payload: Omit<InvestigationResponseRequest, 'id' | 'createdAt' | 'createdByUserId' | 'status'>) => {
 const now = new Date();
 const req: InvestigationResponseRequest = {
 ...payload,
 id: `req-${Date.now()}`,
 status: payload.sentAt ? 'SENT' : 'DRAFT',
 createdAt: now,
 createdByUserId: currentUser.id,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 responseRequests: [...(inv.responseRequests ?? []), req],
 stage: inv.stage === 'IN_PROGRESS' ? 'EMPLOYEE_FOLLOW_UP' : inv.stage,
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'responseRequest', '', req.id, 'Response request created');
 return req;
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const updateInvestigationResponseRequest = useCallback(
 (investigationId: string, requestId: string, patch: Partial<InvestigationResponseRequest>) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 responseRequests: (inv.responseRequests ?? []).map((r) => (r.id === requestId ? { ...r, ...patch } : r)),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const submitEmployeeInvestigationResponse = useCallback(
 (investigationId: string, requestId: string, responseText: string) => {
 const inv = investigations.find((i) => i.id === investigationId);
 const req = inv?.responseRequests?.find((r) => r.id === requestId);
 if (!inv || !req || req.partyUserId !== currentUser.id) return false;
 const trimmed = responseText.trim();
 if (!trimmed) return false;
 const now = new Date();
 updateInvestigationResponseRequest(investigationId, requestId, {
 status: 'SUBMITTED',
 submittedAt: now,
 viewedAt: req.viewedAt ?? now,
 responseText: trimmed,
 });
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, requestId, action: 'EMPLOYEE_RESPONSE_SUBMITTED' },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: investigationId,
 field: 'responseRequest',
 oldValue: req.status,
 newValue: 'SUBMITTED',
 actorUserId: currentUser.id,
 createdAt: now,
 reason: `Employee response on request ${requestId}`,
 },
 ...prev,
 ]);
 return true;
 },
 [investigations, currentUser.id, updateInvestigationResponseRequest]
 );

 const updateInvestigationAnalysis = useCallback(
 (
 investigationId: string,
 patch: {
 findingsRationale?: string;
 policyAnalysisNotes?: string;
 linkedPolicyIds?: string[];
 finalFindingsReport?: string;
 legalInvolved?: boolean;
 legalInvolvementNotes?: string;
 }
 ) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => (inv.id === investigationId ? { ...inv, ...patch, lastUpdateAt: now, updatedAt: now } : inv))
 );
 },
 []
 );

 const addCorrectiveAction = useCallback(
 (investigationId: string, payload: Omit<InvestigationCorrectiveAction, 'id' | 'createdAt' | 'createdByUserId' | 'status'>) => {
 const now = new Date();
 const action: InvestigationCorrectiveAction = {
 ...payload,
 id: `ca-${Date.now()}`,
 status: 'PENDING',
 createdAt: now,
 createdByUserId: currentUser.id,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, correctiveActions: [...(inv.correctiveActions ?? []), action], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 return action;
 },
 [currentUser.id]
 );

 const updateCorrectiveAction = useCallback(
 (investigationId: string, actionId: string, patch: Partial<InvestigationCorrectiveAction>) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 correctiveActions: (inv.correctiveActions ?? []).map((a) =>
 a.id === actionId ? { ...a, ...patch, completedAt: patch.status === 'COMPLETE' ? now : a.completedAt } : a
 ),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const addFollowUp = useCallback(
 (investigationId: string, payload: Omit<InvestigationFollowUp, 'id' | 'createdAt' | 'status'>) => {
 const now = new Date();
 const followUp: InvestigationFollowUp = {
 ...payload,
 id: `fu-${Date.now()}`,
 status: 'SCHEDULED',
 createdAt: now,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, followUps: [...(inv.followUps ?? []), followUp], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 return followUp;
 },
 []
 );

 const completeFollowUp = useCallback(
 (investigationId: string, followUpId: string, notes?: string, concernLogged?: boolean) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 followUps: (inv.followUps ?? []).map((f) =>
 f.id === followUpId ? { ...f, status: 'COMPLETE', completedAt: now, notes, concernLogged } : f
 ),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const sendNonRetaliationReminder = useCallback(
 (investigationId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, nonRetaliationSentAt: now, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 appendInvestigationAudit(investigationId, 'nonRetaliation', '', 'sent', 'Non-retaliation reminder auto-sent');
 },
 [appendInvestigationAudit]
 );

 const setInvestigationOutcomeClassification = useCallback(
 (investigationId: string, classification: OutcomeClassification) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, outcomeClassification: classification, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 },
 []
 );

 const pickUpInvestigation = useCallback(
 (investigationId: string, preferred: InvestigationEmployeeContactPreference) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 workflowPhase: 'IN_PROGRESS',
 stage: 'IN_PROGRESS',
 pickedUpAt: now,
 employeePreferredContact: preferred,
 ownerId: currentUser.id,
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('IN_PROGRESS', currentUser.id, currentUser.id, 'Investigator opened case'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'PICKED_UP' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const setInvestigationInitialContactNotes = useCallback((investigationId: string, notes: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, initialContactNotes: notes, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const markInvestigationPageComplete = useCallback(
 (investigationId: string, page: 'intake' | 'gathering' | 'outcome') => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => {
 if (inv.id !== investigationId) return inv;
 const completed = { ...(inv.workflowPagesCompleted ?? {}), [page]: true };
 return { ...inv, workflowPagesCompleted: completed, lastUpdateAt: now, updatedAt: now };
 })
 );
 },
 []
 );

 const setInvestigationSubjectUsers = useCallback((investigationId: string, subjectUserIds: string[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, subjectUserIds, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const addInvestigationNote = useCallback(
 (
 investigationId: string,
 payload: {
 visibility: InvestigationNote['visibility'];
 body: string;
 attachments?: InvestigationAttachment[];
 requiresEmployeeSignature?: boolean;
 noteType?: InvestigationNoteType;
 taggedUserIds?: string[];
 }
 ) => {
 const now = new Date();
 const note: InvestigationNote = {
 id: `inv-note-${Date.now()}`,
 visibility: payload.visibility,
 body: payload.body,
 createdAt: now,
 createdByUserId: currentUser.id,
 attachments: payload.attachments,
 requiresEmployeeSignature: payload.requiresEmployeeSignature,
 noteType: payload.noteType,
 taggedUserIds: payload.taggedUserIds,
 sentAt: payload.visibility === 'EMPLOYEE' ? now : undefined,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, notes: [...(inv.notes ?? []), note], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, noteId: note.id },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const sendInvestigationOutcomeToEmployee = useCallback(
 (
 investigationId: string,
 payload: {
 summary: string;
 requiresSignature: boolean;
 attachment?: InvestigationAttachment;
 }
 ) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 outcomeSummary: payload.summary,
 outcomeRequiresSignature: payload.requiresSignature,
 outcomeAttachment: payload.attachment,
 outcomeSentAt: now,
 outcomeEmployeeAgreed: null,
 outcomeEmployeeSignedAt: undefined,
 workflowPhase: 'AWAITING_OUTCOME_ACK',
 stage: 'OUTCOME_PENDING',
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('OUTCOME_PENDING', currentUser.id, inv.ownerId, 'Outcome sent to employee'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'OUTCOME_SENT' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const employeeAcknowledgeInvestigationOutcome = useCallback(
 (investigationId: string, agreed: boolean) => {
 const inv = investigations.find((i) => i.id === investigationId);
 if (!inv) return;
 const primaryReport = reports.find((r) => inv.linkedReportIds.includes(r.id));
 if (!primaryReport || primaryReport.createdByUserId !== currentUser.id) return;
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((i) =>
 i.id === investigationId
 ? {
 ...i,
 outcomeEmployeeSignedAt: now,
 outcomeEmployeeAgreed: agreed,
 lastUpdateAt: now,
 updatedAt: now,
 }
 : i
 )
 );
 },
 [investigations, reports, currentUser.id]
 );

 const closeInvestigation = useCallback((investigationId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 status: 'CLOSED',
 stage: 'CLOSED',
 closedAt: now,
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('CLOSED', currentUser.id, inv.ownerId, 'Investigation closed'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'CLOSED' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 }, [currentUser.id]);

 const completeIncidentIntake = useCallback(
 (
 reportId: string,
 payload: { description: string; peopleInvolved?: string; location?: string }
 ) => {
 const report = reports.find((r) => r.id === reportId);
 if (!report || report.createdByUserId !== currentUser.id) return;
 const now = new Date();
 setReports((prev) =>
 prev.map((r) =>
 r.id === reportId
 ? {
 ...r,
 description: payload.description,
 peopleInvolved: payload.peopleInvolved ?? r.peopleInvolved,
 location: payload.location ?? r.location,
 incidentIntakeCompletedAt: now,
 updatedAt: now,
 }
 : r
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_STATUS_CHANGED',
 actorUserId: currentUser.id,
 metadata: { reportId, action: 'INCIDENT_INTAKE_COMPLETED' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [reports, currentUser.id]
 );
 
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
 }, [currentUser.id]);

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
 
 return newPrompt;
 }, [users, currentUser.id]);

 const updatePrompt = useCallback((promptId: string, updates: Partial<Prompt>) => {
 setPrompts((prev) => prev.map((prompt) => (prompt.id === promptId ? { ...prompt, ...updates, updatedAt: new Date() } : prompt)));
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
 return policy;
 }, []);

 const updatePolicy = useCallback((id: string, updates: Partial<Policy>) => {
 setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)));
 }, []);

 const acknowledgePolicy = useCallback(
 (
 policyId: string,
 userId: string,
 opts?: {
 outcome?: 'READ_UNDERSTOOD' | 'REQUEST_CLARIFICATION';
 signatureDataUrl?: string;
 clarificationNote?: string;
 }
 ) => {
 setPolicyAcknowledgements((prev) => {
 const existing = prev.find((ack) => ack.policyId === policyId && ack.userId === userId);
 if (existing) {
 return prev.map((ack) =>
 ack.policyId === policyId && ack.userId === userId
 ? {
 ...ack,
 acknowledgedAt: new Date(),
 outcome: opts?.outcome ?? ack.outcome ?? 'READ_UNDERSTOOD',
 signatureDataUrl: opts?.signatureDataUrl ?? ack.signatureDataUrl,
 clarificationNote: opts?.clarificationNote ?? ack.clarificationNote,
 }
 : ack
 );
 }
 return [
 ...prev,
 {
 policyId,
 userId,
 acknowledgedAt: new Date(),
 outcome: opts?.outcome ?? 'READ_UNDERSTOOD',
 signatureDataUrl: opts?.signatureDataUrl,
 clarificationNote: opts?.clarificationNote,
 },
 ];
 });
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

 const addReportMessage = useCallback((reportId: string, body: string) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 messages: [...(report.messages ?? []), { id: `msg-${Date.now()}`, authorUserId: currentUser.id, body, createdAt: now }],
 updatedAt: now,
 }
 : report
 )
 );
 }, [currentUser.id]);

 const addReportHandlingEntry = useCallback((reportId: string, type: ReportHandlingEntryType, text: string) => {
 if (!text.trim()) return;
 const now = new Date();
 const entry: ReportHandlingEntry = {
 id: `ledger-${Date.now()}`,
 type,
 text: text.trim(),
 createdAt: now,
 createdBy: currentUser.id,
 };
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 handlingLedger: [...(report.handlingLedger ?? []), entry],
 updatedAt: now,
 }
 : report
 )
 );
 }, [currentUser.id]);

 const addReportLedgerFile = useCallback((reportId: string, file: File) => {
 const now = new Date();
 const reader = new FileReader();
 reader.onload = () => {
 const dataUrl = reader.result as string;
 const entry: ReportHandlingEntry = {
 id: `ledger-${Date.now()}`,
 type: 'FILE',
 text: file.name,
 createdAt: now,
 createdBy: currentUser.id,
 fileFileName: file.name,
 fileSize: file.size,
 fileDataUrl: dataUrl,
 };
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 handlingLedger: [...(report.handlingLedger ?? []), entry],
 updatedAt: now,
 }
 : report
 )
 );
 };
 reader.readAsDataURL(file);
 }, [currentUser.id]);

 const updateReportHandling = useCallback(
 (
 reportId: string,
 updates: Pick<
 Report,
 'responsePlan' | 'responseActionTaken' | 'employeeResponseOutcome' | 'ginaBuildNotes' | 'evidenceMetadata'
 >
 ) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 ...updates,
 updatedAt: now,
 }
 : report
 )
 );
 },
 []
 );

 const toggleReportChecklistItem = useCallback((reportId: string, itemId: string, completed: boolean) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 responseChecklist: (report.responseChecklist ?? []).map((item) =>
 item.id === itemId
 ? {
 ...item,
 completed,
 completedAt: completed ? now : undefined,
 completedBy: completed ? currentUser.id : undefined,
 }
 : item
 ),
 updatedAt: now,
 }
 : report
 )
 );
 }, [currentUser.id]);

 const updateReportChecklistItemEvidence = useCallback(
 (
 reportId: string,
 itemId: string,
 updates: {
 completed?: boolean;
 evidenceNote?: string;
 evidenceFileFileName?: string;
 evidenceFileDataUrl?: string;
 }
 ) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 responseChecklist: (report.responseChecklist ?? []).map((item) =>
 item.id === itemId
 ? {
 ...item,
 ...(updates.completed !== undefined && {
 completed: updates.completed,
 completedAt: updates.completed ? now : undefined,
 completedBy: updates.completed ? currentUser.id : undefined,
 }),
 ...(updates.evidenceNote !== undefined && { evidenceNote: updates.evidenceNote }),
 ...(updates.evidenceFileFileName !== undefined && {
 evidenceFileFileName: updates.evidenceFileFileName,
 evidenceFileDataUrl: updates.evidenceFileDataUrl,
 }),
 }
 : item
 ),
 updatedAt: now,
 }
 : report
 )
 );
 },
 [currentUser.id]
 );

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
 return prev.map((user) => (user.id === userId ? next : user));
 });
 if (auditEntries.length) {
 setAuditLogs((prev) => [...auditEntries, ...prev]);
 }
 }, [currentUser.id]);

 const createUsers = useCallback((newUsers: Array<Omit<User, 'id' | 'orgId' | 'createdAt' | 'updatedAt'> & { id?: string }>) => {
 const now = new Date();
 const slug = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'user';
 setUsers((prev) => {
 const existingIds = new Set(prev.map((u) => u.id));
 return [
 ...prev,
 ...newUsers.map((user, index) => {
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
 }),
 ];
 });
 }, []);
 
 // Get filtered reports (org-scoped)
 const getFilteredReports = useCallback((filters: {
 status?: ReportStatus[];
 severity?: string[];
 category?: string[];
 assignedTo?: string | null;
 search?: string;
 }) => {
 let filtered = [...effectiveReports];
 
 if (filters.status) {
 filtered = filtered.filter(r => filters.status!.includes(r.status));
 }
 
 if (filters.severity) {
 filtered = filtered.filter(r => filters.severity!.includes(r.severity));
 }
 
 if (filters.category) {
 filtered = filtered.filter(r => filters.category!.includes(r.category));
 }
 
 if (filters.assignedTo !== undefined) {
 if (filters.assignedTo === null) {
 filtered = filtered.filter(r => !r.assignedTo);
 } else {
 filtered = filtered.filter(r => r.assignedTo === filters.assignedTo);
 }
 }
 
 if (filters.search) {
 const searchLower = filters.search.toLowerCase();
 filtered = filtered.filter(r => 
 r.summary.toLowerCase().includes(searchLower) ||
 r.description.toLowerCase().includes(searchLower)
 );
 }
 
 return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 }, [effectiveReports]);
 
 // Get filtered investigations (org-scoped)
 const getFilteredInvestigations = useCallback((filters: {
 status?: Investigation['status'];
 ownerId?: string;
 }) => {
 let filtered = [...effectiveInvestigations];
 
 if (filters.status) {
 filtered = filtered.filter(i => i.status === filters.status);
 }
 
 if (filters.ownerId) {
 filtered = filtered.filter(i => i.ownerId === filters.ownerId);
 }
 
 return filtered.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
 }, [effectiveInvestigations]);
 
 // Get filtered employees (org-scoped)
 const getFilteredEmployees = useCallback((filters: {
 atRiskOnly?: boolean;
 neverResponded?: boolean;
 lowEngagement?: boolean;
 departmentId?: string;
 }) => {
 let filtered = effectiveUsers.filter(u => u.role === 'EMPLOYEE');
 
 if (filters.departmentId) {
 filtered = filtered.filter(u => u.departmentId === filters.departmentId);
 }
 
 if (filters.atRiskOnly) {
 const now = new Date();
 const atRiskIds = effectiveUsers
 .filter((u) => u.role === 'EMPLOYEE' && u.status === 'active')
 .filter((emp) => {
 const employeeResponses = effectiveResponses.filter((r) => r.userId === emp.id);
 const lastResponseAt = employeeResponses.length
 ? new Date(Math.max(...employeeResponses.map((r) => r.submittedAt.getTime())))
 : undefined;
 const deliveries30d = effectiveDeliveries.filter(
 (d) => d.userId === emp.id && now.getTime() - d.deliveredAt.getTime() <= 30 * 24 * 60 * 60 * 1000
 );
 const completed30d = deliveries30d.filter((d) => d.status === 'COMPLETED').length;
 const responseRate30d = deliveries30d.length ? completed30d / deliveries30d.length : 0;
 const daysSinceLastResponse = lastResponseAt
 ? Math.floor((now.getTime() - lastResponseAt.getTime()) / (1000 * 60 * 60 * 24))
 : Infinity;
 return (
 !lastResponseAt ||
 daysSinceLastResponse > orgSettings.thresholds.atRiskNoResponseDays ||
 responseRate30d < orgSettings.thresholds.atRiskMinResponseRate
 );
 })
 .map((u) => u.id);
 filtered = filtered.filter((u) => atRiskIds.includes(u.id));
 }
 
 return filtered;
 }, [effectiveUsers, effectiveResponses, effectiveDeliveries, orgSettings.thresholds.atRiskMinResponseRate, orgSettings.thresholds.atRiskNoResponseDays]);
 
 // Derived data (computed from org-scoped collections)
 const computeAtRiskEmployees = useCallback(() => {
 const employees = effectiveUsers.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
 const now = new Date();
 return employees.map((emp) => {
 const employeeResponses = effectiveResponses.filter((r) => r.userId === emp.id);
 const lastResponseAt = employeeResponses.length
 ? new Date(Math.max(...employeeResponses.map((r) => r.submittedAt.getTime())))
 : undefined;
 const deliveries30d = effectiveDeliveries.filter(
 (d) => d.userId === emp.id && now.getTime() - d.deliveredAt.getTime() <= 30 * 24 * 60 * 60 * 1000
 );
 const completed30d = deliveries30d.filter((d) => d.status === 'COMPLETED').length;
 const responseRate30d = deliveries30d.length ? completed30d / deliveries30d.length : 0;
 const daysSinceLastResponse = lastResponseAt
 ? Math.floor((now.getTime() - lastResponseAt.getTime()) / (1000 * 60 * 60 * 24))
 : Infinity;
 const isAtRisk =
 !lastResponseAt ||
 daysSinceLastResponse > orgSettings.thresholds.atRiskNoResponseDays ||
 responseRate30d < orgSettings.thresholds.atRiskMinResponseRate;
 return {
 userId: emp.id,
 lastResponseAt,
 responseRate30d,
 pendingPrompts: effectiveDeliveries.filter((d) => d.userId === emp.id && d.status === 'PENDING').length,
 isAtRisk,
 };
 }).filter((e) => e.isAtRisk);
 }, [effectiveDeliveries, effectiveResponses, effectiveUsers, orgSettings.thresholds.atRiskMinResponseRate, orgSettings.thresholds.atRiskNoResponseDays]);

 const computeEmployeeEngagement = useCallback((userId: string) => {
 const now = new Date();
 const employeeResponses = effectiveResponses.filter((r) => r.userId === userId);
 const lastResponseAt = employeeResponses.length
 ? new Date(Math.max(...employeeResponses.map((r) => r.submittedAt.getTime())))
 : undefined;
 const deliveries30d = effectiveDeliveries.filter(
 (d) => d.userId === userId && now.getTime() - d.deliveredAt.getTime() <= 30 * 24 * 60 * 60 * 1000
 );
 const completed30d = deliveries30d.filter((d) => d.status === 'COMPLETED').length;
 const responseRate30d = deliveries30d.length ? completed30d / deliveries30d.length : 0;
 const daysSinceLastResponse = lastResponseAt
 ? Math.floor((now.getTime() - lastResponseAt.getTime()) / (1000 * 60 * 60 * 24))
 : Infinity;
 return {
 userId,
 lastResponseAt,
 responseRate30d,
 pendingPrompts: effectiveDeliveries.filter((d) => d.userId === userId && d.status === 'PENDING').length,
 isAtRisk:
 !lastResponseAt ||
 daysSinceLastResponse > orgSettings.thresholds.atRiskNoResponseDays ||
 responseRate30d < orgSettings.thresholds.atRiskMinResponseRate,
 };
 }, [effectiveDeliveries, effectiveResponses, orgSettings.thresholds.atRiskMinResponseRate, orgSettings.thresholds.atRiskNoResponseDays]);

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
 unansweredPromptDeliveries: effectiveDeliveries.filter((d) => d.status === 'PENDING').length,
 reportsNeedingClarification: effectiveReports.filter((r) => r.status === 'NEEDS_INFO').length,
 memoAcknowledgementsPending: (() => {
 const activeEmployees = effectiveUsers.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
 const requiredPolicies = effectivePolicies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
 const totalRequiredAcks = activeEmployees.length * requiredPolicies.length;
 return Math.max(0, totalRequiredAcks - effectivePolicyAcknowledgements.length);
 })(),
 memosNeedingClarification: effectivePolicyAcknowledgements.filter((a) => a.outcome === 'REQUEST_CLARIFICATION').length,
 actionRequiredTotal: 0,
 openCaseRegisterCount: effectiveReports.filter((r) => {
 if (['RESOLVED', 'CLOSED'].includes(r.status)) return false;
 if (!r.investigationId) return true;
 const inv = effectiveInvestigations.find((i) => i.id === r.investigationId);
 return inv?.status !== 'OPEN';
 }).length,
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
 const dashboardCountsWithWorkload = {
 ...dashboardCounts,
 openInvestigationWorkload: investigationWorkload.totalCount,
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
