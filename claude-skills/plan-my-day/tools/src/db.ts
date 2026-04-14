import Database from 'better-sqlite3';
import { DDL } from './schema.js';

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.exec(DDL);
  return db;
}
