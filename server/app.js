import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { analyticsRoutes, groupReportRoutes } from './analytics.js';
import { expenseRoutes } from './expenses.js';
import { friendRoutes } from './friends.js';
import { groupRoutes } from './groups.js';
import { inviteRoutes } from './invites.js';
import { notificationRoutes } from './notifications.js';
import { publicReportRoutes, reportRoutes } from './reports.js';
import { requireUser, sha, wrap } from './session.js';
import { settlementRoutes } from './settlements.js';
import { timelineRoutes } from './timeline.js';
import { hashPassword, verifyPassword } from './passwords.js';

const OTP_TTL = 10 * 60 * 1000;
const RESEND_GAP = 30 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL = 30 * 24 * 3600 * 1000;

const requestSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
});
const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/),
});
const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });
const LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

export function createApp(pool, sendCode) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  const tokenFrom = (req) => /(?:^|; )sid=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
  const secureCookie = process.env.NODE_ENV === 'production' || process.env.SESSION_COOKIE_SECURE === 'true';
  const setCookie = (res, value, maxAgeSeconds) =>
    res.setHeader('Set-Cookie', `sid=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureCookie ? '; Secure' : ''}`);
  const failedLogins = new Map();
  const startSession = async (userId, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
      sha(token), userId, new Date(Date.now() + SESSION_TTL),
    ]);
    setCookie(res, token, SESSION_TTL / 1000);
  };

  app.post('/api/auth/register', wrap(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Choose a 3–32 character username using letters, numbers, dots, underscores or hyphens, and a password of at least 8 characters.' });
    }
    const { username, password } = parsed.data;
    try {
      const { rows: [user] } = await pool.query(
        'INSERT INTO users (name, email, username, password_hash) VALUES ($1, NULL, $1, $2) RETURNING id, name, email, username',
        [username, await hashPassword(password)],
      );
      await startSession(user.id, res);
      res.status(201).json({ user });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That username already exists. Choose another or sign in.' });
      throw err;
    }
  }));

  app.post('/api/auth/login', wrap(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid username and password.' });
    const { username, password } = parsed.data;
    const key = `${req.ip}:${username}`;
    const now = Date.now();
    const previous = failedLogins.get(key);
    if (previous && previous.until > now && previous.count >= MAX_LOGIN_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    }
    const { rows: [user] } = await pool.query(
      'SELECT id, name, email, username, password_hash FROM users WHERE lower(username) = $1',
      [username],
    );
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      if (!previous || previous.until <= now) failedLogins.set(key, { count: 1, until: now + LOGIN_WINDOW });
      else previous.count += 1;
      if (failedLogins.size > 2000) {
        for (const [attemptKey, attempt] of failedLogins) if (attempt.until <= now) failedLogins.delete(attemptKey);
      }
      return res.status(401).json({ error: 'Username or password is incorrect.' });
    }
    failedLogins.delete(key);
    await startSession(user.id, res);
    res.json({ user: { id: user.id, name: user.name, email: user.email, username: user.username } });
  }));

  app.post('/api/auth/set-credentials', requireUser(pool), wrap(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Choose a 3–32 character username using letters, numbers, dots, underscores or hyphens, and a password of at least 8 characters.' });
    }
    if (req.user.username) return res.status(409).json({ error: 'This account already has username credentials.' });
    try {
      const { rows: [user] } = await pool.query(
        'UPDATE users SET name = $1, username = $1, password_hash = $2 WHERE id = $3 AND username IS NULL RETURNING id, name, email, username',
        [parsed.data.username, await hashPassword(parsed.data.password), req.user.id],
      );
      if (!user) return res.status(409).json({ error: 'This account already has username credentials.' });
      res.json({ user });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That username already exists. Choose another.' });
      throw err;
    }
  }));

  app.post('/api/auth/request-otp', wrap(async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter your full name and a valid email address.' });
    const { name, email } = parsed.data;

    const { rows: [previous] } = await pool.query('SELECT created_at FROM otps WHERE email = $1', [email]);
    if (previous && Date.now() - previous.created_at.getTime() < RESEND_GAP)
      return res.status(429).json({ error: 'Please wait a few seconds before requesting another code.' });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await pool.query(
      `INSERT INTO otps (email, name, code_hash, expires_at, attempts, created_at) VALUES ($1, $2, $3, $4, 0, now())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now()`,
      [email, name, sha(email + code), new Date(Date.now() + OTP_TTL)],
    );
    try {
      await sendCode(email, code);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: 'We could not send the email. Please try again.' });
    }
    res.json({ ok: true });
  }));

  app.post('/api/auth/verify-otp', wrap(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter the 6-digit code.' });
    const { email, code } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // FOR UPDATE locks the row, so two simultaneous requests cannot both use the same code
      const { rows: [row] } = await client.query('SELECT * FROM otps WHERE email = $1 FOR UPDATE', [email]);
      if (!row || row.expires_at < new Date() || row.attempts >= MAX_ATTEMPTS) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
      }
      if (sha(email + code) !== row.code_hash) {
        await client.query('UPDATE otps SET attempts = attempts + 1 WHERE email = $1', [email]);
        await client.query('COMMIT'); // keep the failed-attempt count
        return res.status(400).json({ error: 'Incorrect code.' });
      }

      await client.query('DELETE FROM otps WHERE email = $1', [email]); // a code works only once
      await client.query('INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT (lower(email)) DO NOTHING', [row.name, email]);
      const { rows: [user] } = await client.query('SELECT id, name, email FROM users WHERE lower(email) = $1', [email]);
      const token = crypto.randomBytes(32).toString('hex');
      await client.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
        sha(token), user.id, new Date(Date.now() + SESSION_TTL),
      ]);
      await client.query('COMMIT');
      setCookie(res, token, SESSION_TTL / 1000);
      const { rows: [signedInUser] } = await pool.query('SELECT id, name, email, username FROM users WHERE id = $1', [user.id]);
      res.json({ user: signedInUser });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }));

  app.get('/api/auth/me', requireUser(pool), (req, res) => res.json({ user: req.user }));

  app.post('/api/auth/logout', wrap(async (req, res) => {
    const token = tokenFrom(req);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha(token)]);
    setCookie(res, '', 0);
    res.json({ ok: true });
  }));

  // Everything below needs a signed-in user and checks group membership itself
  const api = express.Router();
  api.use(requireUser(pool));
  groupRoutes(api, pool);
  expenseRoutes(api, pool);
  settlementRoutes(api, pool);
  groupReportRoutes(api, pool);
  app.use('/api/groups', api);

  // Shared report links work without signing in
  const open = express.Router();
  publicReportRoutes(open, pool);
  app.use('/api/public', open);

  const rest = express.Router();
  rest.use(requireUser(pool));
  friendRoutes(rest, pool);
  inviteRoutes(rest, pool);
  timelineRoutes(rest, pool);
  analyticsRoutes(rest, pool);
  notificationRoutes(rest, pool);
  reportRoutes(rest, pool);
  app.use('/api', rest);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}
