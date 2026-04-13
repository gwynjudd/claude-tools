/**
 * fetch-emails
 * Fetches all emails from the last N days (two Gmail searches, deduplicated),
 * extracts body text, and outputs a JSON array to stdout.
 *
 * Usage:
 *   node dist/fetch-emails.js --period <1d|7d|...> [--max-body-chars N]
 *   # or via wrapper:
 *   scripts/fetch-emails.sh --period 7d [--max-body-chars 2000]
 */

import { fileURLToPath } from 'node:url'
import { searchMessages, fetchMessage, htmlToText } from './gmail-api.js'
import type { GmailMessagePart } from './gmail-api.js'

export interface EmailRecord {
  id: string
  from: string
  fromEmail: string
  subject: string
  date: string
  snippet: string
  body: string
  hasAttachments: boolean
}

// --- MIME helpers ---

function findParts(payload: GmailMessagePart, mimeType: string): string[] {
  const results: string[] = []
  if (payload.mimeType === mimeType && payload.body?.data) {
    results.push(payload.body.data)
  }
  for (const part of payload.parts ?? []) {
    results.push(...findParts(part, mimeType))
  }
  return results
}

function hasFileParts(payload: GmailMessagePart): boolean {
  if (payload.filename && payload.filename.length > 0) return true
  for (const part of payload.parts ?? []) {
    if (hasFileParts(part)) return true
  }
  return false
}

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].trim() : from.trim()
}

const HTML_PLACEHOLDER = 'This email message was sent in HTML format'

// --- Core logic (exported for testing) ---

export async function fetchEmails(period: string, maxBodyChars?: number): Promise<EmailRecord[]> {
  const [search1, search2] = await Promise.all([
    searchMessages(
      `newer_than:${period} -category:promotions -category:updates -category:social`,
      50,
    ),
    searchMessages(`newer_than:${period} in:inbox`, 50),
  ])

  // Deduplicate — preserve first-seen order
  const seen = new Set<string>()
  const uniqueIds: string[] = []
  for (const msg of [...search1, ...search2]) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id)
      uniqueIds.push(msg.id)
    }
  }

  const records: EmailRecord[] = []

  for (const id of uniqueIds) {
    const message = await fetchMessage(id)
    const payload = message.payload as GmailMessagePart | undefined

    const headers = Object.fromEntries(
      (payload?.headers ?? []).map(h => [h.name.toLowerCase(), h.value]),
    )

    const from = headers['from'] ?? ''
    const fromEmail = extractEmail(from)
    const subject = headers['subject'] ?? ''
    const date = headers['date'] ?? ''
    const snippet = message.snippet ?? ''

    // Extract body: text/plain first; fall back to HTML if empty or placeholder
    let body = ''
    if (payload) {
      const textParts = findParts(payload, 'text/plain')
      if (textParts.length > 0) {
        body = textParts.map(decodeBase64url).join('\n').trim()
      }

      if (!body || body === HTML_PLACEHOLDER) {
        const htmlParts = findParts(payload, 'text/html')
        if (htmlParts.length > 0) {
          body = htmlToText(htmlParts.map(decodeBase64url).join('\n'))
        }
      }
    }

    if (maxBodyChars !== undefined && body.length > maxBodyChars) {
      body = body.slice(0, maxBodyChars)
    }

    const hasAttachments = payload ? hasFileParts(payload) : false

    records.push({ id, from, fromEmail, subject, date, snippet, body, hasAttachments })
  }

  return records
}

// --- CLI entry point ---

async function run(): Promise<void> {
  const args = process.argv.slice(2)

  const periodIdx = args.indexOf('--period')
  if (periodIdx === -1 || !args[periodIdx + 1]) {
    console.error('Usage: fetch-emails --period <1d|7d|...> [--max-body-chars N]')
    process.exit(1)
  }
  const period = args[periodIdx + 1]

  const maxCharsIdx = args.indexOf('--max-body-chars')
  const maxBodyChars = maxCharsIdx !== -1 ? parseInt(args[maxCharsIdx + 1], 10) : undefined

  const emails = await fetchEmails(period, maxBodyChars)
  process.stdout.write(JSON.stringify(emails) + '\n')
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  await run()
}
