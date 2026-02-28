# PROJECT KNOWLEDGE BASE

Next.js 16 App Router application with Effect-TS service architecture, Drizzle ORM (PostgreSQL/Neon), better-auth authentication, nuqs URL state management, and Tailwind CSS 4.

## CRITICAL RULES

- **Use `pnpm` exclusively** - not npm or yarn
- **Run `pnpm tsc` before finishing** - ensure types pass
- **Run `pnpm lint` to check for errors** - fix any issues
- **Run `pnpm test:run` to verify tests pass** - fix failures before committing

### Effect-TS Rules (Enforced by ESLint)

| Rule                                            | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `local/no-disable-validation`                   | NEVER use `{ disableValidation: true }`               |
| `local/no-catch-all-cause`                      | NEVER use `Effect.catchCause` - catches defects       |
| `local/no-schema-from-self`                     | NEVER use `*FromSelf` schemas (use standard variants) |
| `local/no-schema-decode-sync`                   | NEVER use sync decode/encode (throws exceptions)      |
| `local/prefer-option-from-nullable`             | Use `Option.fromNullable()` instead of ternary        |
| `@typescript-eslint/no-explicit-any`            | NEVER use `any` type                                  |
| `@typescript-eslint/consistent-type-assertions` | NEVER use `as` type casts                             |

See `patterns/EFFECT_BEST_PRACTICES.md` for detailed explanations and alternatives.

## PATTERNS

**Before implementing any feature, consult `patterns/README.md`.**

- **Patterns describe intent; code describes reality.** Check the codebase first before assuming something is/isn't implemented.
- **Use patterns as guidance.** Follow patterns, types, and architecture defined in relevant files.

## CAPABILITIES

| Capability         | Service   | Details                                              |
| ------------------ | --------- | ---------------------------------------------------- |
| Authentication     | Auth      | Sign up, sign in, sign out, sessions, OTP email flow |
| Database           | Db        | PostgreSQL via Drizzle ORM (Neon serverless)         |
| Email sending      | Email     | Transactional email via Resend                       |
| File upload/manage | S3        | Signed URLs, save, copy, list, delete (AWS S3)       |
| Notifications      | Telegram  | Bot messages to configured chat                      |
| Activity logging   | Activity  | User action logging via Telegram                     |
| Observability      | Telemetry | OpenTelemetry spans + Sentry error tracking          |
| URL state          | nuqs      | Shareable filters, search, pagination via URL params |
| UI components      | shadcn/ui | Base UI primitives (not Radix), see `components/ui/` |

## WHERE TO LOOK

| Task                 | Location                             | Notes                                        |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| Add server action    | `lib/core/[domain]/*-action.ts`      | One action per file, see DATA_ACCESS pattern |
| Add domain function  | `lib/core/[domain]/*.ts`             | Pure Effect functions for business logic     |
| Add new service      | `lib/services/[name]/`               | Follow `lib/services/AGENTS.md` pattern      |
| Add dynamic page     | `app/*/page.tsx`                     | See PAGE_PATTERNS for Suspense pattern       |
| Add API route        | `app/api/[route]/route.ts`           | Only for webhooks/external APIs              |
| Add UI component     | `components/ui/`                     | Uses Base UI, not Radix                      |
| Add tests            | `lib/core/[domain]/*.test.ts`        | Colocated with source, use @effect/vitest    |
| Add E2E tests        | `e2e/`                               | Playwright tests (api/, ui/, fixtures)       |
| Database schema      | `lib/services/db/schema.ts`          | Drizzle ORM                                  |
| Auth flow            | `app/(auth)/`                        | better-auth + OTP email                      |
| Service dependencies | `lib/layers.ts`                      | AppLayer merges all services                 |
| Error types          | `lib/core/errors/index.ts`           | Shared domain errors                         |
| File uploads         | `lib/core/file/*-action.ts`          | S3 signed URLs pattern                       |
| URL state (filters)  | `app/*/search-params.ts`             | nuqs/server imports only, see NUQS pattern   |
| Code style & naming  | `patterns/TYPESCRIPT_CONVENTIONS.md` | Prettier, kebab-case, file naming            |

## CODE MAP

| Symbol                  | Type     | Location                               | Role                                       |
| ----------------------- | -------- | -------------------------------------- | ------------------------------------------ |
| `AppLayer`              | Layer    | `lib/layers.ts`                        | Merged service layer for Effect pipelines  |
| `NextEffect.runPromise` | Function | `lib/next-effect/index.ts`             | Handles redirects outside Effect context   |
| `Auth`                  | Service  | `lib/services/auth/live-layer.ts`      | Authentication (sign in/up/out, sessions)  |
| `Db`                    | Service  | `lib/services/db/live-layer.ts`        | Database (returns Drizzle client)          |
| `Email`                 | Service  | `lib/services/email/live-layer.ts`     | Resend email sending                       |
| `S3`                    | Service  | `lib/services/s3/live-layer.ts`        | AWS S3 file operations                     |
| `Telegram`              | Service  | `lib/services/telegram/live-layer.ts`  | Telegram bot notifications                 |
| `Activity`              | Service  | `lib/services/activity/live-layer.ts`  | Activity logging via Telegram              |
| `TelemetryLayer`        | Layer    | `lib/services/telemetry/live-layer.ts` | OpenTelemetry + Sentry span/log processing |

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                                         | Correct Approach                                      |
| ----------------------------------------------- | ----------------------------------------------------- |
| API routes for CRUD operations                  | Server actions (`lib/core/[domain]/*-action.ts`)      |
| Streaming files through server                  | S3 signed URLs (client uploads directly to S3)        |
| `process.env.X` with throws                     | `yield* Config.string('X')`                           |
| `router.push()` for logout                      | `window.location.href = '/'` (layout cache issue)     |
| Barrel files (`index.ts` re-exports)            | Import from `live-layer.ts` directly                  |
| `Effect.runPromise()` in pages                  | `NextEffect.runPromise()` (handles redirects)         |
| Layer `dependencies` option                     | `Layer.provide()` externally                          |
| Multiple services per directory                 | One service per directory                             |
| Multiple actions per file                       | One action per file ending in `-action.ts`            |
| `useState` for shareable UI state               | nuqs URL state (`app/*/search-params.ts`)             |
| Import `parseAs*` from `nuqs`                   | Import from `nuqs/server` in search-params.ts         |
| Direct data fetch in page component             | Suspense + Content pattern (see PAGE_PATTERNS)        |
| Nested Suspense with async components           | Single Content component fetches all data             |
| Missing `export const dynamic`                  | Add `export const dynamic = 'force-dynamic'` for auth |
| `matchEffect` for error handling                | `catchTag` chains + `Effect.catch` catch-all          |
| `yield* db.select().from(...)` no `.execute()`  | Always add `.execute()` to Drizzle queries            |
| `Config.string('X').pipe(Effect.mapError(...))` | Yield Config directly, map errors on whole block      |

## NOTES

- **No CI/CD configured** - deployment via Vercel auto-deploy
- **React Compiler enabled** - automatic memoization (experimental)
- **PostHog proxied** - requests via `/ph/*` rewrites to bypass ad-blockers
- **Drizzle beta** - using `1.0.0-beta.11`, may have breaking changes
- Effect v4: services use `ServiceMap.Service`, errors use `catchTag` chains + `Effect.catch`
- **LSP shows stale v3 errors** - always use `pnpm tsc` for accurate type checking
- **NextEffect.runPromise** required because Next.js redirects must be called outside try-catch

## SUBDIRECTORY DOCS

- `patterns/README.md` - Architecture and convention patterns index
- `lib/services/AGENTS.md` - Effect-TS service architecture, config, observability patterns
- `components/ui/AGENTS.md` - UI component install sources and customizations
