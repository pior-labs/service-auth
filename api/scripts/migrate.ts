import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/db/index.js";

const migrationPath = path.resolve(
  process.cwd(),
  "drizzle/0000_initial_auth_oauth_provider.sql",
);
const sql = await readFile(migrationPath, "utf8");

await pool.query(sql);
await pool.end();

console.log("applied migration: 0000_initial_auth_oauth_provider");
