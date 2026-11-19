import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/db/index.js";

// Applies every drizzle/*.sql file in name order, each in its own transaction.
// Bootstrap production runs this on every release, so every migration must be
// safe to re-run (IF NOT EXISTS, guarded backfills).
const migrationDir = path.resolve(process.cwd(), "drizzle");
const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();

const client = await pool.connect();
try {
  for (const name of migrations) {
    const sql = await readFile(path.join(migrationDir, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`applied migration: ${name.replace(/\.sql$/, "")}`);
  }
} finally {
  client.release();
  await pool.end();
}
