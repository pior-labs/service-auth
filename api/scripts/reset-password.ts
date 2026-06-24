import { and, eq } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { db } from "../src/db/index.js";
import { account, user } from "../src/db/schema.js";
import { hashPassword } from "../src/password.js";

const args = process.argv.slice(2);
let email = args[0] ?? process.env.RESET_PASSWORD_EMAIL;
let password = args[1] ?? process.env.RESET_PASSWORD_NEW_PASSWORD;

if (!email || !password) {
  const rl = createInterface({ input, output });
  email = email || (await rl.question("Email: "));
  password = password || (await rl.question("New password: "));
  rl.close();
}

if (!email || !password) throw new Error("email and new password are required");

const targetUser = await db.query.user.findFirst({ where: eq(user.email, email) });
if (!targetUser) throw new Error(`no user found for ${email}`);

const passwordHash = await hashPassword(password);
const result = await db
  .update(account)
  .set({ password: passwordHash, updatedAt: new Date() })
  .where(and(eq(account.userId, targetUser.id), eq(account.providerId, "credential")));

console.log(`password updated for ${email}`);
process.exit(0);
