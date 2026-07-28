import { getDefaultModel, getOpenAIClient, isOpenAiConfigured } from './openai.ts';

export type HelpAssistantRole =
  | 'EMPLOYEE'
  | 'HR'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'CLIENT';

export type HelpAssistantRequest = {
  question: string;
  role: HelpAssistantRole | string;
  orgId?: string;
  stateCode?: string;
};

export type HelpNavSuggestion = {
  page: string;
  params?: Record<string, string>;
  label: string;
};

export type HelpAssistantResponse = {
  answer: string;
  steps: string[];
  navigate?: HelpNavSuggestion;
  related: HelpNavSuggestion[];
  source: 'openai' | 'fallback';
  model?: string;
};

type Guide = {
  page: string;
  label: string;
  roles: string[];
  summary: string;
  howTo: string;
  keywords: string[];
  params?: Record<string, string>;
};

/** Keep in sync with src/lib/helpAssistantCatalog.ts */
const GUIDES: Guide[] = [
  {
    page: 'home',
    label: 'Home',
    roles: ['EMPLOYEE'],
    summary: 'Employee dashboard with daily check-in, pending memos, and quick links.',
    howTo:
      'Open Home from the sidebar. Complete any daily check-in gate first, then review memos that need your signature.',
    keywords: ['home', 'dashboard', 'check-in', 'checkin', 'daily'],
  },
  {
    page: 'reports',
    label: 'My Reports',
    roles: ['EMPLOYEE'],
    summary: 'Your submitted incident and wage & hour reports.',
    howTo: 'Open My Reports in the sidebar to view status, or start a new confidential report from there.',
    keywords: ['report', 'concern', 'incident', 'complaint', 'submit', 'my reports'],
  },
  {
    page: 'report-new',
    label: 'New report',
    roles: ['EMPLOYEE'],
    summary: 'Submit a confidential workplace concern or incident.',
    howTo: 'From My Reports, choose New report and follow the intake questions. You can also start from Home.',
    keywords: ['new report', 'file', 'submit concern', 'harassment', 'discrimination'],
  },
  {
    page: 'wage-hour-report',
    label: 'Wage & hour report',
    roles: ['EMPLOYEE'],
    summary: 'Report pay, hours, meal/rest, or overtime concerns.',
    howTo: 'Use the wage & hour report flow when your check-in or report type is about pay or hours.',
    keywords: ['wage', 'hour', 'overtime', 'paycheck', 'meal', 'rest', 'payroll'],
  },
  {
    page: 'resources',
    label: 'Resources',
    roles: ['EMPLOYEE'],
    summary: 'Company memos, acknowledgements, and support links.',
    howTo: 'Open Resources to read and sign required memos, including state law digests when published.',
    keywords: ['memo', 'policy', 'acknowledge', 'sign', 'resources', 'library', 'handbook'],
  },
  {
    page: 'settings',
    label: 'Settings',
    roles: ['EMPLOYEE', 'HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CLIENT'],
    summary: 'Profile, contact info, and notification preferences.',
    howTo: 'Open Settings in the sidebar to update your name, phone, and notification preferences.',
    keywords: ['settings', 'profile', 'phone', 'email', 'notification', 'password', 'contact'],
  },
  {
    page: 'help',
    label: 'Help & Support',
    roles: ['EMPLOYEE', 'HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CLIENT'],
    summary: 'FAQs, contact support, and Ask Mismo AI.',
    howTo: 'Use Ask Mismo AI for guided answers, or contact support from this page.',
    keywords: ['help', 'support', 'faq', 'contact'],
  },
  {
    page: 'dashboard',
    label: 'Dashboard',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    summary: 'HR command center for open work and next actions.',
    howTo: 'Open Dashboard for counts, next tasks, and shortcuts into Prompt Responses and investigations.',
    keywords: ['dashboard', 'overview', 'command', 'next tasks'],
  },
  {
    page: 'prompt-responses',
    label: 'Prompt Responses',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    summary: 'Check-in answers, Yes needing review, and the case register.',
    howTo: 'Open Prompt Responses to review Yes answers, unanswered check-ins, and open cases.',
    keywords: ['prompt', 'check-in', 'yes', 'case register', 'responses'],
  },
  {
    page: 'investigations',
    label: 'Investigations',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'],
    summary: 'Formal investigation files after escalation from a case.',
    howTo:
      'Open Investigations for opened investigation files. Escalate from a case in Prompt Responses when needed.',
    keywords: ['investigation', 'investigate', 'escalate', 'case file'],
  },
  {
    page: 'policies',
    label: 'Memos & Announcements',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN'],
    summary: 'Create, publish, and track memo acknowledgements.',
    howTo: 'Open Memos & Announcements to draft or publish memos that employees must sign.',
    keywords: ['memo', 'announcement', 'publish', 'acknowledgement', 'policy'],
  },
  {
    page: 'compliance',
    label: 'State Compliance',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN'],
    summary: 'State HR law monitor and signable law digests.',
    howTo:
      'Open State Compliance → State Nexus, sync laws for a state, then Publish signable memo so employees acknowledge them.',
    keywords: ['law', 'laws', 'california', 'compliance', 'cfra', 'feha', 'wage order', 'state', 'nexus'],
    params: { tab: 'STATE_NEXUS' },
  },
  {
    page: 'users',
    label: 'Manage Employees',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN'],
    summary: 'Invite employees, edit profiles, and review engagement.',
    howTo: 'Open Manage Employees to invite teammates, resend invites, or open an employee profile.',
    keywords: ['employee', 'invite', 'user', 'roster', 'onboard'],
  },
  {
    page: 'prompts',
    label: 'Manage Prompts',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN'],
    summary: 'Configure daily check-in and campaign prompts.',
    howTo: 'Open Manage Prompts to edit active prompts and delivery settings.',
    keywords: ['manage prompts', 'campaign', 'prompt setup'],
  },
  {
    page: 'analytics',
    label: 'Analytics',
    roles: ['HR', 'ADMIN', 'SUPER_ADMIN'],
    summary: 'Trends across prompts, cases, and engagement.',
    howTo: 'Open Analytics for charts and drill-downs into prompt and case activity.',
    keywords: ['analytics', 'chart', 'trend', 'metrics'],
  },
];

function guidesForRole(role: string): Guide[] {
  const r = role.toUpperCase();
  return GUIDES.filter((g) => g.roles.includes(r));
}

function fallbackAnswer(question: string, role: string): HelpAssistantResponse {
  const q = question.toLowerCase();
  const guides = guidesForRole(role);
  let best: Guide | undefined;
  let bestScore = 0;
  for (const guide of guides) {
    let score = 0;
    for (const kw of guide.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = guide;
    }
  }

  if (!best || bestScore === 0) {
    return {
      answer:
        'I can help with using Mismo — reports, memos, check-ins, employees, investigations, and state laws. Try asking something like “How do I sign a memo?” or “Where do I review Yes answers?”',
      steps: [
        'Describe what you want to do in plain language.',
        'I will explain the steps and offer a button to open the right page.',
      ],
      related: guides.slice(0, 3).map((g) => ({
        page: g.page,
        params: g.params,
        label: g.label,
      })),
      source: 'fallback',
    };
  }

  return {
    answer: `${best.summary} ${best.howTo}`,
    steps: best.howTo
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter(Boolean),
    navigate: {
      page: best.page,
      params: best.params,
      label: `Open ${best.label}`,
    },
    related: guides
      .filter((g) => g.page !== best!.page)
      .slice(0, 2)
      .map((g) => ({ page: g.page, params: g.params, label: g.label })),
    source: 'fallback',
  };
}

function sanitizeNav(
  role: string,
  nav: HelpNavSuggestion | undefined
): HelpNavSuggestion | undefined {
  if (!nav?.page) return undefined;
  const allowed = guidesForRole(role);
  const match = allowed.find((g) => g.page === nav.page);
  if (!match) return undefined;
  return {
    page: match.page,
    params: nav.params ?? match.params,
    label: nav.label?.trim() || `Open ${match.label}`,
  };
}

const SYSTEM = `You are Ask Mismo AI, an in-product guide for the Mismo workplace compliance app.
Help users understand how to use the product and where to go. You may briefly explain common US/state employment-law topics at a high level, but you are NOT a lawyer and must say answers are not legal advice.
Return JSON only with keys:
- answer (string, clear, concise, friendly)
- steps (string array, 2-5 short how-to steps)
- navigate (object|null) with page, optional params, label — primary destination
- related (array of {page, optional params, label}) — up to 2 extras

Rules:
- Only use page ids from the provided catalog for this user's role.
- Prefer navigate when a concrete screen helps.
- Do not invent pages, URLs, or features outside the catalog.
- Keep answer under 180 words.`;

export async function runHelpAssistant(input: HelpAssistantRequest): Promise<HelpAssistantResponse> {
  const question = input.question?.trim() ?? '';
  if (!question) {
    throw new Error('question is required');
  }
  const role = (input.role || 'EMPLOYEE').toUpperCase();
  const catalog = guidesForRole(role);

  if (!isOpenAiConfigured()) {
    return fallbackAnswer(question, role);
  }

  try {
    const openai = getOpenAIClient();
    const model = getDefaultModel();
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            question,
            role,
            stateCode: input.stateCode ?? null,
            pageCatalog: catalog.map((g) => ({
              page: g.page,
              label: g.label,
              summary: g.summary,
              howTo: g.howTo,
              params: g.params ?? null,
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      answer?: string;
      steps?: string[];
      navigate?: HelpNavSuggestion | null;
      related?: HelpNavSuggestion[];
    };

    const related = (parsed.related ?? [])
      .map((item) => sanitizeNav(role, item))
      .filter(Boolean)
      .slice(0, 2) as HelpNavSuggestion[];

    return {
      answer:
        parsed.answer?.trim() ||
        'Here is where to go in Mismo for that. Use the button below to open the page.',
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
        : [],
      navigate: sanitizeNav(role, parsed.navigate ?? undefined),
      related,
      source: 'openai',
      model,
    };
  } catch {
    return fallbackAnswer(question, role);
  }
}
