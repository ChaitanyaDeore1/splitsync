import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import nodemailer from 'nodemailer';
import pg from 'pg';
import { createApp } from './app.js';
import { migrate } from './migrate.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and start the database with: npm run db:up');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const client = await pool.connect();
  try {
    const ran = await migrate(client); // creates or updates tables on every start
    if (ran.length) console.log(`Applied migrations: ${ran.join(', ')}`);
  } finally {
    client.release();
  }
} catch (err) {
  console.error(`Cannot use the database: ${err.message}\nIs it running? Try: npm run db:up`);
  process.exit(1);
}

// Remove expired sign-in codes and sessions now and then
const cleanup = () =>
  pool.query('DELETE FROM otps WHERE expires_at < now() - interval \'1 day\'')
    .then(() => pool.query('DELETE FROM sessions WHERE expires_at < now()'))
    .catch((err) => console.error('Cleanup failed:', err.message));
await cleanup();
setInterval(cleanup, 3600 * 1000).unref();

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

// SMTP_URL sends legacy OTP codes by email; without it, they are printed in this terminal.
async function sendCode(email, code) {
  if (!transport) {
    console.log(`\n[SplitSync] Sign-in code for ${email}: ${code}\n`);
    return;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? 'SplitSync <no-reply@example.com>',
    to: email,
    subject: `Your SplitSync sign-in code: ${code}`,
    text: `Your SplitSync sign-in code is ${code}. It expires in 10 minutes.`,
  });
}

const app = createApp(pool, sendCode);
const dist = path.resolve('dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`SplitSync API on http://localhost:${port}`));
