import { defineConfig } from 'tsup'

export default defineConfig({
  entry:    ['src/cli.ts'],
  format:   ['esm'],
  target:   'node24',
  bundle:   true,
  clean:    true,
  external: ['better-sqlite3'],
  banner:   { js: '#!/usr/bin/env node' },
})
