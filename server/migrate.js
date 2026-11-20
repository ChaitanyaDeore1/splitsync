import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

// Applies every new .sql file in order. Each file runs in its own transaction.
export async function migrate(client) {
  await client.query('SELECT pg_advisory_lock(727274)'); // only one migrator at a time
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Map((await client.query('SELECT name, checksum FROM schema_migrations')).rows.map((r) => [r.name, r.checksum]));
    const ran = [];

    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      if (applied.has(file)) {
        if (applied.get(file) !== checksum) throw new Error(`${file} was edited after it was applied. Add a new migration instead.`);
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        ran.push(file);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed and was rolled back: ${e.message}`);
      }
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)');
  }
}

// Command line: npm run db:migrate
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const ran = await migrate(client);
    console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.');
  } catch (e) {
    console.error(`Migration error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
