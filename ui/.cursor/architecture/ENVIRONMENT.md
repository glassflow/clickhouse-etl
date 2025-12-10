# Environment Variables

## Sources and Flow

1. **System/.env**: `generate-env.mjs` loads `.env` and `.env.local` (if present) and reads process env.
2. **Build-time exposure**: `next.config.ts` exposes selected `NEXT_PUBLIC_*` vars via `env` for build-time embedding.
3. **Runtime injection (client)**: `generate-env.mjs` writes `public/env.js` with `window.__ENV__ = { NEXT_PUBLIC_* }`.
4. **Client load**: `src/app/layout.tsx` includes `<Script src="/env.js" strategy="beforeInteractive" />` so client components can read runtime values from `window.__ENV__`.

## Build-Time Variables

- Next.js embeds `process.env.*` at build; only those present during `next build` are baked into server/client bundles.
- `next.config.ts` maps env to `env: { ... }` for build-time exposure.
- Use `NEXT_PUBLIC_*` for values needed on the client; non-prefixed stay server-only.

## Runtime Variables (client)

- `generate-env.mjs` produces `public/env.js` each time the app starts (see `predev`/`dev` scripts).
- `env.js` serializes `NEXT_PUBLIC_*` into `window.__ENV__`, allowing runtime overrides without rebuild.
- To change at runtime:
  1. Set env vars (e.g., `NEXT_PUBLIC_API_URL`, etc.) in the environment.
  2. Run `node generate-env.mjs` (or restart via `npm run dev`/`node server.js` which calls it in `predev`).
  3. The new `env.js` is served to clients; no Next.js rebuild required if only `env.js` changes.

## Runtime Variables (server)

- Server-side code still reads `process.env.*`. Changes require restarting the server process to pick up new env.
- For Auth0/secure secrets (`AUTH0_*`, etc.), keep them server-side (non-`NEXT_PUBLIC`).

## Changing Values

- **Local dev**: copy `env.example` → `.env.local`, adjust, then `npm run dev` (runs `generate-env.mjs`).
- **Docker/runtime**: set env vars in container runtime; ensure `generate-env.mjs` runs before start to regenerate `public/env.js`.
- **Build-time only**: if a value is consumed only at build, set it in CI/CD env before `next build`.

## Notes on Next.js Constraints

- Next.js statically inlines env at build; without `env.js`, client-side env changes require rebuild.
- `env.js` is the runtime escape hatch for client `NEXT_PUBLIC_*` values; keep it in sync by regenerating when env changes.

## Key Files

- `generate-env.mjs` – loads env, writes `public/env.js`.
- `public/env.js` – runtime client env bundle (`window.__ENV__`).
- `src/app/layout.tsx` – loads `env.js` before hydration.
- `next.config.ts` – exposes build-time env to Next.js.
- `env.example` – template for local env vars.
