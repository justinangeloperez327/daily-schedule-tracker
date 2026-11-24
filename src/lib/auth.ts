import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, type UserRole } from "@/lib/auth-constants";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export type AuthUser = { id: string; username: string; name: string; role: UserRole };

export class UnauthorizedError extends Error {
  constructor(message = "Sign in to continue.") { super(message); this.name = "UnauthorizedError"; }
}
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission for this action.") { super(message); this.name = "ForbiddenError"; }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return "scrypt$" + salt.toString("base64") + "$" + key.toString("base64");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !keyText) return false;
  const expected = Buffer.from(keyText, "base64");
  const actual = await scrypt(password, Buffer.from(saltText, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used to keep login timing similar whether or not the username exists.
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const prisma = getPrisma();
  // Opportunistically clear this user's expired sessions.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await getPrisma().session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await getPrisma().session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  const { id, username, name, role } = session.user;
  return { id, username, name, role: role === "admin" ? "admin" : "user" };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
}
