/**
 * fetch-email-html
 * Fetches the HTML body of a Gmail message directly via the Gmail API,
 * strips it to plain text, and prints it. Use this when read_email returns
 * "This email message was sent in HTML format" with no readable content.
 *
 * Usage:
 *   node_modules/.bin/fetch-email-html <messageId> [--max-chars N]
 *   # or via wrapper:
 *   scripts/fetch-email-html.sh <messageId> [--max-chars N]
 */

import { getAccessToken, fetchMessage, htmlToText } from './gmail-api.js';
import type { GmailMessagePart } from './gmail-api.js';

const args = process.argv.slice(2);
const messageId = args.find(a => !a.startsWith('--'));
const maxCharsArg = args.indexOf('--max-chars');
const maxChars = maxCharsArg !== -1 ? parseInt(args[maxCharsArg + 1], 10) : 4000;

if (!messageId) {
  console.error('Usage: fetch-email-html <messageId> [--max-chars N]');
  process.exit(1);
}

// --- MIME tree traversal ---

function findParts(payload: GmailMessagePart, mimeType: string): string[] {
  const results: string[] = [];
  if (payload.mimeType === mimeType && payload.body?.data) {
    results.push(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    results.push(...findParts(part, mimeType));
  }
  return results;
}

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

// --- main ---

const message = await fetchMessage(messageId);
const { payload } = message;

if (!payload) {
  console.error('No payload found in this message.');
  process.exit(1);
}

// Print headers
const headers = Object.fromEntries(
  (payload.headers ?? []).map(h => [h.name.toLowerCase(), h.value])
);
console.log(`Subject: ${headers['subject'] ?? '(no subject)'}`);
console.log(`From:    ${headers['from'] ?? '(unknown)'}`);
console.log(`Date:    ${headers['date'] ?? '(unknown)'}`);
console.log('');

// Try HTML first, fall back to plain text
const htmlParts = findParts(payload, 'text/html');
if (htmlParts.length === 0) {
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
