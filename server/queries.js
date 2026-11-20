import pg from 'pg';
import { z } from 'zod';
import { sha } from './session.js';

pg.types.setTypeParser(20, (v) => Number(v)); // bigint -> number (amounts stay far below 2^53)
pg.types.setTypeParser(1082, (v) => v); // date -> 'YYYY-MM-DD' text

const uuid = z.string().uuid();

// A real calendar date written as YYYY-MM-DD
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, 'must be a real date');

export const invalid = (res, parsed) => {
  const issue = parsed.error.issues[0];
  return res.status(400).json({ error: `Invalid ${issue?.path.join('.') || 'request'}: ${issue?.message ?? ''}` });
};

export async function withTx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// The caller's membership row in a group, or null. This is the authorization check for every group request.
export async function memberOf(db, groupId, userId) {
  if (!uuid.safeParse(groupId).success) return null;
  const { rows: [m] } = await db.query(
    'SELECT id, role, display_name AS name FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId],
  );
  return m ?? null;
}

// Net balance of every member, in paise, from the saved records. Positive = is owed, negative = owes.
export async function balancesFor(db, groupIds) {
  const { rows } = await db.query(
    `SELECT m.id, m.group_id AS "groupId", m.user_id AS "userId", (
       COALESCE((SELECT SUM(amount_paise) FROM expenses WHERE paid_by = m.id), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM expense_splits WHERE member_id = m.id), 0)
       + COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE from_member = m.id AND status = 'completed'), 0)
       - COALESCE((SELECT SUM(amount_paise) FROM settlements WHERE to_member = m.id AND status = 'completed'), 0)
     )::bigint AS balance
     FROM group_members m WHERE m.group_id = ANY($1::uuid[])`,
    [groupIds],
  );
  return rows;
}

export const logActivity = (db, groupId, actorId, action, entityId, message) =>
  db.query('INSERT INTO activity (group_id, actor_user_id, action, entity_id, message) VALUES ($1, $2, $3, $4, $5)', [
    groupId, actorId, action, entityId, message,
  ]);

// Runs work(client) at most once per Idempotency-Key. A repeat returns the saved response.
// A failed attempt (status >= 400) is rolled back and does not use up the key.
export async function idempotent(pool, req, work) {
  const key = req.get('Idempotency-Key');
  if (!key || key.length < 8 || key.length > 100)
    return { status: 400, body: { error: 'An Idempotency-Key header (8 to 100 characters) is required.' } };
  const hash = sha(`${req.method} ${req.originalUrl} ${JSON.stringify(req.body)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash, response) VALUES ($1, $2, $3, '{}')
       ON CONFLICT DO NOTHING RETURNING key`,
      [req.user.id, key, hash],
    );
    if (claimed.rowCount === 0) {
      await client.query('ROLLBACK');
      const { rows: [saved] } = await pool.query('SELECT request_hash, response FROM idempotency_keys WHERE user_id = $1 AND key = $2', [req.user.id, key]);
      if (saved.request_hash !== hash) return { status: 422, body: { error: 'This Idempotency-Key was already used for a different request.' } };
      return { status: saved.response.status, body: { ...saved.response.body, replayed: true } };
    }
    const out = await work(client);
    if (out.status >= 400) {
      await client.query('ROLLBACK');
      return out;
    }
    await client.query('UPDATE idempotency_keys SET response = $3 WHERE user_id = $1 AND key = $2', [req.user.id, key, JSON.stringify(out)]);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
