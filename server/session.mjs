import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import db from "./db.mjs";

const COOKIE = "manavos_session";
const DAYS = 30;
const WORKSPACES = path.resolve(
  process.env.MANAVOS_WORKSPACES_DIR || "./data/workspaces"
);

fs.mkdirSync(WORKSPACES, { recursive: true, mode: 0o700 });

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseCookie(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) continue;
    out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  }
  return out;
}

function setCookie(res, token, maxAge = DAYS * 86400) {
  const secure =
    process.env.MANAVOS_COOKIE_SECURE === "true" ? " Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
}

export function getSession(req) {
  const token = parseCookie(req.headers.cookie || "")[COOKIE];
  if (!token) return null;

  const row = db
    .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")
    .get(hash(token), Date.now());

  if (!row) return null;

  db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(
    Date.now(),
    row.id
  );

  return {
    id: row.id,
    firebaseUid: row.firebase_uid || null,
    workspaceId: row.workspace_id,
    workspaceRoot: path.join(WORKSPACES, row.workspace_id)
  };
}

export function createGuestSession(res) {
  const id = crypto.randomUUID();
  const workspaceId = `guest-${id}`;
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const workspaceRoot = path.join(WORKSPACES, workspaceId);

  fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o700 });

  db.prepare(
    "INSERT INTO sessions(id, token_hash, workspace_id, created_at, last_seen_at, expires_at, firebase_uid) VALUES(?,?,?,?,?,?,NULL)"
  ).run(id, hash(token), workspaceId, now, now, now + DAYS * 86400000);

  setCookie(res, token);

  return {
    id,
    firebaseUid: null,
    workspaceId,
    workspaceRoot
  };
}

export function ensureSession(req, res) {
  return getSession(req) || createGuestSession(res);
}

function getOrCreateUser({ uid, email, name }, currentSession) {
  const now = Date.now();
  let user = db
    .prepare("SELECT * FROM users WHERE firebase_uid=?")
    .get(uid);

  if (user) {
    db.prepare(
      "UPDATE users SET email=?, name=?, last_seen_at=? WHERE firebase_uid=?"
    ).run(email, name, now, uid);
    user = db.prepare("SELECT * FROM users WHERE firebase_uid=?").get(uid);
    return user;
  }

  // First sign-in can claim the current anonymous workspace.
  // This makes a guest session become a persistent account without
  // forcing a file copy or deleting the user's existing files.
  const workspaceId =
    currentSession && currentSession.firebaseUid === null
      ? currentSession.workspaceId
      : `user-${crypto.randomUUID()}`;

  const workspaceRoot = path.join(WORKSPACES, workspaceId);
  fs.mkdirSync(workspaceRoot, { recursive: true, mode: 0o700 });

  const userId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO users(id, firebase_uid, email, name, workspace_id, created_at, last_seen_at) VALUES(?,?,?,?,?,?,?)"
  ).run(userId, uid, email, name, workspaceId, now, now);

  return db.prepare("SELECT * FROM users WHERE firebase_uid=?").get(uid);
}

export function linkFirebaseSession(req, res, profile) {
  const current = getSession(req);
  const user = getOrCreateUser(profile, current);
  const now = Date.now();

  if (current) {
    db.prepare(
      "UPDATE sessions SET firebase_uid=?, workspace_id=?, last_seen_at=?, expires_at=? WHERE id=?"
    ).run(
      user.firebase_uid,
      user.workspace_id,
      now,
      now + DAYS * 86400000,
      current.id
    );

    return {
      id: current.id,
      firebaseUid: user.firebase_uid,
      workspaceId: user.workspace_id,
      workspaceRoot: path.join(WORKSPACES, user.workspace_id),
      email: user.email,
      name: user.name
    };
  }

  const sessionId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO sessions(id, token_hash, workspace_id, created_at, last_seen_at, expires_at, firebase_uid) VALUES(?,?,?,?,?,?,?)"
  ).run(
    sessionId,
    hash(token),
    user.workspace_id,
    now,
    now,
    now + DAYS * 86400000,
    user.firebase_uid
  );

  setCookie(res, token);

  return {
    id: sessionId,
    firebaseUid: user.firebase_uid,
    workspaceId: user.workspace_id,
    workspaceRoot: path.join(WORKSPACES, user.workspace_id),
    email: user.email,
    name: user.name
  };
}

export function signOut(req, res) {
  const current = getSession(req);
  if (current) {
    db.prepare("DELETE FROM sessions WHERE id=?").run(current.id);
  }
  clearCookie(res);
}

export function cleanupExpiredSessions() {
  const rows = db
    .prepare("SELECT workspace_id, firebase_uid FROM sessions WHERE expires_at<?")
    .all(Date.now());

  db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());

  for (const row of rows) {
    // Account workspaces are persistent and must never be deleted just
    // because a browser session expired.
    if (row.firebase_uid) continue;
    try {
      fs.rmSync(path.join(WORKSPACES, row.workspace_id), {
        recursive: true,
        force: true
      });
    } catch {}
  }
}

export function userPublic(user) {
  return user
    ? {
        uid: user.firebaseUid,
        email: user.email,
        name: user.name
      }
    : null;
}
