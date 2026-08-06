import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // AUDIT #762 — pinned, and deliberately NOT UTC.
    //
    // CI runs in UTC, where local time and UTC are identical, so a date
    // helper that uses `getFullYear()/getMonth()/getDate()` instead of
    // `toISOString()` behaves the same either way and no test can tell them
    // apart. That is not hypothetical: a mutation swapping `todayISO()` to
    // local-time formatting passed the entire suite under a UTC host.
    //
    // America/Chicago is the app's own fallback business timezone (see
    // `safeTimeZone` in lib/notification-preferences.ts), and being behind
    // UTC means a late-evening local timestamp lands on the *next* UTC day —
    // exactly the skew that makes a calendar date shift by one for real
    // users. Pinning also removes the host as a variable, so a failure is
    // the same failure on every machine.
    env: { TZ: 'America/Chicago' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
