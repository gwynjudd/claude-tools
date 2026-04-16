import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/fetch-email-html.ts',
    'src/fetch-emails.ts',
    'src/pre-classify.ts',
    'src/save-attachment.ts',
    'src/search-emails.ts',
    'src/cli.ts',
  ],
  external: ['better-sqlite3'],
  format: ['esm'],
  target: 'node22',
  bundle: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
