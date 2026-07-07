import { listHrLawsForState, listHrLawUpdates, syncStateLawsToDb } from '../lib/persist-hr-laws.js';

export async function handleHrLawsList(stateCode: string, topic?: string) {
  const laws = await listHrLawsForState(stateCode, topic);
  return { laws };
}

export async function handleHrLawUpdates(orgId?: string) {
  const updates = await listHrLawUpdates(orgId);
  return { updates };
}

export async function handleHrLawSync(body: { stateCode: string; stateName?: string; orgId?: string }) {
  const code = body.stateCode.toUpperCase();
  const name = body.stateName ?? code;
  const result = await syncStateLawsToDb(code, name, body.orgId);
  return { ok: true, stateCode: code, ...result };
}
