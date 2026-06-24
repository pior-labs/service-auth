import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
};

export const verifyPassword = async ({ password, hash }: { password: string; hash: string }) => {
  const [algorithm, salt, stored] = hash.split(":");
  if (algorithm !== "scrypt" || !salt || !stored) return false;

  const storedKey = Buffer.from(stored, "base64url");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
};
