import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.env.MANAVOS_DATA_DIR || "./data");
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const db = new Database(path.join(dataDir, "manavos.db"));
db.pragma("journal_mode=WAL");
db.pragma("foreign_keys=ON");

function hasColumn(table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some(item => item.name === column);
}

// Fresh-install schemas. Existing databases are migrated below before
// any index or query references newly-added columns.
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  firebase_uid TEXT,
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
`);

// Older manavOS databases predate Firebase Auth and therefore do not have
// firebase_uid on users or sessions. Add those columns before any index is
// created against them. Keeping user.firebase_uid nullable preserves existing
// guest/legacy rows until an account signs in.
if (!hasColumn("users", "firebase_uid")) {
  db.exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT");
}

if (!hasColumn("sessions", "firebase_uid")) {
  db.exec("ALTER TABLE sessions ADD COLUMN firebase_uid TEXT");
}

// Older builds accidentally made sessions.workspace_id UNIQUE. Rebuild that
// table so one Firebase account/workspace can have multiple browser sessions.
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
    const hasOldFirebaseUid = oldColumns.some(column => column.name === "firebase_uid");

    db.exec(
      hasOldFirebaseUid
        ? `
          INSERT INTO sessions(
            id, token_hash, workspace_id, created_at,
            last_seen_at, expires_at, firebase_uid
          )
          SELECT
            id, token_hash, workspace_id, created_at,
            last_seen_at, expires_at, firebase_uid
          FROM sessions_old
        `
        : `
          INSERT INTO sessions(
            id, token_hash, workspace_id, created_at,
            last_seen_at, expires_at, firebase_uid
          )
          SELECT
            id, token_hash, workspace_id, created_at,
            last_seen_at, expires_at, NULL
          FROM sessions_old
        `
    );

    db.exec("DROP TABLE sessions_old");
  })();
}

// firebase_uid is nullable for old guest rows, so use a partial unique index.
// This keeps one Firebase UID mapped to one account while allowing many guests.
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique
  ON users(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_expiry_idx
  ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS sessions_firebase_uid_idx
  ON sessions(firebase_uid);
`);

export default db;
