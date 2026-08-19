import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  ORG_A,
  ORG_B,
  asUser,
  createRlsDatabase,
  users,
  type TestUser,
} from './rls-harness';

let db: Client;

beforeAll(async () => {
  db = await createRlsDatabase();
}, 60_000);

afterAll(async () => {
  await db?.end();
});

async function ids(sql: string, params: unknown[] = []): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(sql, params);
  return rows.map((row) => row.id).sort();
}

async function expectRlsRejects(fn: () => Promise<unknown>): Promise<void> {
  await db.query('SAVEPOINT rls_probe');
  try {
    await expect(fn()).rejects.toThrow(/row-level security/i);
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT rls_probe');
  }
}

describe('two-organization tenant isolation (Postgres RLS)', () => {
  it('provisions two orgs, HR, and employees', async () => {
    const { rows: orgs } = await db.query<{ id: string }>('SELECT id FROM organizations ORDER BY id');
    expect(orgs.map((row) => row.id)).toEqual([ORG_A, ORG_B]);
    const { rows: people } = await db.query<{ id: string; org_id: string }>(
      'SELECT id, org_id FROM users ORDER BY id'
    );
    expect(people).toHaveLength(4);
    expect(people.filter((row) => row.org_id === ORG_A)).toHaveLength(2);
    expect(people.filter((row) => row.org_id === ORG_B)).toHaveLength(2);
  });

  it('lets HR in org A read only org A cases, people, audits, and memos', async () => {
    await asUser(db, users.hrA, async () => {
      expect(await ids('SELECT id FROM reports')).toEqual(['report-a']);
      expect(await ids('SELECT id FROM users')).toEqual(['user-emp-a', 'user-hr-a']);
      expect(await ids('SELECT id FROM organizations')).toEqual([ORG_A]);
      expect(await ids('SELECT id FROM investigations')).toEqual(['inv-a']);
      expect(await ids('SELECT id FROM audit_logs')).toEqual(['audit-a']);
      expect(await ids('SELECT id FROM policies')).toEqual(['policy-a']);
    });
  });

  it('lets HR in org B read only org B rows', async () => {
    await asUser(db, users.hrB, async () => {
      expect(await ids('SELECT id FROM reports')).toEqual(['report-b']);
      expect(await ids('SELECT id FROM users')).toEqual(['user-emp-b', 'user-hr-b']);
      expect(await ids('SELECT id FROM organizations')).toEqual([ORG_B]);
    });
  });

  it('does not return the other tenant even when org_id is asked for in SQL', async () => {
    await asUser(db, users.hrA, async () => {
      expect(await ids('SELECT id FROM reports WHERE org_id = $1', [ORG_B])).toEqual([]);
      expect(await ids('SELECT id FROM users WHERE org_id = $1', [ORG_B])).toEqual([]);
      expect(await ids('SELECT id FROM audit_logs WHERE org_id = $1', [ORG_B])).toEqual([]);
      expect(await ids('SELECT id FROM investigations WHERE id = $1', ['inv-b'])).toEqual([]);
    });
  });

  it('rejects cross-tenant report inserts from HR A into org B', async () => {
    await asUser(db, users.hrA, async () => {
      await expectRlsRejects(() =>
        db.query(
          `INSERT INTO reports (id, org_id, created_by_user_id, summary, description)
           VALUES ('report-x', $1, $2, 'stolen', 'cross-tenant')`,
          [ORG_B, users.hrA.appUserId]
        )
      );
    });
  });

  it('rejects cross-tenant user directory inserts', async () => {
    await asUser(db, users.hrA, async () => {
      await expectRlsRejects(() =>
        db.query(
          `INSERT INTO users (id, org_id, role, first_name, last_name, email)
           VALUES ('user-x', $1, 'EMPLOYEE', 'X', 'Y', 'x@example.test')`,
          [ORG_B]
        )
      );
    });
  });

  it('rejects moving an org A case onto org B', async () => {
    await asUser(db, users.hrA, async () => {
      await expectRlsRejects(() =>
        db.query(`UPDATE reports SET org_id = $1 WHERE id = 'report-a'`, [ORG_B])
      );
    });
  });

  it('does not update or delete the other tenant case', async () => {
    await asUser(db, users.hrA, async () => {
      const updated = await db.query(`UPDATE reports SET summary = 'pwned' WHERE id = 'report-b'`);
      expect(updated.rowCount).toBe(0);
      const deleted = await db.query(`DELETE FROM reports WHERE id = 'report-b'`);
      expect(deleted.rowCount).toBe(0);
    });
    const { rows } = await db.query<{ summary: string }>(
      `SELECT summary FROM reports WHERE id = 'report-b'`
    );
    expect(rows[0]?.summary).toBe('Org B workplace case');
  });

  it('rejects cross-tenant investigation and audit writes', async () => {
    await asUser(db, users.hrA, async () => {
      await expectRlsRejects(() =>
        db.query(
          `INSERT INTO investigations (id, org_id, owner_id) VALUES ('inv-x', $1, $2)`,
          [ORG_B, users.hrA.appUserId]
        )
      );
      await expectRlsRejects(() =>
        db.query(
          `INSERT INTO audit_logs (id, org_id, record_type, record_id, actor_user_id)
           VALUES ('audit-x', $1, 'REPORT', 'report-b', $2)`,
          [ORG_B, users.hrA.appUserId]
        )
      );
      const closed = await db.query(`UPDATE investigations SET status = 'CLOSED' WHERE id = 'inv-b'`);
      expect(closed.rowCount).toBe(0);
    });
  });

  it('lets an employee see only their own case, not the other tenant', async () => {
    await asUser(db, users.empA, async () => {
      expect(await ids('SELECT id FROM reports')).toEqual(['report-a']);
      expect(await ids('SELECT id FROM reports WHERE id = $1', ['report-b'])).toEqual([]);
      expect(await ids('SELECT id FROM users')).toEqual(['user-emp-a']);
    });
  });

  it('still isolates when JWT has only sub and org is resolved from public.users', async () => {
    await asUser(
      db,
      users.hrA,
      async () => {
        expect(await ids('SELECT id FROM reports')).toEqual(['report-a']);
        expect(await ids('SELECT id FROM reports WHERE org_id = $1', [ORG_B])).toEqual([]);
        await expectRlsRejects(() =>
          db.query(
            `INSERT INTO reports (id, org_id, created_by_user_id, summary, description)
             VALUES ('report-y', $1, $2, 'stolen', 'fallback path')`,
            [ORG_B, users.hrA.appUserId]
          )
        );
      },
      { subOnly: true }
    );
  });

  it('allows same-tenant HR writes that stay inside the caller org', async () => {
    await asUser(db, users.hrA, async () => {
      await db.query(
        `INSERT INTO reports (id, org_id, created_by_user_id, summary, description)
         VALUES ('report-a2', $1, $2, 'same tenant', 'ok')`,
        [ORG_A, users.hrA.appUserId]
      );
      expect(await ids('SELECT id FROM reports')).toEqual(['report-a', 'report-a2']);
    });
  });
});

describe('tenant boundary helpers', () => {
  it('resolves current_org_id from the caller, not from a client-supplied filter', async () => {
    const orgOf = async (user: TestUser) =>
      asUser(db, user, async () => {
        const { rows } = await db.query<{ current_org_id: string }>('SELECT public.current_org_id()');
        return rows[0]?.current_org_id;
      });
    expect(await orgOf(users.hrA)).toBe(ORG_A);
    expect(await orgOf(users.empB)).toBe(ORG_B);
  });
});
