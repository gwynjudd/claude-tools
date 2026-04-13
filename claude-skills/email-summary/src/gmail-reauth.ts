/**
 * gmail-reauth.ts
 * Performs a full OAuth 2.0 authorization_code flow to obtain fresh Gmail credentials.
 * Saves the result to ~/.gmail-mcp/credentials.json.
 *
 * Usage:
 *   node_modules/.bin/gmail-reauth
 *   # or via wrapper:
 *   scripts/gmail-reauth.sh
 */

import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { createServer } from 'http';

const home = homedir();
const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || `${home}/.gmail-mcp/gcp-oauth.keys.json`;
const TOKEN_PATH = process.env.GMAIL_TOKEN_PATH || `${home}/.gmail-mcp/credentials.json`;

const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

// 1. Read OAuth client config
const oauthKeys = JSON.parse(readFileSync(OAUTH_PATH, 'utf8')).installed as {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
};

const { client_id, client_secret } = oauthKeys;

// 2. Build authorization URL
const authParams = new URLSearchParams({
  response_type: 'code',
  client_id,
  redirect_uri: REDIRECT_URI,
  scope: SCOPES.join(' '),
  access_type: 'offline',
  prompt: 'consent',
});
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams}`;

// 3. Print URL for user
console.log('Open this URL in your browser:');
console.log(authUrl);
console.log('');

// 4. Start HTTP server and wait for the redirect with ?code=...
const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:3000`);
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
  server.listen(3000, 'localhost', () => {
    // server is listening
  });
  server.on('error', reject);
});

// 5. Exchange code for tokens
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

const credentials = await tokenRes.json();

// 6. Save credentials
writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));

// 7. Confirm
console.log(`Credentials saved to ${TOKEN_PATH}`);
