import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { TopNav } from '@/components/TopNav';
import { Sidebar } from '@/components/Sidebar';
import type { DataStore } from '@/hooks/useDataStore';

import { EmployeeHome } from '@/pages/employee/EmployeeHome';
import { EmployeeReports } from '@/pages/employee/EmployeeReports';
import { NewReport } from '@/pages/employee/NewReport';
import { ReportDetail as EmployeeReportDetail } from '@/pages/employee/ReportDetail';
import { EmployeeIncidentIntake } from '@/pages/employee/EmployeeIncidentIntake';
import { EmployeeResources } from '@/pages/employee/EmployeeResources';
import { EmployeeSettings } from '@/pages/employee/EmployeeSettings';
import { WageHourReporting } from '@/pages/employee/WageHourReporting';
import { EmployeeWageHourIntake } from '@/pages/employee/EmployeeWageHourIntake';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminInvestigations } from '@/pages/admin/AdminInvestigations';
import { AdminEmployees } from '@/pages/admin/AdminEmployees';
import { AdminPrompts } from '@/pages/admin/AdminPrompts';
import { AdminAnalytics } from '@/pages/admin/AdminAnalytics';
import { AdminSystemHealth } from '@/pages/admin/AdminSystemHealth';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminClients } from '@/pages/admin/AdminClients';
import { AdminClientDetail } from '@/pages/admin/AdminClientDetail';
import { AdminClientPortfolio } from '@/pages/admin/AdminClientPortfolio';
import { AdminReportDetail } from '@/pages/admin/AdminReportDetail';
import { AdminEmployeeDetail } from '@/pages/admin/AdminEmployeeDetail';
import { AdminInvestigationDetail } from '@/pages/admin/AdminInvestigationDetail';
import { HelpSupport } from '@/pages/HelpSupport';
import { AdminPoliciesAndAnnouncements } from '@/pages/admin/AdminPoliciesAndAnnouncements';
import { AdminPolicyDetail } from '@/pages/admin/AdminPolicyDetail';
import { AdminAnnouncementDetail } from '@/pages/admin/AdminAnnouncementDetail';
import { AdminPromptResponses } from '@/pages/admin/AdminPromptResponses';
import { AdminPromptResponseDetail } from '@/pages/admin/AdminPromptResponseDetail';
import { AdminCompliance } from '@/pages/admin/AdminCompliance';
import { AdminActivity } from '@/pages/admin/AdminActivity';
import { ManagerDashboard } from '@/pages/manager/ManagerDashboard';
import { ClientDashboard } from '@/pages/client/ClientDashboard';
import { buildAppUrl, parseAppLocation, normalizeHrNavigation, type AppRole } from '@/lib/appUrl';

gsap.registerPlugin(ScrollTrigger);

interface AuthenticatedAppProps {
 dataStore: DataStore;
}

function isStaffRole(role: DataStore['currentRole']) {
 return role === 'HR' || role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function AuthenticatedApp({ dataStore }: AuthenticatedAppProps) {
 const { currentRole, switchRole, session, previewUserId, setPreviewUserId } = dataStore;

 const [activePage, setActivePage] = useState(() => {
 const parsed = parseAppLocation(
 window.location.pathname,
 window.location.search,
 currentRole as AppRole
 );
 return parsed.page;
 });

 const [sidebarOpen, setSidebarOpen] = useState(false);
 const skipRoleNavOnMount = useRef(true);
 const [pageParams, setPageParams] = useState<Record<string, string>>(() => {
 const parsed = parseAppLocation(
 typeof window !== 'undefined' ? window.location.pathname : '/admin/dashboard',
 typeof window !== 'undefined' ? window.location.search : '',
 currentRole as AppRole
 );
 return parsed.params;
 });

 useEffect(() => {
 const sessionRole = session?.role;
 if (!sessionRole) return;

 const pathname = window.location.pathname.split('?')[0];

 // Stale URL from a previous session (e.g. /employee/* after logging in as HR/admin)
 if (isStaffRole(sessionRole) && pathname.startsWith('/employee')) {
 window.history.replaceState({}, '', '/admin/dashboard');
 switchRole(sessionRole);
 setActivePage('dashboard');
 setPageParams({});
 return;
 }

 if (sessionRole === 'EMPLOYEE' && !pathname.startsWith('/employee')) {
 window.history.replaceState({}, '', '/employee/dashboard');
 switchRole(sessionRole);
 setActivePage('home');
 setPageParams({});
 return;
 }

 if (sessionRole === 'CLIENT' && pathname !== '/admin/client-dashboard' && !pathname.startsWith('/admin/client-dashboard/')) {
 window.history.replaceState({}, '', '/admin/client-dashboard');
 switchRole(sessionRole);
 setActivePage('client-dashboard');
 setPageParams({});
 return;
 }

 if (isStaffRole(sessionRole) && pathname === '/admin/all-reports') {
 window.history.replaceState({}, '', `/admin/employee-prompt-responses${window.location.search}`);
 } else if (isStaffRole(sessionRole) && pathname === '/admin/case-register') {
 const sp = new URLSearchParams(window.location.search);
 if (!sp.has('view')) sp.set('view', 'register');
 if (!sp.has('register')) sp.set('register', '1');
 if (!sp.has('channel')) sp.set('channel', 'register');
 window.history.replaceState({}, '', `/admin/employee-prompt-responses?${sp.toString()}`);
 } else if (isStaffRole(sessionRole) && pathname === '/admin/campaigns') {
 window.history.replaceState({}, '', `/admin/prompts${window.location.search}`);
 }

 const parsed = parseAppLocation(window.location.pathname, window.location.search, sessionRole as AppRole);
 setPageParams(parsed.params);
 if (parsed.role !== sessionRole) {
 switchRole(sessionRole);
 }
 setActivePage(parsed.page);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 useEffect(() => {
 // Only sync default URL when the user switches role - preserve deep links on reload.
 if (skipRoleNavOnMount.current) {
 skipRoleNavOnMount.current = false;
 return;
 }
 let nextPage = 'dashboard';
 if (currentRole === 'EMPLOYEE') {
 nextPage = 'home';
 } else if (currentRole === 'CLIENT') {
 nextPage = 'client-dashboard';
 } else if (currentRole === 'SUPER_ADMIN') {
 nextPage = 'clients';
 } else if (currentRole === 'HR' || currentRole === 'MANAGER' || currentRole === 'ADMIN') {
 nextPage = 'dashboard';
 }
 setActivePage(nextPage);
 setPageParams({});
 const nextPath = buildAppUrl(nextPage, currentRole as AppRole, {});
 if (window.location.pathname.split('?')[0] !== nextPath.split('?')[0]) {
 window.history.replaceState({}, '', nextPath);
 }
 }, [currentRole]);

 const handleNavigate = (page: string, params?: Record<string, string>) => {
 const routeParams = params ?? {};
 const normalized = isStaffRole(currentRole)
 ? normalizeHrNavigation(page, routeParams)
 : { page, params: routeParams };
 setActivePage(normalized.page);
 setPageParams(normalized.params);
 setSidebarOpen(false);
 if (params?.previewEmployee === 'true') {
 window.history.pushState({}, '', '/employee/dashboard');
 } else {
 const nextPath = buildAppUrl(normalized.page, currentRole as AppRole, normalized.params);
 if (window.location.pathname + window.location.search !== nextPath) {
 window.history.pushState({}, '', nextPath);
 }
 }
 window.scrollTo(0, 0);
 };

 useEffect(() => {
 const onPop = () => {
 const sessionRole = session?.role;
 const pathname = window.location.pathname.split('?')[0];

 if (sessionRole && isStaffRole(sessionRole) && pathname.startsWith('/employee')) {
 window.history.replaceState({}, '', '/admin/dashboard');
 switchRole(sessionRole);
 setActivePage('dashboard');
 setPageParams({});
 return;
 }
 if (sessionRole === 'EMPLOYEE' && !pathname.startsWith('/employee')) {
 window.history.replaceState({}, '', '/employee/dashboard');
 switchRole(sessionRole);
 setActivePage('home');
 setPageParams({});
 return;
 }

 const parsed = parseAppLocation(window.location.pathname, window.location.search, currentRole as AppRole);
 setPageParams(parsed.params);
 setActivePage(parsed.page);
 if (sessionRole && parsed.role !== sessionRole) {
 switchRole(sessionRole);
 }
 };
 window.addEventListener('popstate', onPop);
 return () => window.removeEventListener('popstate', onPop);
 }, [currentRole, switchRole, session?.role]);

 useEffect(() => {
 const root = document.querySelector('main');
 if (!root) return;
 const revealTargets = root.querySelectorAll(
 '.mismo-card, .header-block, .dashboard-header, .reports-section, .resources-section, .analytics-header, .employees-header, .investigations-header, .prompts-header, .campaigns-header, .health-header, .rc-fade'
 );
 revealTargets.forEach((node) => node.classList.add('enterprise-reveal'));
 const observer = new IntersectionObserver(
 (entries) => {
 entries.forEach((entry) => {
 if (entry.isIntersecting) {
 entry.target.classList.add('is-visible');
 observer.unobserve(entry.target);
 }
 });
 },
 { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
 );
 revealTargets.forEach((node) => observer.observe(node));
 return () => observer.disconnect();
 }, [activePage, currentRole]);

 const renderEmployeeContent = () => {
 switch (activePage) {
 case 'home':
 return <EmployeeHome dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'reports':
 return <EmployeeReports dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'report-new':
 return <NewReport dataStore={dataStore} onNavigate={handleNavigate} initialParams={pageParams} />;
 case 'wage-hour-report':
 return <WageHourReporting dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'resources':
 return <EmployeeResources dataStore={dataStore} />;
 case 'settings':
 return <EmployeeSettings dataStore={dataStore} />;
 case 'help':
 return <HelpSupport dataStore={dataStore} onNavigate={handleNavigate} />;
 default:
 if (activePage.startsWith('wage-hour-intake/')) {
 const wageHourReportId = activePage.split('wage-hour-intake/')[1];
 return <EmployeeWageHourIntake dataStore={dataStore} reportId={wageHourReportId} onNavigate={handleNavigate} />;
 }
 if (activePage.startsWith('incident-intake/')) {
 const intakeReportId = activePage.split('incident-intake/')[1];
 return <EmployeeIncidentIntake dataStore={dataStore} reportId={intakeReportId} onNavigate={handleNavigate} />;
 }
 if (activePage.startsWith('report-detail/')) {
 const reportId = activePage.split('report-detail/')[1];
 return <EmployeeReportDetail dataStore={dataStore} reportId={reportId} onNavigate={handleNavigate} />;
 }
 return <EmployeeHome dataStore={dataStore} onNavigate={handleNavigate} />;
 }
 };

 const renderAdminContent = () => {
 // Mismo Internal is company portfolio ops only — not employee / risk-command HR tools.
 const isMismoInternal = dataStore.currentRole === 'SUPER_ADMIN';
 const hrOnlyPages = new Set([
 'dashboard',
 'users',
 'employees',
 'employee-detail',
 'investigations',
 'investigation-detail',
 'policies',
 'policy-detail',
 'announcements',
 'announcement-detail',
 'prompts',
 'prompt-responses',
 'prompt-response-detail',
 'case-register',
 'scheduled-memos',
 'compliance',
 'system-health',
 'settings',
 'activity',
 'manager-dashboard',
 'report-detail',
 ]);
 if (isMismoInternal && hrOnlyPages.has(activePage)) {
 return <AdminClients dataStore={dataStore} onNavigate={handleNavigate} />;
 }

 switch (activePage) {
 case 'dashboard':
 return dataStore.currentRole === 'CLIENT' ? (
 <ClientDashboard dataStore={dataStore} />
 ) : (
 <AdminDashboard dataStore={dataStore} onNavigate={handleNavigate} />
 );
 case 'investigations':
 return <AdminInvestigations dataStore={dataStore} onNavigate={handleNavigate} initialFilters={pageParams} />;
 case 'employees':
 case 'users':
 return <AdminEmployees dataStore={dataStore} onNavigate={handleNavigate} initialFilters={pageParams} />;
 case 'clients':
 if (!isMismoInternal) {
 return <AdminDashboard dataStore={dataStore} onNavigate={handleNavigate} />;
 }
 return <AdminClients dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'client-detail':
 if (!isMismoInternal) {
 return <AdminDashboard dataStore={dataStore} onNavigate={handleNavigate} />;
 }
 return <AdminClientDetail dataStore={dataStore} clientId={pageParams.id ?? ''} onNavigate={handleNavigate} />;
 case 'policies':
 return (
 <AdminPoliciesAndAnnouncements
 dataStore={dataStore}
 onNavigate={handleNavigate}
 initialTab="policies"
 initialFilters={pageParams}
 />
 );
 case 'policy-detail':
 return <AdminPolicyDetail dataStore={dataStore} policyId={pageParams.id ?? ''} onNavigate={handleNavigate} />;
 case 'announcements':
 return <AdminPoliciesAndAnnouncements dataStore={dataStore} onNavigate={handleNavigate} initialTab="announcements" />;
 case 'announcement-detail':
 return <AdminAnnouncementDetail dataStore={dataStore} announcementId={pageParams.id ?? ''} onNavigate={handleNavigate} />;
 case 'prompts':
 return <AdminPrompts dataStore={dataStore} onNavigate={handleNavigate} initialFilters={pageParams} />;
 case 'prompt-responses':
 case 'case-register':
 return <AdminPromptResponses dataStore={dataStore} onNavigate={handleNavigate} initialFilters={pageParams} />;
 case 'prompt-response-detail':
 return <AdminPromptResponseDetail dataStore={dataStore} responseId={pageParams.id ?? ''} onNavigate={handleNavigate} />;
 case 'scheduled-memos':
 return <AdminPrompts dataStore={dataStore} onNavigate={handleNavigate} initialFilters={{ filter: 'SCHEDULED' }} />;
 case 'analytics':
 if (isMismoInternal) {
 return <AdminClientPortfolio dataStore={dataStore} onNavigate={handleNavigate} />;
 }
 return <AdminAnalytics dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'compliance':
 return <AdminCompliance dataStore={dataStore} onNavigate={handleNavigate} initialFilters={pageParams} />;
 case 'system-health':
 return <AdminSystemHealth dataStore={dataStore} />;
 case 'settings':
 return <AdminSettings dataStore={dataStore} />;
 case 'report-detail':
 return <AdminReportDetail dataStore={dataStore} reportId={pageParams.id ?? ''} onNavigate={handleNavigate} fromInvestigationId={pageParams.fromInvestigation} />;
 case 'employee-detail':
 return <AdminEmployeeDetail dataStore={dataStore} employeeId={pageParams.id ?? ''} onNavigate={handleNavigate} initialTab={pageParams.tab} />;
 case 'investigation-detail':
 return <AdminInvestigationDetail dataStore={dataStore} investigationId={pageParams.id ?? ''} onNavigate={handleNavigate} initialTab={pageParams.tab} />;
 case 'manager-dashboard':
 return <ManagerDashboard dataStore={dataStore} onNavigate={handleNavigate} />;
 case 'client-dashboard':
 return <ClientDashboard dataStore={dataStore} />;
 case 'activity':
 return <AdminActivity dataStore={dataStore} />;
 case 'help':
 return <HelpSupport dataStore={dataStore} onNavigate={handleNavigate} />;
 default:
 if (isMismoInternal) {
 return <AdminClients dataStore={dataStore} onNavigate={handleNavigate} />;
 }
 return dataStore.currentRole === 'CLIENT' ? (
 <ClientDashboard dataStore={dataStore} />
 ) : (
 <AdminDashboard dataStore={dataStore} onNavigate={handleNavigate} />
 );
 }
 };

 return (
 <div className="min-h-screen bg-[var(--mismo-bg)]">
 <Toaster position="top-right" richColors />
 {previewUserId && (
 <div className="fixed top-16 left-0 right-0 z-40 bg-[var(--color-primary-700)] text-white px-4 py-2 flex items-center justify-between text-sm">
 <span>
 Previewing as {dataStore.currentUser?.firstName} {dataStore.currentUser?.lastName}
 </span>
 <Button
 variant="outline"
 size="sm"
 className="border-white text-white bg-[var(--color-primary-900)] hover:bg-black/40"
 onClick={() => {
 setPreviewUserId(null);
 handleNavigate('users');
 }}
 >
 Exit preview
 </Button>
 </div>
 )}
 <TopNav dataStore={dataStore} onMenuClick={() => setSidebarOpen(true)} onNavigate={handleNavigate} />

 <Sidebar
 dataStore={dataStore}
 activePage={activePage}
 onNavigate={handleNavigate}
 isOpen={sidebarOpen}
 onClose={() => setSidebarOpen(false)}
 />

 <main
 className={
 previewUserId ? 'pt-24 lg:pl-64 min-h-screen relative z-0 pointer-events-auto' : 'pt-16 lg:pl-64 min-h-screen relative z-0 pointer-events-auto'
 }
 >
 <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto relative z-0 pb-safe">
 {currentRole === 'EMPLOYEE' ? renderEmployeeContent() : renderAdminContent()}
 </div>
 </main>
 </div>
 );
}
