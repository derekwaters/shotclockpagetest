# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack, localhost:3000)
npm run build    # Production build (Turbopack)
npm run start    # Run production server
eslint .         # Lint (next lint was removed in v16 — use ESLint CLI directly)
```

`next build` no longer runs linting automatically.

## Architecture

Next.js 16.2.6 app using the **App Router** (`src/app/`). React 19. JavaScript (not TypeScript). Path alias `@/*` maps to `src/*`.

- `src/app/layout.js` — root layout with Geist fonts
- `src/app/page.js` — home page
- `src/app/globals.css` + `page.module.css` — global and scoped styles
- `public/` — static assets

## Next.js 16 Breaking Changes

Read `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` for the full list. Critical differences from prior versions:

### Async Request APIs (fully removed sync access)
`cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are **only async** now. Always `await` them:
```js
export default async function Page({ params }) {
  const { slug } = await params          // correct
  const cookieStore = await cookies()    // correct
}
```

### `middleware` → `proxy`
The `middleware.js` file convention is deprecated. Use `proxy.js` with an exported `proxy` function. The `proxy` runtime is Node.js only — no edge runtime support. If you need edge, keep using `middleware.js`.

### Turbopack is default
Both `next dev` and `next build` use Turbopack by default. Custom webpack configs will cause `next build` to fail. Use `--webpack` flag to opt out, or migrate to Turbopack config (top-level `turbopack` key in `next.config.mjs`, not `experimental.turbopack`).

### Linting
`next lint` is removed. Run `eslint` directly. ESLint flat config format is now default (`eslint.config.mjs`).

### Caching
- `unstable_cacheLife`/`unstable_cacheTag` → now stable: `cacheLife`/`cacheTag` (import from `next/cache`)
- New `'use cache'` directive available (requires `cacheComponents: true` in config)
- `revalidateTag` now requires a second `cacheLife` argument

### Parallel Routes
All parallel route slots require explicit `default.js` files — builds fail without them.

### Removed
- `serverRuntimeConfig` / `publicRuntimeConfig` → use `process.env`
- AMP support entirely removed
- `next lint` command removed
- Synchronous `params`/`searchParams` access removed

### Node.js requirement
Node.js 20.9+ required (18 no longer supported).
