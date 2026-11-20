# AGENTS.md

This repository is the **Al Bashiroh website**: the Yayasan Bashiroh Robbaniyah site, the SMP IT and SMA IT Al Bashiroh portals, one PPDB form, and the admin panel that edits all of it. It is a Nara 3.5 application.

Project rules on top of Nara's:

- Public pages and the admin panel are written in Indonesian (the school's language). This overrides Nara's English interface-text default for this application; code, commits, API `code` values and docs stay English.
- The repository is public. Never commit database files, uploads, `.env`, or real personal data (staff, students, PPDB applicants). Test fixtures are synthetic.
- Follow the approved design language: paper `#F5F1E8`, forest `#0E3A27`, SMP green `#2F8A1F`, SMA orange `#F26300`, sun `#FFC83D`, ink `#13211A`; Bricolage Grotesque 800 headlines with Plus Jakarta Sans text; solid blocks and crisp white cards, no gradient washes, glows, or tinted chips above headlines.
- Pull requests: one whole problem each, Conventional Commit titles, signed commits; see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

The rest of this file is Nara's own guidance, which still applies.

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Stack: TypeScript, Node.js 22+, Hono + `@hono/node-server`, Vue 3 + Vite + `vue-router`, SQLite (`better-sqlite3`, raw SQL), Zod, Vitest. Session auth owned by the `auth` feature.

Authority: user instruction → this file → [`ARCHITECTURE.md`](./ARCHITECTURE.md) → tests → implementation. Git history explains past decisions; it never overrides current code.

## Architecture model

```text
src/features/<feature>/   contract.ts · index.ts · server/ · web/ (optional) · tests/
src/app/                  server.ts · router.ts · App.vue · pages/ · layouts/
src/shared/               config/ · database/ · logging/ · realtime/ · security/ · storage/
resources/app.ts          thin Vite entry mounting the app shell
```

- `src/features/<feature>/index.ts` is the general/server-facing public boundary. Cross-feature server use imports only from there.
- `src/features/<feature>/web/index.ts` is the optional browser-safe boundary. `src/app/` imports browser surfaces only from there.
- Internals (`server/*`, `web/pages/*`, `web/components/*`, `web/client`) are private. Feature dependencies must be acyclic.
- Details: [`docs/feature-model.md`](./docs/feature-model.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Hard rules

- Feature-first: new capability → `src/features/<name>/` (skeleton via `nara make feature`). Never add global `controllers/`/`services/`/`repositories/` trees.
- Boundaries: never import another feature's `server/*`, `web/pages/*`, `web/components/*`, or `web/client` — use its `index.ts` / `web/index.ts`. Never export server-only symbols through `web/index.ts`.
- Browser code under `web/` must not import `server/` files, `@/shared/database`, Node-only built-ins, or server-only packages.
- Server is authoritative: enforce auth/permissions in Hono routes, never only in Vue. Every `/api` route declares its access with a guard (`signedIn`/`allow`) or `publicRoute`; the server refuses to start otherwise. Permission slugs are `<resource>.<action>`; `admin` bypasses where the route requires it.
- Responses use `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`, English messages, Zod validation at the route boundary via `jsonInput`/`queryInput` (401 auth, 403 permission, 404 absent, 409 conflict, 422 validation). Edits of a shared record send the `revision` they were based on; an older one gets 409 `STALE_REVISION` carrying `current`, which the form merges instead of overwriting.
- Interface text is Indonesian (formal, "Anda") and lives in the page's template; API messages stay English. The UI shows a refusal through `refusalText` in `src/app/account.ts` (an Indonesian sentence per `code`, else the server's `message`) and branches on `code`, never on message text; a Feature's own web components (the media fields) carry the text for their codes beside them (`mediaRefusalText`); every code a route sends is declared in its Feature contract (`<FEATURE>_REFUSAL_CODES`, plus `API_REFUSAL_CODES` from `src/shared/security/codes.ts`).
- Screens follow the approved Al Bashiroh design: tokens and base styles in `resources/albashiroh.css` (paper, forest, SMP green, SMA orange, sun; Bricolage Grotesque 800 headlines over Plus Jakarta Sans, both self-hosted), components from `src/shared/ui` (`AbButton`, `AbField`, `AbDialog`, ...). Solid colour blocks and white cards with a hairline border; no gradient washes, glows, or tinted chips above headlines.
- Admin screens live under `/admin` in `src/app/router.ts`; a route with `meta.admin` renders inside `AdminShell`, and one with `admin.label` is listed in its sidebar, under the `requiresAccess` rule its API enforces.
- Photos and documents go through the `media` Feature: forms use `MediaImageField`/`MediaFileField`, lists use `MediaThumb`, and a missing picture is an empty state ("Belum ada gambar, unggah sekarang"), never a broken image. Files are served at `/media/<id>/<file>`.
- Portal content (Yayasan, SMP, SMA) goes through the `content` Feature: a new kind of entry is a `CONTENT_TYPES` entry in its contract (the admin screens and public API follow it), portal-wide text is `portalSettingsSchema`. Rich text is edited with `RichTextEditor` and saved through `sanitizeRichText`, which keeps only what that toolbar makes and only library images. Public reads are `/api/site/<portal>/...`; the Yayasan portal also lists the schools' `AGGREGATED_TYPES`. Records from the old sites come in through `src/app/old-site-import.ts` (`npm run import:old-site`), keyed by `legacy_ref` so a rerun skips them; it never opens the old file itself, only a read-only temp copy, and its tests use a made-up old database only.
- Public pages are listed once in `src/app/site-map.ts` (no imports, so browser and server both read it): `src/app/site-routes.ts` builds the browser routes from it, `src/app/site-meta.ts` the server's titles, meta tags, status codes and sitemap. A new public page is a `SITE_PAGES` entry plus its page under `src/app/pages/site/`; it renders inside `SiteLayout` through `meta.site`. Site pages read through the plain-fetch client in `src/app/site/site.ts` and use the `s-*` patterns in `resources/site.css`; they never import `src/shared/ui` or admin code, which would pull the admin into the visitor's first download.
- PPDB registrations go through the `ppdb` Feature: the public form posts to `/api/ppdb/applications` (`publicRoute`, rate-limited, a hidden `website` field and a signed form token from `GET /api/ppdb/form`), and the form's fields are `applicationInputSchema`, which the browser form also checks with. Payment details, staff contacts and group links are admin-edited `ppdb_settings`, never code or fixtures. Exports go through `server/export.ts` (CSV with a formula guard, a hand-built XLSX with text cells).
- Tests outside Auth create accounts and grants through `src/app/tests/personas.ts`, never by writing Auth's tables.
- SQL lives in the owning feature's repository via `better-sqlite3` prepared statements; multi-write replacements use transactions. No ORM, no string-interpolated values.
- Locked stack: do not replace Hono, add a frontend framework (React/Svelte/Nuxt/SSR), add a native HTTP engine (Ultimate Express/uWebSockets.js), or wrap Hono/Vue behind a custom Nara abstraction. New dependency genuinely required → prefer the existing stack or standard library and update the actual package manifest (`package.json`). If it changes current architecture, update `ARCHITECTURE.md`; otherwise keep rationale close to the code or test that enforces it.
- No overengineering: no speculative abstractions, plugin systems, caches, DI containers, RPC/ORM/validation frameworks, or duplicated architecture metadata. Keep changes scoped; no mass-formatting, no unrelated refactors, no secrets, no force-push.

## Where work belongs

| Change | Location |
|---|---|
| Business capability | owning `src/features/<feature>/` (`contract.ts`, `server/`, `web/`, `tests/`) |
| HTTP composition, browser routes, app shell | `src/app/` (`server.ts`, `router.ts`, pages/layouts) |
| Business-neutral infra only | `src/shared/` (config, database engine, errors, logging, security) |
| Reusable installable feature | `src/features/<name>/` with a `.nara/` folder (assembly templates, `requirements.json`); shipped by `stage:package` |
| Official Feature code (auth, health, users, activity) | edit `src/features/<name>/` in place, then `npm run nara -- evolve <name>` to record lineage; tests needing the reference app go in its `tests/app/` (not shipped) |
| CLI / architecture engine | `src/cli/` with fixture-backed tests |

## Inspect before editing

Deterministic facts first — no LLM needed, no full-repo scan:

```bash
node build/src/cli/index.js doctor --json
node build/src/cli/index.js context <feature> --json   # context pack: ownership, API, constraints, reading order
node build/src/cli/index.js inspect <feature> --json
node build/src/cli/index.js impact <feature> --json    # dependents before contract changes
```

(Or `npx ts-node -r tsconfig-paths/register src/cli/index.ts <command>` without a build.)

## Verify

Narrow first, full gate before handoff:

```bash
npx vitest run <affected-file-or-dir>
npm run lint                 # server typecheck
npm run check:frontend       # Vue typecheck
npm test                     # full Vitest suite
npm run architecture:doctor  # nara doctor, human-readable
npm run check                # all of the above combined
npm run build                # production client + server
```

Database-backed routes need migrations first: `npm run migrate` (`seed`, `db:check` as needed). Production: `npm run build && npm start` (requires `build/client/index.html`).

## Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — current architecture authority
- [`README.md`](./README.md) — first run, topology, deployment
- [`docs/cli.md`](./docs/cli.md) — CLI and JSON reference
- [`docs/database-lifecycle.md`](./docs/database-lifecycle.md) — SQLite lifecycle, scheduled backups, restore
- [`docs/deployment.md`](./docs/deployment.md) — production behind a reverse proxy
- [`docs/auth.md`](./docs/auth.md) — registration policy, `declareRoles`, app-owned auth pages, limits
- [`SECURITY.md`](./SECURITY.md) — security reporting and model notes

Keep it boring where the ecosystem solves it; keep it explicit where ownership matters.
