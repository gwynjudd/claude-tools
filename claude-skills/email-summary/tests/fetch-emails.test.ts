import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock gmail-api module before importing the module under test
vi.mock('../src/gmail-api.js', () => ({
  searchMessages: vi.fn(),
  fetchMessage: vi.fn(),
  htmlToText: vi.fn((html: string) => `TEXT:${html}`),
}))

import { fetchEmails } from '../src/fetch-emails.js'
import { searchMessages, fetchMessage, htmlToText } from '../src/gmail-api.js'

const mockSearch = vi.mocked(searchMessages)
const mockFetch = vi.mocked(fetchMessage)
const mockHtmlToText = vi.mocked(htmlToText)

// Base64url encode a string (Node.js built-in)
function b64url(str: string): string {
  return Buffer.from(str).toString('base64url')
}

// Build a minimal GmailMessage fixture
function makeMessage(opts: {
  id: string
  from?: string
  subject?: string
  snippet?: string
  textBody?: string
  htmlBody?: string
  attachmentFilename?: string
}) {
  const headers = [
    { name: 'From', value: opts.from ?? 'Sender <sender@example.com>' },
    { name: 'Subject', value: opts.subject ?? 'Test Subject' },
    { name: 'Date', value: 'Mon, 1 Jan 2026 00:00:00 +0000' },
  ]

  const parts = []

  if (opts.textBody !== undefined) {
    parts.push({
      mimeType: 'text/plain',
      filename: '',
      body: { data: b64url(opts.textBody), size: opts.textBody.length },
      parts: [],
    })
  }

  if (opts.htmlBody !== undefined) {
    parts.push({
      mimeType: 'text/html',
      filename: '',
      body: { data: b64url(opts.htmlBody), size: opts.htmlBody.length },
      parts: [],
    })
  }

  if (opts.attachmentFilename) {
    parts.push({
      mimeType: 'application/pdf',
      filename: opts.attachmentFilename,
      body: { attachmentId: 'att1', size: 1024 },
      parts: [],
    })
  }

  // If only one content part with no attachment, put it directly on payload
  const singlePart = parts.length === 1 && !opts.attachmentFilename ? parts[0] : null

  return {
    id: opts.id,
    threadId: `t${opts.id}`,
    snippet: opts.snippet ?? '',
    payload: singlePart
      ? {
          mimeType: singlePart.mimeType,
          headers,
          body: singlePart.body,
          parts: [],
        }
      : {
          mimeType: 'multipart/mixed',
          headers,
          body: { size: 0 },
          parts,
        },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchEmails', () => {
  it('deduplicates messages that appear in both searches', async () => {
    const msg = makeMessage({ id: 'abc', textBody: 'hello' })
    mockSearch.mockResolvedValue([{ id: 'abc', threadId: 'tabc' }])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('7d')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('abc')
  })

  it('preserves first-seen order when deduplicating', async () => {
    const msg1 = makeMessage({ id: '1', textBody: 'first' })
    const msg2 = makeMessage({ id: '2', textBody: 'second' })
    const msg3 = makeMessage({ id: '3', textBody: 'third' })

    // search1 returns [1, 2], search2 returns [2, 3] → order: 1, 2, 3
    mockSearch
      .mockResolvedValueOnce([{ id: '1', threadId: 't1' }, { id: '2', threadId: 't2' }])
      .mockResolvedValueOnce([{ id: '2', threadId: 't2' }, { id: '3', threadId: 't3' }])
    mockFetch
      .mockResolvedValueOnce(msg1 as any)
      .mockResolvedValueOnce(msg2 as any)
      .mockResolvedValueOnce(msg3 as any)

    const result = await fetchEmails('7d')

    expect(result.map(r => r.id)).toEqual(['1', '2', '3'])
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('builds correct Gmail query for given period', async () => {
    mockSearch.mockResolvedValue([])

    await fetchEmails('3d')

    expect(mockSearch).toHaveBeenCalledWith(
      'newer_than:3d -category:promotions -category:updates -category:social',
      50,
    )
    expect(mockSearch).toHaveBeenCalledWith('newer_than:3d in:inbox', 50)
  })

  it('extracts plain text body', async () => {
    const msg = makeMessage({ id: '1', textBody: 'Plain text content' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(result[0].body).toBe('Plain text content')
    expect(mockHtmlToText).not.toHaveBeenCalled()
  })

  it('falls back to htmlToText when text/plain is absent', async () => {
    const msg = makeMessage({ id: '1', htmlBody: '<p>Hello</p>' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(mockHtmlToText).toHaveBeenCalledWith('<p>Hello</p>')
    expect(result[0].body).toBe('TEXT:<p>Hello</p>')
  })

  it('falls back to htmlToText when text/plain is the HTML placeholder', async () => {
    const msg = makeMessage({
      id: '1',
      textBody: 'This email message was sent in HTML format',
      htmlBody: '<p>Real content</p>',
    })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(mockHtmlToText).toHaveBeenCalledWith('<p>Real content</p>')
    expect(result[0].body).toBe('TEXT:<p>Real content</p>')
  })

  it('truncates body to --max-body-chars', async () => {
    const msg = makeMessage({ id: '1', textBody: 'abcdefghij' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d', 5)

    expect(result[0].body).toBe('abcde')
  })

  it('sets hasAttachments=true when message has a filename part', async () => {
    const msg = makeMessage({
      id: '1',
      textBody: 'See attached',
      attachmentFilename: 'invoice.pdf',
    })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(result[0].hasAttachments).toBe(true)
  })

  it('sets hasAttachments=false when message has no filename parts', async () => {
    const msg = makeMessage({ id: '1', textBody: 'No attachments here' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(result[0].hasAttachments).toBe(false)
  })

  it('extracts fromEmail from angle-bracket format', async () => {
    const msg = makeMessage({ id: '1', from: 'John Smith <john@example.com>', textBody: 'hi' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(result[0].from).toBe('John Smith <john@example.com>')
    expect(result[0].fromEmail).toBe('john@example.com')
  })

  it('uses bare email address when no angle brackets', async () => {
    const msg = makeMessage({ id: '1', from: 'bare@example.com', textBody: 'hi' })
    mockSearch.mockResolvedValueOnce([{ id: '1', threadId: 't1' }]).mockResolvedValueOnce([])
    mockFetch.mockResolvedValue(msg as any)

    const result = await fetchEmails('1d')

    expect(result[0].fromEmail).toBe('bare@example.com')
  })

  it('returns empty array when both searches return nothing', async () => {
    mockSearch.mockResolvedValue([])

    const result = await fetchEmails('1d')

    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
