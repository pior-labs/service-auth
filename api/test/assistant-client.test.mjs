import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';

const hash = (secret) => createHash('sha256').update(secret).digest('base64url');

test('existing seed registers and rotates Assistant while preserving existing users and unrelated clients', async () => {
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
    const seed = (secret) => execFileSync('pnpm', ['db:seed'], { cwd: '..', env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, BETTER_AUTH_URL: 'http://localhost:3000', WEB_ORIGIN: 'http://localhost:3000', BETTER_AUTH_SECRET: 'fixture-central-secret-at-least-32-characters', ASSISTANT_CLIENT_SECRET: secret, FINLENS_CLIENT_SECRET: 'fixture-finlens-secret', COOKBOOK_CLIENT_SECRET: 'fixture-cookbook-secret', SEED_USER_1_EMAIL: 'one@example.test', SEED_USER_1_NAME: 'One', SEED_USER_1_PASSWORD: 'fixture-password-one', SEED_USER_2_EMAIL: 'two@example.test', SEED_USER_2_NAME: 'Two', SEED_USER_2_PASSWORD: 'fixture-password-two' }, stdio: 'pipe' });
    seed('');
    const originalUsers = (await pool.query('select * from "user" order by id')).rows;
    const originalAccounts = (await pool.query('select * from account order by id')).rows;
    assert.equal(originalUsers.length, 2);
    assert.equal(originalAccounts.length, 2);
    assert.equal((await pool.query('select count(*)::int as count from "oauthClient"')).rows[0].count, 2);
    seed('fixture-client-secret-one');
    let rows = (await pool.query('select * from "oauthClient" where "clientId" = $1', ['assistant'])).rows;
    assert.equal(rows.length, 1);
    const assistantId = rows[0].id;
    assert.equal(rows[0].clientSecret, hash('fixture-client-secret-one'));
    assert.deepEqual(rows[0].redirectUris, ['https://chat.szarans.ca/api/auth/oauth2/callback/auth-pior', 'http://localhost:5173/api/auth/oauth2/callback/auth-pior']);
    assert.equal(rows[0].requirePKCE, true);
    assert.equal(rows[0].skipConsent, true);
    assert.equal(rows[0].tokenEndpointAuthMethod, 'client_secret_post');
    await pool.query(`INSERT INTO "oauthClient" (id, "clientId", "clientSecret", "redirectUris") VALUES ('existing', 'existing-app', 'preserve-this', '{}')`);
    seed('fixture-client-secret-two');
    rows = (await pool.query('select * from "oauthClient" where "clientId" = $1', ['assistant'])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, assistantId);
    assert.equal(rows[0].clientSecret, hash('fixture-client-secret-two'));
    assert.deepEqual((await pool.query('select * from "user" order by id')).rows, originalUsers);
    assert.deepEqual((await pool.query('select * from account order by id')).rows, originalAccounts);
    for (const [id, secret] of [['finlens', 'fixture-finlens-secret'], ['cookbook', 'fixture-cookbook-secret'], ['existing-app', 'preserve-this']]) {
      assert.equal((await pool.query('select "clientSecret" from "oauthClient" where "clientId" = $1', [id])).rows[0].clientSecret, id === 'existing-app' ? secret : hash(secret));
    }
    assert.equal((await pool.query('select count(*)::int as count from "oauthClient"')).rows[0].count, 4);
  } finally {
    await pool.end();
    execFileSync('docker', ['stop', '--time', '0', container], { stdio: 'ignore' });
  }
});
