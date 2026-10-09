import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';

test('Assistant-only registration hashes/rotates secrets without modifying household users or other clients', async () => {
  const container = execFileSync('docker', ['run', '--rm', '-d', '-e', 'POSTGRES_PASSWORD=fixture-only', '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { encoding: 'utf8' }).trim();
  const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim().split(':').at(-1);
  const url = `postgresql://postgres:fixture-only@localhost:${port}/postgres`;
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 1000 });
  try {
    for (let i = 0; ; i++) {
      try { await pool.query('select 1'); break; }
      catch (error) { if (i >= 60) throw error; await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await pool.query(await readFile(new URL('../drizzle/0000_initial_auth_oauth_provider.sql', import.meta.url), 'utf8'));
    await pool.query(`INSERT INTO "user" (id, name, email) VALUES ('one', 'One', 'one@example.test'), ('two', 'Two', 'two@example.test')`);
    const originalUsers = (await pool.query('select * from "user" order by id')).rows;
    const seed = (secret) => execFileSync('pnpm', ['exec', 'tsx', 'scripts/seed-assistant-client.ts'], { env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, BETTER_AUTH_SECRET: 'fixture-central-secret-at-least-32-characters', ASSISTANT_CLIENT_SECRET: secret }, stdio: 'pipe' });
    seed('fixture-client-secret-one');
    let rows = (await pool.query('select * from "oauthClient"')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].clientId, 'assistant');
    assert.equal(rows[0].clientSecret, createHash('sha256').update('fixture-client-secret-one').digest('base64url'));
    assert.deepEqual(rows[0].redirectUris, ['https://chat.szarans.ca/api/auth/oauth2/callback/auth-pior', 'http://localhost:5173/api/auth/oauth2/callback/auth-pior']);
    assert.equal(rows[0].requirePKCE, true);
    assert.equal(rows[0].skipConsent, true);
    assert.equal(rows[0].tokenEndpointAuthMethod, 'client_secret_post');
    await pool.query(`INSERT INTO "oauthClient" (id, "clientId", "clientSecret", "redirectUris") VALUES ('existing', 'existing-app', 'preserve-this', '{}')`);
    seed('fixture-client-secret-two');
    rows = (await pool.query('select * from "oauthClient" where "clientId" = $1', ['assistant'])).rows;
    assert.equal(rows[0].clientSecret, createHash('sha256').update('fixture-client-secret-two').digest('base64url'));
    assert.deepEqual((await pool.query('select * from "user" order by id')).rows, originalUsers);
    assert.equal((await pool.query('select "clientSecret" from "oauthClient" where "clientId" = $1', ['existing-app'])).rows[0].clientSecret, 'preserve-this');
    assert.throws(() => seed(''));
    assert.equal((await pool.query('select count(*)::int as count from "oauthClient"')).rows[0].count, 2);
  } finally {
    await pool.end();
    execFileSync('docker', ['stop', '--time', '0', container], { stdio: 'ignore' });
  }
});
