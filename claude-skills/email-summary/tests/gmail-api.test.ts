import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs module before importing the module under test
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock os module
vi.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

import { readFileSync, writeFileSync } from 'fs';
import { getAccessToken, htmlToText } from '../src/gmail-api.js';

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

const VALID_TOKEN = {
  access_token: 'existing-access-token',
  refresh_token: 'my-refresh-token',
  expiry_date: Date.now() + 120_000, // valid for 2 more minutes
};

const EXPIRED_TOKEN = {
  access_token: 'old-access-token',
  refresh_token: 'my-refresh-token',
  expiry_date: Date.now() - 1000, // already expired
};

const OAUTH_KEYS = {
  installed: {
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    redirect_uris: ['http://localhost:3000'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('getAccessToken', () => {
  it('returns existing access_token when token is still valid', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(VALID_TOKEN) as any);

    const token = await getAccessToken();

    expect(token).toBe('existing-access-token');
    expect(fetch).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('refreshes token when expired, saves updated token, returns new access_token', async () => {
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(EXPIRED_TOKEN) as any)  // credentials.json
      .mockReturnValueOnce(JSON.stringify(OAUTH_KEYS) as any);    // gcp-oauth.keys.json

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-access-token', expires_in: 3600 }),
    } as Response);

    const token = await getAccessToken();

    expect(token).toBe('new-access-token');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect((options as RequestInit).method).toBe('POST');

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const savedContent = JSON.parse((mockWriteFileSync.mock.calls[0][1] as string));
    expect(savedContent.access_token).toBe('new-access-token');
    expect(savedContent.refresh_token).toBe('my-refresh-token');
    expect(savedContent.expiry_date).toBeGreaterThan(Date.now());
  });

  it('throws "Token refresh failed: ..." when refresh HTTP call fails', async () => {
    mockReadFileSync
      .mockReturnValueOnce(JSON.stringify(EXPIRED_TOKEN) as any)
      .mockReturnValueOnce(JSON.stringify(OAUTH_KEYS) as any);

    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'invalid_grant',
    } as Response);

    await expect(getAccessToken()).rejects.toThrow('Token refresh failed: invalid_grant');
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
