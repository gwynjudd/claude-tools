/**
 * reauth.ts
 * Full OAuth 2.0 authorization_code flow — opens browser URL, listens on :3000
 * for the redirect, exchanges code for tokens, and writes them to the store.
 */

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { type Service, OAUTH_KEYS_PATH, defaultAccount, writeToken } from './token-store.js';

const REDIRECT_URI = 'http://localhost:3000';

const SCOPES: Record<Service, string[]> = {
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
  tasks: [
    'https://www.googleapis.com/auth/tasks',
  ],
};

function loadOAuthKeys(): { client_id: string; client_secret: string } {
  const raw = JSON.parse(readFileSync(OAUTH_KEYS_PATH, 'utf8'));
  const installed = raw.installed as { client_id: string; client_secret: string };
  if (!installed?.client_id || !installed?.client_secret) {
    throw new Error(`Invalid OAuth keys file at ${OAUTH_KEYS_PATH}`);
  }
  return installed;
}

async function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost:3000');
      const code = url.searchParams.get('code');
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Authentication successful. You may close this tab.');
        server.close();
        resolve(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing code parameter.');
        server.close();
        reject(new Error('No code received in redirect'));
      }
    });
    server.listen(3000, 'localhost');
    server.on('error', reject);
  });
}

export async function reauth(service: Service, account?: string): Promise<void> {
  const acct = account ?? defaultAccount(service);
  const { client_id, client_secret } = loadOAuthKeys();
  const scopes = SCOPES[service];

  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams}`;

  console.log(`Authenticating ${service} (account: ${acct})\n`);
  console.log('Open this URL in your browser:');
  console.log(authUrl);
  console.log('\nWaiting for redirect on http://localhost:3000 ...');

  const code = await waitForCode();

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
  }

  const raw = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  writeToken(service, acct, {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expiry_date: Date.now() + raw.expires_in * 1000,
    scope: raw.scope,
    token_type: raw.token_type,
  });

  console.log(`\nToken saved for ${service}/${acct}.`);
}
