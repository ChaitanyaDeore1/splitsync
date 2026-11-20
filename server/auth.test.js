import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { migrate } from './migrate.js';

const url = process.env.DATABASE_URL ?? 'postgres://splitsync:splitsync@localhost:5432/splitsync';
const schema = `test_${crypto.randomBytes(4).toString('hex')}`; // throwaway schema: real data is never touched
const codes = {};
let admin, pool, server, base;

const start = (app) => new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const urlOf = (s) => `http://127.0.0.1:${s.address().port}`;
const sendCode = async (email, code) => { codes[email] = code; };

beforeAll(async () => {
  admin = new pg.Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  const client = await pool.connect();
  await migrate(client);
  client.release();
  server = await start(createApp(pool, sendCode));
  base = urlOf(server);
});
afterAll(async () => {
  server.close();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});

const post = (p, body, cookie, b = base) =>
  fetch(b + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const wrongCode = (email) => (codes[email] === '111111' ? '222222' : '111111');

describe('authentication on PostgreSQL', () => {
  it('registers unique usernames, stores only a password hash, and signs users in', async () => {
    expect((await post('/api/auth/register', { username: 'no', password: 'a-strong-password' })).status).toBe(400);
    const registered = await post('/api/auth/register', { username: 'Asha_One', password: 'a-strong-password' });
    expect(registered.status).toBe(201);
    const first = await registered.json();
    expect(first.user).toMatchObject({ name: 'asha_one', username: 'asha_one', email: null });
    expect(first.user.id).toBeTruthy();

    const duplicate = await post('/api/auth/register', { username: 'ASHA_ONE', password: 'another-strong-password' });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toContain('username already exists');

    const wrong = await post('/api/auth/login', { username: 'asha_one', password: 'incorrect-password' });
    expect(wrong.status).toBe(401);
    const login = await post('/api/auth/login', { username: 'ASHA_ONE', password: 'a-strong-password' });
    expect(login.status).toBe(200);
    expect((await login.json()).user.id).toBe(first.user.id);

    const { rows: [stored] } = await pool.query('SELECT email, password_hash FROM users WHERE username = $1', ['asha_one']);
    expect(stored.email).toBeNull();
    expect(stored.password_hash).not.toBe('a-strong-password');
    expect(stored.password_hash).toMatch(/^scrypt\$/);
  });

  it('marks session cookies Secure when explicitly configured', async () => {
    const previous = process.env.SESSION_COOKIE_SECURE;
    process.env.SESSION_COOKIE_SECURE = 'true';
    const secureServer = await start(createApp(pool, sendCode));
    try {
      const response = await post('/api/auth/register', { username: 'secure_cookie', password: 'secure-cookie-password' }, undefined, urlOf(secureServer));
      expect(response.status).toBe(201);
      expect(response.headers.get('set-cookie')).toContain('; Secure');
    } finally {
      secureServer.close();
      if (previous === undefined) delete process.env.SESSION_COOKIE_SECURE;
      else process.env.SESSION_COOKIE_SECURE = previous;
    }
  });

  it('lets an existing OTP account set a unique username and password', async () => {
    const email = 'legacy@example.com';
    await post('/api/auth/request-otp', { name: 'Legacy Person', email });
    const verified = await post('/api/auth/verify-otp', { email, code: codes[email] });
    const cookie = verified.headers.get('set-cookie').split(';')[0];

    const setup = await post('/api/auth/set-credentials', { username: 'legacy_person', password: 'legacy-password-123' }, cookie);
    expect(setup.status).toBe(200);
    expect((await setup.json()).user).toMatchObject({ name: 'legacy_person', email, username: 'legacy_person' });
    expect((await post('/api/auth/set-credentials', { username: 'changed_name', password: 'legacy-password-123' }, cookie)).status).toBe(409);
    expect((await post('/api/auth/login', { username: 'legacy_person', password: 'legacy-password-123' })).status).toBe(200);
  });

  it('lets friends find username accounts by exact username', async () => {
    const owner = await post('/api/auth/register', { username: 'friend_owner', password: 'owner-password-123' });
    const ownerCookie = owner.headers.get('set-cookie').split(';')[0];
    const target = await post('/api/auth/register', { username: 'friend_target', password: 'target-password-123' });
    const targetId = (await target.json()).user.id;
    const found = await fetch(`${base}/api/users/search?q=FRIEND_TARGET`, { headers: { Cookie: ownerCookie } });
    expect(found.status).toBe(200);
    expect((await found.json()).user.id).toBe(targetId);
  });

  it('rejects invalid names and emails', async () => {
    expect((await post('/api/auth/request-otp', { name: 'A', email: 'a@b.co' })).status).toBe(400);
    expect((await post('/api/auth/request-otp', { name: 'Priya Sharma', email: 'nope' })).status).toBe(400);
  });

  it('signs in, keeps the typed name, survives a server restart, then logs out', async () => {
    const email = 'priya@example.com';
    expect((await post('/api/auth/request-otp', { name: 'Priya Sharma', email: 'Priya@Example.com' })).status).toBe(200);
    expect((await post('/api/auth/request-otp', { name: 'Priya Sharma', email })).status).toBe(429);
    expect((await post('/api/auth/verify-otp', { email, code: wrongCode(email) })).status).toBe(400);

    const ok = await post('/api/auth/verify-otp', { email, code: codes[email] });
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).json();
    expect(me.user).toMatchObject({ name: 'Priya Sharma', email });
    expect((await post('/api/auth/verify-otp', { email, code: codes[email] })).status).toBe(400); // single-use

    // "Restart": a brand-new server on the same database still knows the session
    const second = await start(createApp(pool, sendCode));
    expect((await fetch(urlOf(second) + '/api/auth/me', { headers: { Cookie: cookie } })).status).toBe(200);
    second.close();

    await post('/api/auth/logout', {}, cookie);
    expect((await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('lets only one of two simultaneous requests use the same code', async () => {
    const email = 'race@example.com';
    await post('/api/auth/request-otp', { name: 'Race Test', email });
    const results = await Promise.all([1, 2].map(() => post('/api/auth/verify-otp', { email, code: codes[email] })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [email]);
    expect(rows[0].n).toBe(1);
  });

  it('locks a code after 5 wrong attempts', async () => {
    const email = 'lock@example.com';
    await post('/api/auth/request-otp', { name: 'Lock Test', email });
    for (let i = 0; i < 5; i++) await post('/api/auth/verify-otp', { email, code: wrongCode(email) });
    expect((await post('/api/auth/verify-otp', { email, code: codes[email] })).status).toBe(400);
  });

  it('refuses /me without a session', async () => {
    expect((await fetch(base + '/api/auth/me')).status).toBe(401);
  });
});
