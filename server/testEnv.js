import crypto from 'node:crypto';
import pg from 'pg';
import { createApp } from './app.js';
import { migrate } from './migrate.js';

// A real server on a throwaway PostgreSQL schema, so your own data is never touched
export async function setup() {
  const url = process.env.DATABASE_URL ?? 'postgres://splitsync:splitsync@localhost:5432/splitsync';
  const schema = `test_${crypto.randomBytes(4).toString('hex')}`;
  const codes = {};
  const admin = new pg.Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
  const client = await pool.connect();
  await migrate(client);
  client.release();
  const server = await new Promise((resolve) => {
    const s = createApp(pool, async (email, code) => { codes[email] = code; }).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { body, cookie, key } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})), res };
  };
  const signIn = async (name, email) => {
    await call('POST', '/api/auth/request-otp', { body: { name, email } });
    const r = await call('POST', '/api/auth/verify-otp', { body: { email, code: codes[email] } });
    return r.res.headers.get('set-cookie').split(';')[0];
  };
  const close = async () => {
    server.close();
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  };
  return { pool, call, signIn, close };
}
