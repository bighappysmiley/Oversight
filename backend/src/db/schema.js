const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../oversight.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES parents(id),
      name TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      last_seen INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      device_id TEXT PRIMARY KEY REFERENCES devices(id),
      app_limits TEXT NOT NULL DEFAULT '[]',
      downtime TEXT NOT NULL DEFAULT '{"enabled":false,"start":"22:00","end":"07:00","allowed_apps":[]}',
      website_restrictions TEXT NOT NULL DEFAULT '{"mode":"blocklist","domains":[]}',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      app_name TEXT NOT NULL,
      bundle_id TEXT,
      duration_seconds INTEGER NOT NULL,
      date TEXT NOT NULL,
      recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(device_id, app_name, date)
    );

    CREATE TABLE IF NOT EXISTS web_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      domain TEXT NOT NULL,
      visits INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
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
  `);
}

module.exports = { getDb };
