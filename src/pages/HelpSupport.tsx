import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageMoreInfo } from '@/components/PageMoreInfo';
import { AskMismoAi } from '@/components/AskMismoAi';

interface HelpSupportProps {
  dataStore: DataStore;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

const SUPPORT_EMAIL = 'support@mismo.com';
const SUPPORT_PHONE = '1-800-555-0100';
const HOURS = 'Monday-Friday, 8am-6pm (your timezone)';

const employeeFaqs = [
  {
    q: 'How do I submit a report or concern?',
    a: 'Use "My Reports" in the sidebar and click "New report" to submit confidentially. You can also start from the Home dashboard.',
  },
  {
    q: 'Who sees my report?',
    a: "Reports are handled by your organization's HR and compliance team. Access is restricted to authorized personnel only.",
  },
  {
    q: 'How do I complete a prompt or memo?',
    a: 'From your Home dashboard, open any pending prompt and answer the questions. You can also find them under "My Reports" if they\'re linked to a campaign. Required memos are in Resources.',
  },
  {
    q: "I didn't receive a prompt or reminder.",
    a: 'Check your email (and spam folder) and notification settings in Settings. If the issue continues, contact support using the details below.',
  },
  {
    q: 'How do I update my contact information?',
    a: 'Go to Settings in the sidebar to update your name, phone, and notification preferences.',
  },
  {
    q: 'Where can I find company memos and resources?',
    a: 'Use the "Resources" section in the sidebar for published memos, wellness, safety, and support links.',
  },
];

const adminFaqs = [
  {
    q: 'Where do I review employee Yes answers?',
    a: 'Open Prompt Responses. Use Yes · needs review for check-ins that still need HR attention, and the case register for open cases.',
  },
  {
    q: 'How do I publish state laws for employees to sign?',
    a: 'Go to State Compliance → State Nexus, sync laws for the state, then Publish signable memo. Employees who already signed only get updates that changed since their last signature.',
  },
  {
    q: 'How do I invite an employee?',
    a: 'Open Manage Employees, add or invite the person, then share the invite link or rely on the invite email when mail is configured.',
  },
  {
    q: 'When does something become an investigation?',
    a: 'Investigations are opened from a case when escalation is required. Prompt Responses holds triage; Investigations lists formal open files.',
  },
];

export function HelpSupport({ dataStore, onNavigate }: HelpSupportProps) {
  const isEmployee = dataStore.currentRole === 'EMPLOYEE';
  const faqs = isEmployee ? employeeFaqs : adminFaqs;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Help & Support</h1>
        <PageMoreInfo>
          Ask Mismo AI for guided answers, browse FAQs, or contact support.
        </PageMoreInfo>
      </div>

      <AskMismoAi
        role={dataStore.currentRole}
        orgId={dataStore.currentUser.orgId}
        stateCode={dataStore.currentUser.state}
        onNavigate={onNavigate}
      />

      <Card className="mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.help className="h-5 w-5 text-[var(--color-primary-600)]" />
            Contact support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--mismo-text-secondary)]">Hours: {HOURS}</p>
          <div className="flex flex-wrap gap-4">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-[var(--color-primary-600)] hover:underline"
            >
              <Icons.mail className="h-4 w-4" />
              {SUPPORT_EMAIL}
            </a>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-2 text-[var(--color-primary-600)] hover:underline"
            >
              <Icons.phone className="h-4 w-4" />
              {SUPPORT_PHONE}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardHeader>
          <CardTitle className="text-lg">Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {faqs.map((faq, i) => (
              <li key={i} className="border-b border-[var(--color-border-200)] last:border-0 pb-4 last:pb-0">
                <p className="font-medium text-[var(--mismo-text)]">{faq.q}</p>
                <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">{faq.a}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {isEmployee && onNavigate && (
          <>
            <Button variant="outline" onClick={() => onNavigate('report-new')}>
              Submit a report
            </Button>
            <Button variant="outline" onClick={() => onNavigate('resources')}>
              Resources
            </Button>
            <Button variant="outline" onClick={() => onNavigate('settings')}>
              Settings
            </Button>
          </>
        )}
        {!isEmployee && onNavigate && (
          <Button variant="outline" onClick={() => onNavigate('dashboard')}>
            Back to dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
