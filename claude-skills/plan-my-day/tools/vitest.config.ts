import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    server: {
      deps: {
        // better-sqlite3 is a native addon — must not be bundled by Vite
        external: ['better-sqlite3'],
      },
    },
  },
});
