/**
 * save-attachment
 * Downloads a Gmail attachment and saves it atomically to a target directory.
 * Writes to a temp file first, then renames on success — nothing touches the
 * target directory if the download or write fails.
 *
 * Usage:
 *   node dist/save-attachment.js \
 *     --message-id <id> --attachment-id <id> \
 *     --target-dir <absolute-path> --date <YYYY-MM-DD> \
 *     --description <text> --ext <pdf|jpg|...>
 *
 * Prints the final absolute path to stdout on success.
 */

import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { writeFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { downloadAttachment } from './gmail-api.js'
import { markAttachmentsDownloaded } from './email-cache.js'

// Characters that are unsafe in filenames — replace with '_'
const UNSAFE_FILENAME_RE = /[/\\:*?"<>|]/g

export function buildFilename(date: string, description: string, ext: string): string {
  const safeDesc = description.replace(UNSAFE_FILENAME_RE, '_').trim()
  return `${date} - ${safeDesc}.${ext}`
}

export interface SaveOptions {
  messageId: string
  attachmentId: string
  targetDir: string
  date: string
  description: string
  ext: string
}

export async function saveAttachment(opts: SaveOptions): Promise<string> {
  const filename = buildFilename(opts.date, opts.description, opts.ext)
  const finalPath = join(opts.targetDir, filename)
  const tempPath = join(tmpdir(), `save-attachment-${randomBytes(8).toString('hex')}.tmp`)

  let bytes: Buffer
  try {
    bytes = await downloadAttachment(opts.messageId, opts.attachmentId)
  } catch (err) {
    throw new Error(`Download failed: ${(err as Error).message}`)
  }

  try {
    await writeFile(tempPath, bytes)
  } catch (err) {
    // Temp write failed — nothing to clean up yet
    throw new Error(`Temp write failed: ${(err as Error).message}`)
  }

  try {
    await rename(tempPath, finalPath)
  } catch (err) {
    // Rename failed — clean up temp file
    await unlink(tempPath).catch(() => undefined)
    throw new Error(`Rename failed: ${(err as Error).message}`)
  }

  markAttachmentsDownloaded(opts.messageId)
  return finalPath
}

// --- CLI entry point ---

async function run(): Promise<void> {
  const args = process.argv.slice(2)

  function flag(name: string): string {
    const idx = args.indexOf(`--${name}`)
    if (idx === -1 || !args[idx + 1]) {
      console.error(`Missing required flag: --${name}`)
      process.exit(1)
    }
    return args[idx + 1]
  }

  const opts: SaveOptions = {
    messageId:    flag('message-id'),
    attachmentId: flag('attachment-id'),
    targetDir:    flag('target-dir'),
    date:         flag('date'),
    description:  flag('description'),
    ext:          flag('ext'),
  }

  try {
    const finalPath = await saveAttachment(opts)
    process.stdout.write(finalPath + '\n')
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  await run()
}
