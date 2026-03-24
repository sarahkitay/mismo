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
  Nudge,
  ActivityEvent,
  ReportStatusEvent,
  Policy,
  PolicyAcknowledgement,
  Announcement,
  ReportHandlingEntry,
  ReportHandlingEntryType,
  ReportChecklistItem,
} from '@/types';
import {
  mockUsers,
  mockReports,
  mockPrompts,
  mockPromptDeliveries,
  mockPromptResponses,
  mockInvestigations,
  mockNudges,
  mockActivityEvents,
  mockReportStatusEvents,
  mockOrg,
  mockPolicies,
  mockPolicyAcknowledgements,
  mockAnnouncements,
} from '@/data/mockData';
import { INDUSTRY_CHECKLIST_SECTIONS } from '@/data/industryChecklist';

function normalizeUserRoles(list: User[]): User[] {
  return list.map((user) => (user.role === 'MANAGER' ? { ...user, role: 'HR' as UserRole } : user));
}

/** Canonical seed users (login + fresh installs); persisted lists can lag behind mock email changes */
const SEED_USERS = normalizeUserRoles(mockUsers);

// Current user (for demo, we can switch between employee and admin)
const CURRENT_USER_ID = 'user-emp-1'; // Default to employee (demo fallback)
const CURRENT_HR_ID = 'user-manager-1';
const CURRENT_ADMIN_ID = 'user-admin-1'; // Admin user
const CURRENT_CLIENT_ID = 'user-client-1';
const STORAGE_KEY = 'mismo_app_v2';
const SESSION_KEY = 'mismo_session';

/** Legacy / alternate demo addresses → canonical seed email (lowercase) */
const LOGIN_EMAIL_ALIASES: Record<string, string> = {
  'admin@mismo.com': 'hr@mismo.com',
};

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
  const persisted = typeof window !== 'undefined' ? readPersistedState() : null;

  // State
  const [users, setUsers] = useState<User[]>(
    persisted?.users ? normalizeUserRoles(persisted.users as User[]) : SEED_USERS
  );
  const [reports, setReports] = useState<Report[]>(persisted?.reports ?? mockReports);
  const [prompts, setPrompts] = useState<Prompt[]>(persisted?.prompts ?? mockPrompts);
  const [deliveries, setDeliveries] = useState<PromptDelivery[]>(persisted?.deliveries ?? mockPromptDeliveries);
  const [responses, setResponses] = useState<PromptResponse[]>(persisted?.responses ?? mockPromptResponses);
  const [investigations, setInvestigations] = useState<Investigation[]>(persisted?.investigations ?? mockInvestigations);
  const [nudges, setNudges] = useState<Nudge[]>(persisted?.nudges ?? mockNudges);
  const [activities, setActivities] = useState<ActivityEvent[]>(persisted?.activities ?? mockActivityEvents);
  const [reportStatusEvents, setReportStatusEvents] = useState<ReportStatusEvent[]>(
    persisted?.reportStatusEvents ?? mockReportStatusEvents
  );
  const [policies, setPolicies] = useState<Policy[]>(persisted?.policies ?? mockPolicies);
  const [policyAcknowledgements, setPolicyAcknowledgements] = useState<PolicyAcknowledgement[]>(
    persisted?.policyAcknowledgements ?? mockPolicyAcknowledgements
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(persisted?.announcements ?? mockAnnouncements);
  const [currentRole, setCurrentRole] = useState<UserRole>(
    persisted?.currentRole === 'MANAGER' ? 'HR' : (persisted?.currentRole ?? 'EMPLOYEE')
  );
  const [session, setSessionState] = useState<Session | null>(readSession);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const lastDailyDeliveryDateRef = useRef<string | null>(null);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    writeSession(s);
  }, []);

  const login = useCallback((email: string, orgId?: string): boolean => {
    const raw = email.trim().toLowerCase();
    const normalized = LOGIN_EMAIL_ALIASES[raw] ?? raw;

    const findByEmail = (list: User[]) =>
      list.find((u) => u.email.toLowerCase() === normalized && (orgId == null || u.orgId === orgId));

    let found = findByEmail(users);
    if (!found) {
      found = findByEmail(SEED_USERS);
      if (found && !users.some((u) => u.id === found!.id)) {
        setUsers((prev) => [...prev, found!]);
      }
    }
    if (!found) return false;
    setSession({ userId: found.id, orgId: found.orgId, role: found.role });
    setCurrentRole(found.role);
    if (typeof window !== 'undefined') {
      const path =
        found.role === 'EMPLOYEE'
          ? '/employee/dashboard'
          : found.role === 'CLIENT'
            ? '/admin/client-dashboard'
            : '/admin/dashboard';
      window.history.replaceState({}, '', path);
    }
    return true;
  }, [users, setSession, setUsers]);

  const logout = useCallback(() => {
    setSession(null);
    setPreviewUserId(null);
  }, [setSession]);

  useEffect(() => {
    setCurrentRole((prev) => (prev === 'MANAGER' ? 'HR' : prev));
    setPrompts((prev) =>
      prev.map((prompt) =>
        prompt.id === 'prompt-1'
          ? {
              ...prompt,
              title: 'Incident Prompt',
              description:
                'Compliance Check-In Required. Confirm no issue is present or open a case file for procedural review.',
            }
          : prompt
      )
    );
  }, []);

  useEffect(() => {
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
        currentRole,
      })
    );
  }, [
    activities,
    announcements,
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
  ]);

  // Ensure employee has a daily prompt when they open the app (new day = new prompt)
  useEffect(() => {
    if (!session || session.role !== 'EMPLOYEE') return;
    const orgId = session.orgId;
    const userId = session.userId;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const dayKey = startOfToday.toDateString();
    if (lastDailyDeliveryDateRef.current === dayKey) return;
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
    lastDailyDeliveryDateRef.current = dayKey;
  }, [session, deliveries, prompts]);

  // Org-scoped data when session exists (each company sees only their data)
  const effectiveOrgId = session?.orgId ?? mockOrg.id;
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
    (currentRole === 'EMPLOYEE'
      ? users.find((u) => u.id === CURRENT_USER_ID)
      : currentRole === 'HR' || currentRole === 'MANAGER'
        ? users.find((u) => u.id === CURRENT_HR_ID)
        : currentRole === 'CLIENT'
          ? users.find((u) => u.id === CURRENT_CLIENT_ID)
          : users.find((u) => u.id === CURRENT_ADMIN_ID))!;
  const effectiveCurrentRole = previewUserId ? 'EMPLOYEE' : (session?.role ?? currentRole);

  // Get org settings
  const orgSettings = mockOrg.settings;
  
  // Switch role (for demo) - only when not in preview and session allows (HR/Client)
  const switchRole = useCallback((role: UserRole) => {
    if (previewUserId) return;
    setCurrentRole(role);
    if (session) setSession({ ...session, role });
  }, [previewUserId, session]);
  
  // Submit prompt response
  const submitPromptResponse = useCallback((
    deliveryId: string,
    answer: PromptAnswer,
    notes?: string
  ) => {
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;
    
    const now = new Date();
    
    // Create response
    const newResponse: PromptResponse = {
      id: `response-${Date.now()}`,
      orgId: delivery.orgId,
      promptId: delivery.promptId,
      promptDeliveryId: deliveryId,
      userId: delivery.userId,
      answer,
      submittedAt: now,
      notes,
      createdAt: now,
      updatedAt: now,
    };
    
    setResponses(prev => [...prev, newResponse]);
    
    // Update delivery status
    setDeliveries(prev => prev.map(d => 
      d.id === deliveryId 
        ? { ...d, status: 'COMPLETED', completedAt: now, updatedAt: now }
        : d
    ));
    
    // Add activity event
    const newActivity: ActivityEvent = {
      id: `activity-${Date.now()}`,
      orgId: delivery.orgId,
      type: 'PROMPT_RESPONSE',
      actorUserId: delivery.userId,
      metadata: { promptId: delivery.promptId, answer },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
  }, [deliveries]);
  
  // Create report
  const createReport = useCallback((reportData: Omit<Report, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const now = new Date();
    
    const newReport: Report = {
      ...reportData,
      id: `report-${Date.now()}`,
      orgId: effectiveOrgId,
      status: 'NEW',
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
      orgId: mockOrg.id,
      type: 'REPORT_CREATED',
      actorUserId: reportData.createdByUserId,
      metadata: { reportId: newReport.id, category: reportData.category },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
    
    return newReport;
  }, []);
  
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
      orgId: mockOrg.id,
      type: 'REPORT_STATUS_CHANGED',
      actorUserId: currentUser.id,
      metadata: { reportId, from: oldStatus, to: newStatus },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
    const statusEvent: ReportStatusEvent = {
      id: `status-event-${Date.now()}`,
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
      type: 'REPORT_ASSIGNED',
      actorUserId: currentUser.id,
      metadata: { reportId, assignedTo: adminId },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
    if (report.status !== 'ASSIGNED') {
      const statusEvent: ReportStatusEvent = {
        id: `status-event-${Date.now()}`,
        orgId: mockOrg.id,
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
    
    const newInvestigation: Investigation = {
      id: `inv-${Date.now()}`,
      orgId: mockOrg.id,
      status: 'OPEN',
      ownerId,
      linkedReportIds: [reportId],
      openedAt: now,
      lastUpdateAt: now,
      createdAt: now,
      updatedAt: now,
    };
    
    setInvestigations(prev => [...prev, newInvestigation]);
    
    // Update report with investigation link and ensure checklist exists for investigation workflow
    const checklist = (report.responseChecklist ?? []).length > 0 ? report.responseChecklist : createIndustryChecklistForReport();
    setReports(prev => prev.map(r => 
      r.id === reportId 
        ? { ...r, investigationId: newInvestigation.id, responseChecklist: checklist, updatedAt: now }
        : r
    ));
    
    // Add activity event
    const newActivity: ActivityEvent = {
      id: `activity-${Date.now()}`,
      orgId: mockOrg.id,
      type: 'INVESTIGATION_CREATED',
      actorUserId: currentUser.id,
      metadata: { investigationId: newInvestigation.id, reportId },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
    
    return newInvestigation;
  }, [reports, currentUser.id]);
  
  // Send nudge
  const sendNudge = useCallback((
    targetUserId: string,
    channel: 'EMAIL' | 'SMS' | 'MANUAL',
    message: string,
    context: { type: 'PROMPT_REMINDER' | 'AT_RISK_OUTREACH'; promptId?: string }
  ) => {
    const now = new Date();
    
    const newNudge: Nudge = {
      id: `nudge-${Date.now()}`,
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
      type: 'NUDGE_SENT',
      actorUserId: currentUser.id,
      metadata: { nudgeId: newNudge.id, targetUserId },
      createdAt: now,
    };
    
    setActivities(prev => [newActivity, ...prev]);
  }, [currentUser.id]);

  // Log export event for audit (append-only)
  const logExportEvent = useCallback((reportId: string, format: 'PDF' | 'CSV') => {
    const now = new Date();
    const newActivity: ActivityEvent = {
      id: `activity-${Date.now()}`,
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
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
      orgId: mockOrg.id,
      createdAt: now,
      updatedAt: now,
    };
    setPolicies((prev) => [policy, ...prev]);
    return policy;
  }, []);

  const updatePolicy = useCallback((id: string, updates: Partial<Policy>) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p)));
  }, []);

  const acknowledgePolicy = useCallback((policyId: string, userId: string, outcome?: 'READ_UNDERSTOOD' | 'REQUEST_CLARIFICATION') => {
    setPolicyAcknowledgements((prev) => {
      if (prev.some((ack) => ack.policyId === policyId && ack.userId === userId)) return prev;
      return [...prev, { policyId, userId, acknowledgedAt: new Date(), outcome }];
    });
  }, []);

  const createAnnouncement = useCallback((payload: Omit<Announcement, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const item: Announcement = {
      ...payload,
      id: `announcement-${Date.now()}`,
      orgId: mockOrg.id,
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
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...updates, updatedAt: new Date() } : user)));
  }, []);

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
            orgId: mockOrg.id,
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
  const pendingPromptsForEmployee =
    effectiveCurrentRole === 'EMPLOYEE'
      ? effectiveDeliveries
          .filter(
            (d) =>
              d.userId === currentUser.id &&
              d.status === 'PENDING' &&
              d.dueAt &&
              d.dueAt <= endOfToday
          )
          .map((d) => ({ ...d, prompt: effectivePrompts.find((p) => p.id === d.promptId)! }))
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
  };
  
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
    announcements: effectiveAnnouncements,
    currentUser,
    currentRole: effectiveCurrentRole,
    orgSettings,
    session,
    previewUserId,
    login,
    logout,
    setSession,
    setPreviewUserId,
    
    // Derived data
    dashboardCounts,
    pendingPromptsForEmployee,
    employeeReports,
    atRiskEmployees,
    
    // Functions
    getEmployeeEngagement: computeEmployeeEngagement,
    
    // Actions
    switchRole,
    submitPromptResponse,
    createReport,
    updateReportStatus,
    assignReport,
    createInvestigation,
    sendNudge,
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
