import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.MANAVOS_DATA_DIR || "./data");
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const db = new Database(path.join(dataDir, "manavos.db"));
db.pragma("journal_mode=WAL");
db.pragma("foreign_keys=ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  firebase_uid TEXT
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_firebase_uid_idx ON sessions(firebase_uid);
`);

const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
if (!sessionColumns.some(column => column.name === "firebase_uid")) {
  db.exec("ALTER TABLE sessions ADD COLUMN firebase_uid TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS sessions_firebase_uid_idx ON sessions(firebase_uid)");
}

export default db;
