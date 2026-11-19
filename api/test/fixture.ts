import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Runs the real migrate, seed and API entrypoints against a new, disposable
// database, so the test covers what Bootstrap production runs. It never
// touches an existing database: it creates auth_test_<uuid> and drops it.

const apiDir = fileURLToPath(new URL("..", import.meta.url));

export const seedUsers = [
  { email: "one@example.test", name: "Household One", password: "fixture-password-one-0123456789" },
  { email: "two@example.test", name: "Household Two", password: "fixture-password-two-0123456789" },
];

export const clientSecrets = {
  tasks: "fixture-tasks-secret",
  finlens: "fixture-finlens-secret",
  cookbook: "fixture-cookbook-secret",
  assistant: "fixture-assistant-secret",
} as const;

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

function run(script: string, env: NodeJS.ProcessEnv) {
  execFileSync("pnpm", ["exec", "tsx", script], { cwd: apiDir, env, stdio: "pipe" });
}

export async function createFixture() {
  let container: string | undefined;
  let adminURL = process.env.TEST_DATABASE_URL;
  if (!adminURL) {
    container = execFileSync(
      "docker",
      ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=fixture-only", "-p", "127.0.0.1::5432", "postgres:16-alpine"],
      { encoding: "utf8" },
    ).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" })
      .trim()
      .split(":")
      .at(-1);
    adminURL = `postgresql://postgres:fixture-only@127.0.0.1:${port}/postgres`;
  }
  const target = new URL(adminURL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("TEST_DATABASE_URL must target a local PostgreSQL server");
  }

  let admin = new pg.Client({ connectionString: adminURL });
  const database = `auth_test_${randomUUID().replaceAll("-", "")}`;
  let server: ChildProcess | undefined;
  let client: pg.Client | undefined;

  async function close() {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => server!.once("exit", resolve));
    }
    await client?.end().catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
    if (container) execFileSync("docker", ["stop", "--time", "0", container], { stdio: "ignore" });
  }

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await admin.connect();
        break;
      } catch (error) {
        if (attempt >= 60) throw error;
        await admin.end().catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 250));
        admin = new pg.Client({ connectionString: adminURL });
      }
    }
    await admin.query(`CREATE DATABASE "${database}"`);
    const databaseURL = new URL(adminURL);
    databaseURL.pathname = `/${database}`;

    const port = await freePort();
    const origin = `http://localhost:${port}`;
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "test",
      API_PORT: String(port),
      DATABASE_URL: databaseURL.toString(),
      BETTER_AUTH_SECRET: "fixture-auth-secret-at-least-32-characters",
      BETTER_AUTH_URL: origin,
      WEB_ORIGIN: origin,
      TASKS_CLIENT_SECRET: clientSecrets.tasks,
      FINLENS_CLIENT_SECRET: clientSecrets.finlens,
      COOKBOOK_CLIENT_SECRET: clientSecrets.cookbook,
      ASSISTANT_CLIENT_SECRET: clientSecrets.assistant,
      SEED_USER_1_EMAIL: seedUsers[0].email,
      SEED_USER_1_NAME: seedUsers[0].name,
      SEED_USER_1_PASSWORD: seedUsers[0].password,
      SEED_USER_2_EMAIL: seedUsers[1].email,
      SEED_USER_2_NAME: seedUsers[1].name,
      SEED_USER_2_PASSWORD: seedUsers[1].password,
    };

    run("scripts/migrate.ts", env);
    // Bootstrap reruns migrate and seed on every release; both must be idempotent.
    run("scripts/migrate.ts", env);
    run("scripts/seed.ts", env);
    run("scripts/seed.ts", env);

    server = spawn("pnpm", ["exec", "tsx", "src/index.ts"], { cwd: apiDir, env, stdio: "pipe" });
    let output = "";
    server.stdout?.on("data", (chunk) => (output += chunk));
    server.stderr?.on("data", (chunk) => (output += chunk));
    for (let attempt = 0; ; attempt++) {
      if (server.exitCode !== null) throw new Error(`auth api exited:\n${output}`);
      const healthy = await fetch(`${origin}/health`).then((r) => r.ok).catch(() => false);
      if (healthy) break;
      if (attempt >= 120) throw new Error(`auth api did not start:\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    client = new pg.Client({ connectionString: databaseURL.toString() });
    await client.connect();
    return { origin, issuer: `${origin}/api/auth`, db: client, close, output: () => output };
  } catch (error) {
    await close();
    throw error;
  }
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;
