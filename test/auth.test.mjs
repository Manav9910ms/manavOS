import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "manavos-auth-"));
process.env.MANAVOS_DATA_DIR = tmp;
process.env.NODE_ENV = "test";

const { default: db } = await import("../server/db.mjs");
const auth = await import("../server/auth.mjs");

test("password hashing and verification", () => {
  const hash = auth.hashPassword("correct horse battery staple");
  assert.notEqual(hash, "correct horse battery staple");
  assert.equal(auth.verifyPassword("correct horse battery staple", hash), true);
  assert.equal(auth.verifyPassword("wrong password", hash), false);
});

test("server-side session resolves the authenticated user", () => {
  const userId = "test-user";
  const workspaceRoot = path.join(tmp, "workspace");
  fs.mkdirSync(workspaceRoot);
  db.prepare("INSERT INTO users (id,email,name,password_hash,workspace_root,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(userId, "test@example.com", "Test User", auth.hashPassword("password123"), workspaceRoot, Date.now(), Date.now());
  const token = auth.createSession(userId);
  const req = { headers: { cookie: auth.sessionCookie(token) }, socket: {} };
  const user = auth.getUserFromRequest(req);
  assert.equal(user?.id, userId);
  assert.equal(user?.email, "test@example.com");
});

test.after(() => { db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
