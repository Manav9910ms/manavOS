import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
const dataDir=path.resolve(process.env.MANAVOS_DATA_DIR||"./data");
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
const db=new Database(path.join(dataDir,"manavos.db"));
db.pragma("journal_mode=WAL");
db.pragma("foreign_keys=ON");
db.exec(`CREATE TABLE IF NOT EXISTS sessions(
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 workspace_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);`);
export default db;