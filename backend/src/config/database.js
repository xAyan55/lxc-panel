import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/vmpanel.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE COLLATE NOCASE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      company_name TEXT DEFAULT '',
      theme_color TEXT DEFAULT '#7c3aed',
      max_containers INTEGER DEFAULT 3,
      api_key TEXT UNIQUE,
      api_key_created_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS containers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lxd_name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      image TEXT NOT NULL DEFAULT 'ubuntu:22.04',
      status TEXT NOT NULL DEFAULT 'stopped',
      cpu_limit INTEGER DEFAULT 1,
      ram_limit INTEGER DEFAULT 512,
      disk_limit INTEGER DEFAULT 10,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id INTEGER NOT NULL,
      snapshot_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'manual' CHECK(type IN ('manual', 'scheduled')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed', 'restoring')),
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id INTEGER NOT NULL UNIQUE,
      cron_expression TEXT NOT NULL DEFAULT '0 2 * * *',
      max_keep INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_containers_user ON containers(user_id);
    CREATE INDEX IF NOT EXISTS idx_backups_container ON backups(container_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_apikey ON users(api_key);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
