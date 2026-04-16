/**
 * email-cache.ts
 * SQLite-backed cache for email classification state.
 *
 * DB location: ~/.config/email-summary/email-cache.db
 *
 * Row presence = step 2 has run for this email.
 *   pre_classification = null, ai_classification = null  → no rule match, AI not yet done
 *   pre_classification set, ai_classification = null     → rule matched, AI not needed
 *   ai_classification set                                → fully classified
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const DB_PATH = join(homedir(), '.config', 'email-summary', 'email-cache.db');

export interface CacheEntry {
  external_id: string;
  pre_classification: string | null;
  ai_classification: string | null;
  attachments_downloaded: boolean;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS email_cache (
      external_id            TEXT PRIMARY KEY,
      pre_classification     TEXT,
      ai_classification      TEXT,
      attachments_downloaded INTEGER NOT NULL DEFAULT 0
    )
  `);
  return _db;
}

/**
 * Bulk lookup — returns only found rows (missing = never seen).
 */
export function getClassifications(ids: string[]): Map<string, CacheEntry> {
  if (ids.length === 0) return new Map();
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM email_cache WHERE external_id IN (${placeholders})`)
    .all(...ids) as Array<{
      external_id: string;
      pre_classification: string | null;
      ai_classification: string | null;
      attachments_downloaded: number;
    }>;
  const map = new Map<string, CacheEntry>();
  for (const row of rows) {
    map.set(row.external_id, {
      external_id: row.external_id,
      pre_classification: row.pre_classification,
      ai_classification: row.ai_classification,
      attachments_downloaded: row.attachments_downloaded === 1,
    });
  }
  return map;
}

/**
 * Called after step 2 — always creates/updates row.
 * category = null means no rule matched.
 */
export function storeStep2Result(id: string, category: string | null): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO email_cache (external_id, pre_classification)
    VALUES (?, ?)
    ON CONFLICT(external_id) DO UPDATE SET pre_classification = excluded.pre_classification
  `).run(id, category);
}

/**
 * Called after step 3 — upserts ai_classification.
 */
export function storeAiClassification(id: string, category: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO email_cache (external_id, ai_classification)
    VALUES (?, ?)
    ON CONFLICT(external_id) DO UPDATE SET ai_classification = excluded.ai_classification
  `).run(id, category);
}

/**
 * Called after successful attachment download — sets attachments_downloaded = 1.
 */
export function markAttachmentsDownloaded(id: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO email_cache (external_id, attachments_downloaded)
    VALUES (?, 1)
    ON CONFLICT(external_id) DO UPDATE SET attachments_downloaded = 1
  `).run(id);
}
