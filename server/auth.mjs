import crypto from "node:crypto";
import db from "./db.mjs";

const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const COOKIE = "manavos_session";
const isProd = process.env.NODE_ENV === "production";

function b64url(value) { return Buffer.from(value).toString("base64url"); }
function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${b64url(salt)}:${b64url(key)}`;
}
export function verifyPassword(password, encoded) {
  try {
    const [, salt64, key64] = String(encoded).split(":");
    const salt = Buffer.from(salt64, "base64url");
    const expected = Buffer.from(key64, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
function parseCookies(header = "") {
  const out = {};
  for (const raw of header.split(";")) {
    const v = raw.trim();
    if (!v) continue;
    const i = v.indexOf("=");
    const key = i < 0 ? v : v.slice(0, i);
    const value = i < 0 ? "" : v.slice(i + 1);
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}
export function sessionCookie(token, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`;
}
export function clearSessionCookie() { return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProd ? "; Secure" : ""}`; }
export function getSessionToken(req) { return parseCookies(req.headers.cookie || "")[COOKIE] || null; }
export function getClientIp(req) { const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(); return forwarded || req.socket.remoteAddress || "unknown"; }

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)")
    .run(crypto.randomUUID(), userId, hashToken(token), now + SESSION_MS, now, now);
  return token;
}
export function destroySession(token) { if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token)); }

export function getUserFromRequest(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const row = db.prepare(`SELECT u.id,u.email,u.name,u.workspace_root,s.id AS session_id,s.expires_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?`).get(hashToken(token), Date.now());
  if (!row) return null;
  db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(Date.now(), row.session_id);
  return { id: row.id, email: row.email, name: row.name, workspaceRoot: row.workspace_root, sessionId: row.session_id };
}

export function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function validatePassword(password) { return typeof password === "string" && password.length >= 8 && password.length <= 128; }
export function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
export function userPublic(user) { return { id: user.id, email: user.email, name: user.name }; }
export const sessionCookieName = COOKIE;
