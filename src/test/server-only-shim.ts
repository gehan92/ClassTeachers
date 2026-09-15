// Vitest doesn't have Next.js's bundler-level "you're in a Server
// Component" check that the real `server-only` package relies on, so
// importing it directly under Vitest throws unconditionally. This is a
// test-only stand-in (see vitest.config.ts's alias) — it changes nothing
// about how `import "server-only"` behaves in the real app.
export {};
