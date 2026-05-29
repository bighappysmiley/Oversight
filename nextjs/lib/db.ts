import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || '/tmp/oversight.db';

let db: any = null;
let SQL: any = null;

async function getSql() {
  if (SQL) return SQL;
  // Use require to avoid bundler issues
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();
  return SQL;
}

export async function getDb() {
  if (db) return db;

  const Sql = await getSql();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new Sql.Database(buf);
  } else {
    db = new Sql.Database();
  }

  migrate(db);
  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    // Ignore save errors in serverless
  }
}

function migrate(db: any) {
  db.run(`
    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES parents(id),
      name TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      last_seen INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      device_id TEXT PRIMARY KEY REFERENCES devices(id),
      app_limits TEXT NOT NULL DEFAULT '[]',
      downtime TEXT NOT NULL DEFAULT '{"enabled":false,"start":"22:00","end":"07:00","allowed_apps":[]}',
      website_restrictions TEXT NOT NULL DEFAULT '{"mode":"blocklist","domains":[]}',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      app_name TEXT NOT NULL,
      bundle_id TEXT,
      duration_seconds INTEGER NOT NULL,
      date TEXT NOT NULL,
      recorded_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(device_id, app_name, date)
    );

    CREATE TABLE IF NOT EXISTS web_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      domain TEXT NOT NULL,
      visits INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      recorded_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(device_id, domain, date)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_device_date ON usage_logs(device_id, date);
    CREATE INDEX IF NOT EXISTS idx_web_device_date ON web_logs(device_id, date);

    CREATE TABLE IF NOT EXISTS pair_codes (
      code TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES parents(id),
      device_name TEXT NOT NULL,
      device_id TEXT,
      claimed_at INTEGER,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screen_frames (
      device_id TEXT PRIMARY KEY REFERENCES devices(id),
      frame_data TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      streaming_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
}

// Helper: run a query and return all rows as objects
export function dbAll(db: any, sql: string, params: any[] = []): any[] {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch {
    return [];
  }
}

// Helper: run a query and return first row
export function dbGet(db: any, sql: string, params: any[] = []): any | undefined {
  const rows = dbAll(db, sql, params);
  return rows[0];
}

// Helper: run a query (insert/update/delete)
export function dbRun(db: any, sql: string, params: any[] = []) {
  db.run(sql, params);
  saveDb();
}
