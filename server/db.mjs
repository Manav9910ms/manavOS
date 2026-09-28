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
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  firebase_uid TEXT
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_firebase_uid_idx ON sessions(firebase_uid);
`);

// Older manavOS builds made workspace_id UNIQUE in sessions, which
// accidentally allowed only one browser session per workspace.
// Migrate that table once so a Firebase account can have many sessions.
const sessionSchema = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'"
).get();

if (sessionSchema?.sql?.includes("workspace_id TEXT NOT NULL UNIQUE")) {
  db.transaction(() => {
    db.exec("ALTER TABLE sessions RENAME TO sessions_old");

    db.exec(`
      CREATE TABLE sessions(
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        workspace_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        firebase_uid TEXT
      );
    `);

    const oldColumns = db.prepare("PRAGMA table_info(sessions_old)").all();
    const hasFirebaseUid = oldColumns.some(column => column.name === "firebase_uid");

    if (hasFirebaseUid) {
      db.exec(`
        INSERT INTO sessions(id, token_hash, workspace_id, created_at, last_seen_at, expires_at, firebase_uid)
        SELECT id, token_hash, workspace_id, created_at, last_seen_at, expires_at, firebase_uid
        FROM sessions_old
      `);
    } else {
      db.exec(`
        INSERT INTO sessions(id, token_hash, workspace_id, created_at, last_seen_at, expires_at, firebase_uid)
        SELECT id, token_hash, workspace_id, created_at, last_seen_at, expires_at, NULL
        FROM sessions_old
      `);
    }

    db.exec("DROP TABLE sessions_old");
  })();
}

const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all();
if (!sessionColumns.some(column => column.name === "firebase_uid")) {
  db.exec("ALTER TABLE sessions ADD COLUMN firebase_uid TEXT");
}

db.exec("CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)");
db.exec("CREATE INDEX IF NOT EXISTS sessions_firebase_uid_idx ON sessions(firebase_uid)");

export default db;
