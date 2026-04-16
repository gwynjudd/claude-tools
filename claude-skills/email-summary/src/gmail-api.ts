/**
 * gmail-api.ts
 * Shared Gmail API helpers: message fetching, HTML→text.
 * Token management delegated to @gwynj/google-oauth.
 */

import { getAccessToken } from '@gwynj/google-oauth';

// --- Types ---

export interface MessageSummary {
  id: string;
  threadId: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: {
    partId?: string;
    mimeType?: string;
    filename?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { attachmentId?: string; size: number; data?: string };
    parts?: GmailMessagePart[];
  };
  sizeEstimate?: number;
  raw?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; size: number; data?: string };
  parts?: GmailMessagePart[];
}

// --- Gmail API ---

export async function searchMessages(query: string, maxResults: number): Promise<MessageSummary[]> {
  const accessToken = await getAccessToken('gmail');
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { messages?: MessageSummary[] };
  return data.messages ?? [];
}

export async function fetchMessage(id: string): Promise<GmailMessage> {
  const accessToken = await getAccessToken('gmail');
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<GmailMessage>;
}

export async function downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
  const accessToken = await getAccessToken('gmail');
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { data: string };
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

// --- HTML → plain text ---

export function htmlToText(html: string): string {
  return html
    // Remove style and script blocks (including content)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Block tags → newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    // Table cells → two spaces
    .replace(/<\/th>/gi, '  ')
    .replace(/<\/td>/gi, '  ')
    // List items
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    // Links: text [URL]
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 [$1]')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    // Collapse runs of spaces/tabs to single space
    .replace(/[ \t]{2,}/g, ' ')
    // Trim each line, remove blank lines with no non-blank neighbour
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => l || (arr[i - 1] && arr[i + 1]))
    .join('\n')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
