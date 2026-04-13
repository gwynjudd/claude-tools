import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('../src/gmail-api.js', () => ({
  downloadAttachment: vi.fn(),
}))

import { saveAttachment, buildFilename } from '../src/save-attachment.js'
import { downloadAttachment } from '../src/gmail-api.js'

const mockDownload = vi.mocked(downloadAttachment)

let targetDir: string

beforeEach(async () => {
  vi.clearAllMocks()
  // Each test gets its own isolated temp directory as the target
  targetDir = await mkdtemp(join(tmpdir(), 'save-att-test-'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildFilename', () => {
  it('formats as YYYY-MM-DD - description.ext', () => {
    expect(buildFilename('2026-01-15', 'quarterly statement', 'pdf')).toBe(
      '2026-01-15 - quarterly statement.pdf',
    )
  })

  it('replaces unsafe characters in description', () => {
    expect(buildFilename('2026-01-15', 'invoice/2026:jan', 'pdf')).toBe(
      '2026-01-15 - invoice_2026_jan.pdf',
    )
  })

  it('replaces all unsafe characters: / \\ : * ? " < > |', () => {
    const result = buildFilename('2026-01-15', 'a/b\\c:d*e?f"g<h>i|j', 'pdf')
    expect(result).toBe('2026-01-15 - a_b_c_d_e_f_g_h_i_j.pdf')
  })
})

describe('saveAttachment', () => {
  it('saves file with correct name in target directory', async () => {
    const bytes = Buffer.from('PDF content here')
    mockDownload.mockResolvedValue(bytes)

    const finalPath = await saveAttachment({
      messageId: 'msg1',
      attachmentId: 'att1',
      targetDir,
      date: '2026-03-01',
      description: 'rental statement',
      ext: 'pdf',
    })

    expect(finalPath).toBe(join(targetDir, '2026-03-01 - rental statement.pdf'))
    const written = await readFile(finalPath)
    expect(written).toEqual(bytes)
  })

  it('leaves no temp file behind after successful save', async () => {
    mockDownload.mockResolvedValue(Buffer.from('data'))

    await saveAttachment({
      messageId: 'msg1',
      attachmentId: 'att1',
      targetDir,
      date: '2026-03-01',
      description: 'test',
      ext: 'pdf',
    })

    const tmpFiles = (await readdir(tmpdir())).filter(f => f.startsWith('save-attachment-'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('throws and writes nothing to target dir when download fails', async () => {
    mockDownload.mockRejectedValue(new Error('network error'))

    await expect(
      saveAttachment({
        messageId: 'msg1',
        attachmentId: 'att1',
        targetDir,
        date: '2026-03-01',
        description: 'test',
        ext: 'pdf',
      }),
    ).rejects.toThrow('Download failed: network error')

    const files = await readdir(targetDir)
    expect(files).toHaveLength(0)
  })

  it('throws and writes nothing to target dir when rename fails', async () => {
    mockDownload.mockResolvedValue(Buffer.from('data'))

    // Make rename fail by passing a non-existent target directory
    const badDir = join(targetDir, 'nonexistent')

    await expect(
      saveAttachment({
        messageId: 'msg1',
        attachmentId: 'att1',
        targetDir: badDir,
        date: '2026-03-01',
        description: 'test',
        ext: 'pdf',
      }),
    ).rejects.toThrow('Rename failed:')

    // Target dir doesn't exist, so no files in it; also verify temp file cleaned up
    const tmpFiles = (await readdir(tmpdir())).filter(f => f.startsWith('save-attachment-'))
    expect(tmpFiles).toHaveLength(0)
  })

  it('handles description with special characters in filename', async () => {
    mockDownload.mockResolvedValue(Buffer.from('data'))

    const finalPath = await saveAttachment({
      messageId: 'msg1',
      attachmentId: 'att1',
      targetDir,
      date: '2026-03-01',
      description: 'invoice/March:2026',
      ext: 'pdf',
    })

    const filename = finalPath.split('/').pop()!
    expect(filename).toBe('2026-03-01 - invoice_March_2026.pdf')

    // File was actually written
    await expect(stat(finalPath)).resolves.toBeTruthy()
  })

  it('passes correct messageId and attachmentId to downloadAttachment', async () => {
    mockDownload.mockResolvedValue(Buffer.from('x'))

    await saveAttachment({
      messageId: 'msg-xyz',
      attachmentId: 'att-abc',
      targetDir,
      date: '2026-01-01',
      description: 'doc',
      ext: 'jpg',
    })

    expect(mockDownload).toHaveBeenCalledWith('msg-xyz', 'att-abc')
  })
})
