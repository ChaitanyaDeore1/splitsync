import crypto from 'node:crypto';
import { z } from 'zod';
import { buildGroupReport, buildMonthlyRecap, currentMonth, monthSchema } from './analytics.js';
import { invalid, memberOf } from './queries.js';
import { sha, wrap } from './session.js';

const shareSchema = z.object({
  kind: z.enum(['monthly', 'group']),
  month: monthSchema.optional(),
  groupId: z.string().uuid().optional(),
  days: z.number().int().min(1).max(90).default(30),
});

export function reportRoutes(r, pool) {
  // Freezes the report as it is right now and returns a link anyone can open until it expires or is revoked
  r.post('/reports/share', wrap(async (req, res) => {
    const parsed = shareSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed);
    const { kind, month, groupId, days } = parsed.data;

    let payload;
    let title;
    if (kind === 'monthly') {
      const m = month ?? currentMonth();
      payload = await buildMonthlyRecap(pool, req.user, m);
      title = `Monthly recap ${m}`;
    } else {
      if (!groupId) return res.status(400).json({ error: 'Choose a group to share.' });
      if (!(await memberOf(pool, groupId, req.user.id))) return res.status(404).json({ error: 'Group not found' });
      payload = await buildGroupReport(pool, groupId, month ?? null);
      title = `${payload.group.name}${month ? ` · ${month}` : ''}`;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const { rows: [row] } = await pool.query(
      `INSERT INTO shared_reports (user_id, kind, title, token_hash, payload, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval) RETURNING id, expires_at AS "expiresAt"`,
      [req.user.id, kind, title, sha(token), JSON.stringify(payload), String(days)],
    );
    res.status(201).json({ id: row.id, path: `/r/${token}`, expiresAt: row.expiresAt, title });
  }));

  r.get('/reports/shares', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, kind, title, expires_at AS "expiresAt", view_count AS views, created_at AS "createdAt",
              (revoked_at IS NULL AND expires_at > now()) AS active
       FROM shared_reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id],
    );
    res.json({ shares: rows });
  }));

  r.post('/reports/shares/:id/revoke', wrap(async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(404).json({ error: 'Report not found' });
    const { rowCount } = await pool.query('UPDATE shared_reports SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Report not found' });
    res.json({ ok: true });
  }));
}

// No sign-in needed: the long random link is the key
export function publicReportRoutes(r, pool) {
  r.get('/reports/:token', wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!/^[a-f0-9]{48}$/.test(req.params.token)) return res.status(404).json({ error: 'This report link is invalid, expired or was turned off.' });
    const { rows: [rep] } = await pool.query(
      `UPDATE shared_reports s SET view_count = view_count + 1 FROM users u
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.id = s.user_id
       RETURNING s.kind, s.title, s.payload, s.created_at AS "createdAt", s.expires_at AS "expiresAt", u.name AS "sharedBy"`,
      [sha(req.params.token)],
    );
    if (!rep) return res.status(404).json({ error: 'This report link is invalid, expired or was turned off.' });
    res.json(rep);
  }));
}
