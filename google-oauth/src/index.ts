/**
 * @gwynj/google-oauth — public API
 *
 * Usage:
 *   import { getAccessToken, reauth, migrateCalendarTokens } from '@gwynj/google-oauth';
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
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

// ── migrateGmailTokens ─────────────────────────────────────────────────────

/**
 * One-time migration: copies Gmail tokens from
 * ~/.gmail-mcp/credentials.json → ~/.config/google-oauth/tokens.json
 * under the "gmail/default" key.
 *
 * Also copies ~/.gmail-mcp/gcp-oauth.keys.json → ~/.config/google-oauth/gcp-oauth.keys.json
 * if the unified keys file does not already exist.
 *
 * Source token format: { access_token, refresh_token, expiry_date, scope, token_type }
 */
export async function migrateGmailTokens(): Promise<void> {
  const srcTokenPath = join(homedir(), '.gmail-mcp', 'credentials.json');
  const srcKeysPath  = join(homedir(), '.gmail-mcp', 'gcp-oauth.keys.json');

  let srcToken: TokenEntry;
  try {
    srcToken = JSON.parse(readFileSync(srcTokenPath, 'utf8')) as TokenEntry;
  } catch (err) {
    throw new Error(`Cannot read Gmail token at ${srcTokenPath}: ${(err as Error).message}`);
  }

  writeToken('gmail', 'default', srcToken);
  console.log('Migrated gmail/default');

  // Copy OAuth keys if the unified keys file doesn't already exist
  try {
    readFileSync(OAUTH_KEYS_PATH, 'utf8');
    console.log(`OAuth keys already present at ${OAUTH_KEYS_PATH} — skipping copy`);
  } catch {
    try {
      const keysContent = readFileSync(srcKeysPath, 'utf8');
      mkdirSync(dirname(OAUTH_KEYS_PATH), { recursive: true });
      writeFileSync(OAUTH_KEYS_PATH, keysContent);
      console.log(`Copied OAuth keys to ${OAUTH_KEYS_PATH}`);
    } catch (err) {
      console.warn(`Could not copy OAuth keys from ${srcKeysPath}: ${(err as Error).message}`);
      console.warn('You may need to copy gcp-oauth.keys.json manually.');
    }
  }

  console.log('Gmail token migration complete.');
}

// ── migrateTasksTokens ─────────────────────────────────────────────────────

/**
 * One-time migration: extracts the Google Tasks refresh token from
 * ~/.claude.json (where the gtasks MCP server stores it as an env var)
 * and writes it to ~/.config/google-oauth/tokens.json under "tasks/default".
 *
 * The access_token is left empty and expiry_date is set to 0, so the first
 * call to getAccessToken('tasks') will immediately refresh and populate them.
 */
export async function migrateTasksTokens(): Promise<void> {
  const claudeJsonPath = join(homedir(), '.claude.json');

  let claudeJson: { mcpServers?: Record<string, { env?: Record<string, string> }> };
  try {
    claudeJson = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read ${claudeJsonPath}: ${(err as Error).message}`);
  }

  const refreshToken = claudeJson.mcpServers?.['gtasks']?.env?.['REFRESH_TOKEN'];
  if (!refreshToken) {
    throw new Error(
      `No REFRESH_TOKEN found in mcpServers.gtasks.env in ${claudeJsonPath}. ` +
      `Run reauth instead: import { reauth } from '@gwynj/google-oauth'; await reauth('tasks');`
    );
  }

  writeToken('tasks', 'default', {
    access_token: '',
    refresh_token: refreshToken,
    expiry_date: 0,  // forces immediate refresh on first getAccessToken() call
    scope: 'https://www.googleapis.com/auth/tasks',
    token_type: 'Bearer',
  });

  console.log('Migrated tasks/default (refresh token written; access token will be fetched on first use).');
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
