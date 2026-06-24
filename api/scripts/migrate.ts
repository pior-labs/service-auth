import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../src/db/index.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(dirname, "../drizzle/0000_initial_auth_oauth_provider.sql");
const sql = await readFile(migrationPath, "utf8");

await pool.query(sql);
await pool.end();

console.log("applied migration: 0000_initial_auth_oauth_provider");
