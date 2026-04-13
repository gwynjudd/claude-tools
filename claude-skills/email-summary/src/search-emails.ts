/**
 * search-emails
 * Searches Gmail with an arbitrary query and returns matching emails as readable text.
 *
 * Usage:
 *   node dist/search-emails.js --query <gmail query> [--max N] [--max-body-chars N]
 *   # or via wrapper:
 *   scripts/search-emails.sh --query "from:scouts.nz Anzac" [--max 5] [--max-body-chars 2000]
 */

import { fileURLToPath } from 'node:url'
import { searchMessages, fetchMessage, htmlToText } from './gmail-api.js'
import type { GmailMessagePart } from './gmail-api.js'

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

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf8')
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return match ? match[1].trim() : from.trim()
}

const HTML_PLACEHOLDER = 'This email message was sent in HTML format'

async function run(): Promise<void> {
  const args = process.argv.slice(2)

  const queryIdx = args.indexOf('--query')
  if (queryIdx === -1 || !args[queryIdx + 1]) {
    console.error('Usage: search-emails --query <gmail query> [--max N] [--max-body-chars N]')
    process.exit(1)
  }
  const query = args[queryIdx + 1]

  const maxIdx = args.indexOf('--max')
  const maxResults = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : 10

  const maxCharsIdx = args.indexOf('--max-body-chars')
  const maxBodyChars = maxCharsIdx !== -1 ? parseInt(args[maxCharsIdx + 1], 10) : 3000

  const messages = await searchMessages(query, maxResults)

  if (messages.length === 0) {
    console.log('No emails found.')
    return
  }

  for (const { id } of messages) {
    const message = await fetchMessage(id)
    const payload = message.payload as GmailMessagePart | undefined

    const headers = Object.fromEntries(
      (payload?.headers ?? []).map(h => [h.name.toLowerCase(), h.value]),
    )

    const from = headers['from'] ?? ''
    const subject = headers['subject'] ?? ''
    const date = headers['date'] ?? ''

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

    if (body.length > maxBodyChars) {
      body = body.slice(0, maxBodyChars) + '\n[truncated]'
    }

    console.log(`ID: ${id}`)
    console.log(`From: ${from}`)
    console.log(`Date: ${date}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body:\n${body}`)
    console.log('---')
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  await run()
}
