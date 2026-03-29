#!/usr/bin/env node
/**
 * fetch-email-html
 * Fetches the HTML body of a Gmail message directly via the Gmail API,
 * strips it to plain text, and prints it. Use this when read_email returns
 * "This email message was sent in HTML format" with no readable content.
 *
 * Usage:
 *   fetch-email-html <messageId> [--max-chars N]
 *
 * Reads credentials from:
 *   GMAIL_TOKEN_PATH env var, or ~/.gmail-mcp/credentials.json
 *   GMAIL_OAUTH_PATH env var, or ~/.gmail-mcp/gcp-oauth.keys.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const args = process.argv.slice(2);
const messageId = args.find(a => !a.startsWith('--'));
const maxCharsArg = args.indexOf('--max-chars');
const maxChars = maxCharsArg !== -1 ? parseInt(args[maxCharsArg + 1], 10) : 4000;

if (!messageId) {
  console.error('Usage: fetch-email-html <messageId> [--max-chars N]');
  process.exit(1);
}

const home = homedir();
const TOKEN_PATH  = process.env.GMAIL_TOKEN_PATH  || `${home}/.gmail-mcp/credentials.json`;
const OAUTH_PATH  = process.env.GMAIL_OAUTH_PATH  || `${home}/.gmail-mcp/gcp-oauth.keys.json`;

// --- token management ---

function loadToken() {
  return JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
}

function saveToken(token) {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function getAccessToken() {
  const token = loadToken();
  if (token.expiry_date && Date.now() < token.expiry_date - 60_000) {
    return token.access_token;
  }
  // Refresh
  const creds = JSON.parse(readFileSync(OAUTH_PATH, 'utf8')).installed;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: token.refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const refreshed = await res.json();
  const updated = {
    ...token,
    access_token: refreshed.access_token,
    expiry_date:  Date.now() + refreshed.expires_in * 1000,
  };
  saveToken(updated);
  return updated.access_token;
}

// --- Gmail API ---

async function fetchMessage(accessToken, msgId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- MIME tree traversal ---

function findParts(payload, mimeType) {
  const results = [];
  if (payload.mimeType === mimeType && payload.body?.data) {
    results.push(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    results.push(...findParts(part, mimeType));
  }
  return results;
}

function decodeBase64url(str) {
  // Gmail uses base64url encoding
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

// --- HTML → plain text ---

function htmlToText(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/th>/gi, '  ')
    .replace(/<\/td>/gi, '  ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 [$1]')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#\d+;/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => l || (arr[i - 1] && arr[i + 1]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- main ---

const accessToken = await getAccessToken();
const message = await fetchMessage(accessToken, messageId);
const { payload } = message;

// Print headers
const headers = Object.fromEntries(
  (payload.headers ?? []).map(h => [h.name.toLowerCase(), h.value])
);
console.log(`Subject: ${headers.subject ?? '(no subject)'}`);
console.log(`From:    ${headers.from ?? '(unknown)'}`);
console.log(`Date:    ${headers.date ?? '(unknown)'}`);
console.log('');

// Try HTML first, fall back to plain text
let htmlParts = findParts(payload, 'text/html');
if (htmlParts.length === 0) {
  // Try plain text
  const textParts = findParts(payload, 'text/plain');
  if (textParts.length === 0) {
    console.error('No readable content found in this message.');
    process.exit(1);
  }
  const text = textParts.map(decodeBase64url).join('\n').trim();
  process.stdout.write(text.slice(0, maxChars));
  if (text.length > maxChars) {
    process.stdout.write(`\n\n... [truncated — use --max-chars to see more]`);
  }
} else {
  const raw = htmlParts.map(decodeBase64url).join('\n');
  const text = htmlToText(raw);
  process.stdout.write(text.slice(0, maxChars));
  if (text.length > maxChars) {
    process.stdout.write(`\n\n... [truncated — ${text.length - maxChars} chars remaining, use --max-chars to see more]`);
  }
}
process.stdout.write('\n');
