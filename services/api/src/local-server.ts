import './load-env.js';
import http from 'node:http';
import { URL } from 'node:url';
import { runOutreachCoach } from './handlers/outreach-coach.js';
import { handleHrLawsList, handleHrLawUpdates, handleHrLawSync } from './handlers/hr-laws-api.js';
import { computeHrNextTasks } from './handlers/hr-next-tasks.js';
import { isSupabaseConfigured } from './lib/supabase.js';

const PORT = Number(process.env.API_PORT ?? 3001);

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

/** Local dev server — mirrors production API routes. */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'mismo-api',
        database: isSupabaseConfigured(),
      });
      return;
    }

    if (url.pathname === '/ai/outreach/coach' && req.method === 'POST') {
      const body = await readBody(req);
      const input = JSON.parse(body) as Parameters<typeof runOutreachCoach>[0];
      const result = await runOutreachCoach(input);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/hr-laws' && req.method === 'GET') {
      const state = url.searchParams.get('state') ?? 'CA';
      const topic = url.searchParams.get('topic') ?? undefined;
      const result = await handleHrLawsList(state, topic);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/hr-laws/updates' && req.method === 'GET') {
      const orgId = url.searchParams.get('orgId') ?? undefined;
      const result = await handleHrLawUpdates(orgId);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/hr-laws/sync' && req.method === 'POST') {
      const body = await readBody(req);
      const parsed = JSON.parse(body) as { stateCode: string; stateName?: string; orgId?: string };
      const result = await handleHrLawSync(parsed);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/hr/next-tasks' && req.method === 'GET') {
      const orgId = url.searchParams.get('orgId') ?? 'org-mismo-1';
      const snapshot = {
        payrollExpedited: Number(url.searchParams.get('payrollExpedited') ?? 0) || undefined,
        needsInfo: Number(url.searchParams.get('needsInfo') ?? 0) || undefined,
        wageHour: Number(url.searchParams.get('wageHour') ?? 0) || undefined,
        yesReview: Number(url.searchParams.get('yesReview') ?? 0) || undefined,
        unassigned: Number(url.searchParams.get('unassigned') ?? 0) || undefined,
        lawUpdates: Number(url.searchParams.get('lawUpdates') ?? 0) || undefined,
        atRiskEmployees: Number(url.searchParams.get('atRiskEmployees') ?? 0) || undefined,
        unansweredPrompts: Number(url.searchParams.get('unansweredPrompts') ?? 0) || undefined,
        openInvestigations: Number(url.searchParams.get('openInvestigations') ?? 0) || undefined,
      };
      const hasSnapshot = Object.values(snapshot).some((v) => v !== undefined && v > 0);
      const tasks = await computeHrNextTasks(orgId, hasSnapshot ? snapshot : undefined);
      sendJson(res, 200, { tasks });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    sendJson(res, 400, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Mismo API (local) http://localhost:${PORT}`);
});
