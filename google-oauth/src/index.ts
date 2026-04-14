/**
 * @gwynj/google-oauth — public API
 *
 * Usage:
 *   import { getAccessToken, reauth, migrateCalendarTokens } from '@gwynj/google-oauth';
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  type Service,
  type TokenEntry,
  OAUTH_KEYS_PATH,
  defaultAccount,
  readToken,
  writeToken,
} from './token-store.js';

export type { Service, TokenEntry };
export { reauth } from './reauth.js';

// ── getAccessToken ──────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given service, refreshing silently if
 * it's within 60 seconds of expiry.
 */
export async function getAccessToken(service: Service, account?: string): Promise<string> {
  const acct = account ?? defaultAccount(service);
  const token = readToken(service, acct);

  if (token.expiry_date && Date.now() < token.expiry_date - 60_000) {
    return token.access_token;
  }

  return refreshToken(service, acct, token);
}

async function refreshToken(service: Service, account: string, token: TokenEntry): Promise<string> {
  const raw = JSON.parse(readFileSync(OAUTH_KEYS_PATH, 'utf8'));
  const creds = raw.installed as { client_id: string; client_secret: string };

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed for ${service}/${account}: ${await res.text()}`);
  }

  const refreshed = await res.json() as { access_token: string; expires_in: number };
  const updated: TokenEntry = {
    ...token,
    access_token: refreshed.access_token,
    expiry_date: Date.now() + refreshed.expires_in * 1000,
  };

  writeToken(service, account, updated);
  return updated.access_token;
}

// ── migrateCalendarTokens ───────────────────────────────────────────────────

/**
 * One-time migration: copies calendar tokens from
 * ~/.config/google-calendar-mcp/tokens.json → ~/.config/google-oauth/tokens.json
 * under the "calendar" key.
 *
 * Source format: { "normal": { access_token, refresh_token, expiry_date, scope, token_type } }
 */
export async function migrateCalendarTokens(): Promise<void> {
  const srcPath = join(homedir(), '.config', 'google-calendar-mcp', 'tokens.json');

  let src: Record<string, TokenEntry>;
  try {
    src = JSON.parse(readFileSync(srcPath, 'utf8')) as Record<string, TokenEntry>;
  } catch (err) {
    throw new Error(`Cannot read source tokens at ${srcPath}: ${(err as Error).message}`);
  }

  for (const [account, token] of Object.entries(src)) {
    writeToken('calendar', account, token);
    console.log(`Migrated calendar/${account}`);
  }

  console.log('Calendar token migration complete.');
}
