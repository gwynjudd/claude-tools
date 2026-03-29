#!/usr/bin/env node
/**
 * extract-email-body
 * Extracts readable plain text from an MCP Gmail tool-result JSON file.
 * These files are created when read_email returns a response too large for
 * the context window.
 *
 * Usage:
 *   extract-email-body <file> [--max-chars N]
 *
 * Options:
 *   --max-chars N   Truncate output to N characters (default: 4000)
 */

import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
const maxCharsArg = args.indexOf('--max-chars');
const maxChars = maxCharsArg !== -1 ? parseInt(args[maxCharsArg + 1], 10) : 4000;

if (!filePath) {
  console.error('Usage: extract-email-body <file> [--max-chars N]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(filePath, 'utf8'));

const raw = data
  .filter(item => item.type === 'text')
  .map(item => item.text)
  .join('\n');

const clean = raw
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&zwnj;/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/[ \t]{2,}/g, ' ')
  .split('\n')
  .map(l => l.trim())
  .filter((l, i, arr) => l || (arr[i - 1] && arr[i + 1]))  // drop blank lines unless surrounded by content
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

process.stdout.write(clean.slice(0, maxChars));
if (clean.length > maxChars) {
  process.stdout.write(`\n\n... [truncated — ${clean.length - maxChars} chars remaining, use --max-chars to see more]`);
}
process.stdout.write('\n');
