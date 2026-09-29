# AGENTS.md

Stock/POS system for a motorcycle parts shop, running on a server PC in a LAN (no internet dependency). UI and code comments are in **Spanish**; keep new user-facing strings Spanish.

`REQUERIMIENTOS.md` is the requirements source of truth (RF-xx / RNF-xx IDs). GitHub issues cite those IDs — reference the ID in the commit/PR when implementing one.

## Layout — two independent npm packages (no workspaces)

| Path | What |
|---|---|
| `src/` | Backend: Express 5 + TS, run via `tsx` (no build step) |
| `prisma/` | `schema.prisma`, migrations, `seed.ts` |
| `frontend/` | React 19 + Vite + Tailwind 4 SPA — **its own `package.json`/lockfile, must be installed separately** |

## Setup

```bash
npm install
cd frontend && npm install      # separate install, often forgotten
cp .env.example .env            # set JWT_SECRET; Postgres db "stockmanager"
npm run prisma:generate         # REQUIRED, see below
npx prisma migrate dev
npm run seed
npm run dev                     # API on :2060
npm run dev:frontend            # Vite on :5174, proxies /api -> :2060
```

Seed access codes: admin `admin123`, empleado `empleado123`.

## Prisma 7 gotchas

- Prisma CLI config lives in `prisma.config.ts`, **not** `package.json`.
- `prisma generate` **fails without `DATABASE_URL` set** (`env("DATABASE_URL")` throws at config load), even though it doesn't touch the DB. Always have a `.env` (or env var) first.
- Client output is custom: `src/generated/prisma`, which is **gitignored**. After a fresh clone or any `schema.prisma` change you must run `npm run prisma:generate`, otherwise `npx tsc --noEmit` fails on missing `../generated/prisma/client` imports.
- Driver adapter is required: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` — see `src/lib/prisma.ts`. Plain `new PrismaClient()` will not work.

## Verification

```bash
npm run prisma:generate   # only if schema/generated changed
npx tsc --noEmit          # merge criterion (RNF-50); no `typecheck` script exists
npm test                  # vitest run
npx vitest run src/utils/utils.test.ts   # single file
npx vitest run -t "rounds up"            # single test by name
npm --prefix frontend run lint           # oxlint (backend has no linter)
npm --prefix frontend run build          # tsc -b && vite build
```

No CI config exists — these commands are the only gate.

## Architecture

- Entry: `src/index.ts` (loads `dotenv/config`, listens on `0.0.0.0`) → `src/app.ts` (mounts routers, `/uploads` static, 404 + error handlers).
- `routes/*.routes.ts` (wire only) → `middlewares/` → `controllers/` (business logic + Prisma). Business logic lives in controllers; keep it there.
- `src/utils/` holds pure helpers that are unit-testable (`precio.ts`, `codigo.ts`, `normalizar.ts`, `serialize.ts`).
- `uploads/` is created at import time by `src/middlewares/upload.ts` and is gitignored.

## Auth model — easy to break

- Login is a **single code**, not username+password: `POST /api/auth/login { codigo }`, compared with bcrypt against every user's `code` hash (`src/controllers/auth.controller.ts`).
- **Single active admin session** enforced in-process by `src/lib/sessions.ts` (module-level variable, not persisted). A second admin login gets **409** `"Ya hay una sesión de administrador activa"`. A restart clears it. The frontend keeps it alive via `POST /api/auth/heartbeat` from `frontend/src/components/Layout.tsx`; `ADMIN_SESSION_TTL_MIN` (`.env.example` says 30) is the inactivity TTL, hard-capped at 8h.
- `authenticate` must guard every business route (`router.use(authenticate)`), and admin-only operations use `requireRole("ADMIN")`.
- **Employee data hiding (RNF-22):** every endpoint returning articles must pass them through `serializeArticle(article, role)` — it strips `purchasePrice` and `minStock`. Skipping it in a new endpoint leaks costs. Same rule applies to `GET /api/sales` and `GET /api/sales/low-stock`, which filter by `userId` for employees.

## Data model invariants

- `Article.code` is the **primary key**, generated once by `generateCode()` (3 letters from name, accent-stripped, uppercase, fallback `ART` + 3-digit sequence) and treated as immutable. `SaleItem.articleCode` references it — don't introduce a surrogate ID for articles casually.
- `salePrice` is derived, never sent by the client: `calculateSalePrice(purchasePrice, percentage)` rounds **up** to the nearest 100. Update logic must preserve the current margin when `percentage` is omitted (`articles.controller.ts:94-104`).
- `POST /api/sales` validates `paymentMethod` against the `PaymentMethod` enum and refuses insufficient stock; sale creation + stock decrement run in a `prisma.$transaction`. Keep it atomic (RNF-30).
- Migrations are always committed alongside the schema change (RNF-51).

## Conventions

- Commits: `feat:` / `fix:` / `chore:`, one feature per branch (`feat/<slug>`) and per PR (RNF-52). PRs are merged with merge commits.
- Error bodies are `{ error: string }`; status codes: 400 validation, 401 unauthenticated, 403 role, 404 missing, 500 unexpected. The frontend surfaces `body.error` verbatim, so messages must be human-readable.
- Frontend token lives in `localStorage` under `stockmanager_token`; all HTTP goes through `frontend/src/lib/api.ts`, which auto-redirects to `/login` on any 401. Don't add raw `fetch` calls.
- Backend tsconfig is CommonJS with no `moduleResolution` bump; frontend uses `moduleResolution: bundler` + `verbatimModuleSyntax` (type-only imports must use `import type`).

## Known gaps (verify before relying on them)

- Excel import is **backend-only** — `POST /api/import` works but `frontend/src/pages/ImportPage.tsx` is a stub (wizard not built). The endpoint contract is in `issues.md`.
- `POST /api/import` is multipart: **multer only populates `req.body` from text fields that arrive before the file**, so `config`/`sheets` must be appended before `file` in the FormData.
- `frontend/src/lib/api.ts` always sets `Content-Type: application/json` and `JSON.stringify`s the body, so it **cannot send FormData** yet. The import wizard needs that extended.
- Upload limit is 10 MB for both photos and Excel (`MAX_MB` in `src/middlewares/upload.ts`); REQUERIMIENTOS.md RF-44 says 100 MB — not reconciled.
- `src/controllers/articles.controller.ts` `create`/`update` return the raw article without role serialization; safe only because both are admin-only.
- No integration/supertest suite: the tests only cover pure units in `src/utils/` and `src/lib/`. Changes to controllers/routes were verified with a throwaway DB by hand, not by CI.
