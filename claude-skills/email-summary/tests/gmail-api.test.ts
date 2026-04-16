import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @gwynj/google-oauth before importing the module under test
vi.mock('@gwynj/google-oauth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

import { getAccessToken as mockGetAccessToken } from '@gwynj/google-oauth';
import { searchMessages, htmlToText } from '../src/gmail-api.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('searchMessages', () => {
  it('calls getAccessToken with "gmail" and uses the token in Authorization header', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: '1', threadId: 't1' }] }),
    } as Response);

    const results = await searchMessages('in:inbox', 10);

    expect(vi.mocked(mockGetAccessToken)).toHaveBeenCalledWith('gmail');
    expect(results).toEqual([{ id: '1', threadId: 't1' }]);

    const [, options] = mockFetch.mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer mock-access-token');
  });

  it('returns empty array when Gmail API returns no messages', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const results = await searchMessages('in:inbox', 10);
    expect(results).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    await expect(searchMessages('q', 10)).rejects.toThrow('Gmail API error 401');
  });
});

describe('htmlToText', () => {
  it('converts table cells: </td> produces two spaces between cells', () => {
    const html = '<table><tr><td>Cell A</td><td>Cell B</td></tr></table>';
    const result = htmlToText(html);
    expect(result).toContain('Cell A');
    expect(result).toContain('Cell B');
    expect(result).toMatch(/Cell A\s+Cell B/);
  });

  it('converts links: <a href="...">text</a> → "text [URL]"', () => {
    const html = '<a href="http://x.com">click</a>';
    const result = htmlToText(html);
    expect(result).toBe('click [http://x.com]');
  });

  it('decodes entities: &nbsp;→space, &amp;→&, &lt;→<', () => {
    const html = 'Hello&nbsp;World &amp; &lt;stuff&gt;';
    const result = htmlToText(html);
    expect(result).toContain('Hello World');
    expect(result).toContain('&');
    expect(result).toContain('<stuff>');
  });

  it('collapses excess blank lines to at most one blank line', () => {
    const html = '<p>First</p><p></p><p></p><p></p><p>Second</p>';
    const result = htmlToText(html);
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });
});
