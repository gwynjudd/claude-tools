import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/fetch-email-html.ts',
    'src/fetch-emails.ts',
    'src/gmail-reauth.ts',
    'src/pre-classify.ts',
    'src/save-attachment.ts',
    'src/search-emails.ts',
  ],
  format: ['esm'],
  target: 'node22',
  bundle: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
