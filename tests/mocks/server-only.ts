// No-op stand-in for the `server-only` package, which is provided by the Next.js
// bundler at build time and has no resolvable entry under Vitest/Vite. Importing
// it for real would throw "Failed to resolve import"; this empty module lets
// server modules that guard themselves with `import "server-only"` be unit-tested.
export {}
