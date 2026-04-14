/**
 * token-store.ts
 * Read/write ~/.config/google-oauth/tokens.json — the unified token store.
 *
 * Token file format:
 * {
 *   "calendar": { "normal":   { access_token, refresh_token, expiry_date, scope, token_type } },
 *   "gmail":    { "default":  { ... } },
 *   "tasks":    { "default":  { ... } }
 * }
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export type Service = 'calendar' | 'gmail' | 'tasks';

export interface TokenEntry {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
  token_type: string;
}

type TokenStore = {
  [S in Service]?: Record<string, TokenEntry>;
};

const TOKEN_PATH = process.env.GOOGLE_OAUTH_TOKEN_PATH
  || join(homedir(), '.config', 'google-oauth', 'tokens.json');

export const OAUTH_KEYS_PATH = process.env.GOOGLE_OAUTH_KEYS_PATH
  || join(homedir(), '.config', 'google-oauth', 'gcp-oauth.keys.json');

export function defaultAccount(service: Service): string {
  return service === 'calendar' ? 'normal' : 'default';
}

export function readStore(): TokenStore {
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf8')) as TokenStore;
  } catch {
    return {};
  }
}

export function readToken(service: Service, account: string): TokenEntry {
  const store = readStore();
  const entry = store[service]?.[account];
  if (!entry) {
    throw new Error(
      `No token found for ${service}/${account} in ${TOKEN_PATH}. ` +
      `Run: cal auth reauth --account ${account}`
    );
  }
  return entry;
}

export function writeToken(service: Service, account: string, token: TokenEntry): void {
  const store = readStore();
  if (!store[service]) store[service] = {};
  store[service]![account] = token;

  // Atomic write: write to .tmp then rename
  const tmp = TOKEN_PATH + '.tmp';
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, TOKEN_PATH);
}
