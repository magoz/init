# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-17
**Commit:** 1753789
**Branch:** main

## OVERVIEW

Next.js 16 App Router application with Effect-TS service architecture, Drizzle ORM (PostgreSQL/Neon), better-auth authentication, and Tailwind CSS 4.

## CRITICAL RULES

- **Use `pnpm` exclusively** - not npm or yarn
- **Run `pnpm tsc` before finishing** - ensure types pass
- **Run `pnpm lint` to check for errors** - fix any issues

### Effect-TS Rules (Enforced by ESLint)

| Rule                                            | Description                                           |
| ----------------------------------------------- | ----------------------------------------------------- |
| `local/no-disable-validation`                   | NEVER use `{ disableValidation: true }`               |
| `local/no-catch-all-cause`                      | NEVER use `Effect.catchAllCause` - catches defects    |
| `local/no-schema-from-self`                     | NEVER use `*FromSelf` schemas (use standard variants) |
| `local/no-schema-decode-sync`                   | NEVER use sync decode/encode (throws exceptions)      |
| `local/prefer-option-from-nullable`             | Use `Option.fromNullable()` instead of ternary        |
| `@typescript-eslint/no-explicit-any`            | NEVER use `any` type                                  |
| `@typescript-eslint/consistent-type-assertions` | NEVER use `as` type casts                             |

See `specs/EFFECT_BEST_PRACTICES.md` for detailed explanations and alternatives.

## STRUCTURE

```
init/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth route group (login, OTP, logout)
│   ├── (dashboard)/        # Empty - future dashboard
│   └── api/                # API routes (auth catch-all, example)
├── components/ui/          # Modified shadcn/ui + custom components (see AGENTS.md)
├── lib/
│   ├── services/           # Effect-TS service layer (see AGENTS.md)
│   ├── core/               # Domain logic (each subfolder has own errors)
│   ├── next-effect/        # Effect-TS/Next.js adapter
│   ├── schemas/            # Validation schemas
│   ├── layers.ts           # AppLayer composition
│   └── utils.ts            # Utilities (cn helper)
├── instrumentation.ts      # Server-side Sentry + OTel
└── instrumentation-client.ts # Client-side PostHog + Sentry
```

## WHERE TO LOOK

| Task                 | Location                    | Notes                                      |
| -------------------- | --------------------------- | ------------------------------------------ |
| Add new service      | `lib/services/[name]/`      | Follow `lib/services/AGENTS.md` pattern    |
| Add API route        | `app/api/[route]/route.ts`  | Use `ManagedRuntime` pattern               |
| Add page with Effect | `app/*/page.tsx`            | Use `NextEffect.runPromise()`              |
| Add UI component     | `components/ui/`            | Uses Base UI, not Radix                    |
| Database schema      | `lib/services/db/schema.ts` | Drizzle ORM                                |
| Auth flow            | `app/(auth)/`               | better-auth + OTP email                    |
| Service dependencies | `lib/layers.ts`             | AppLayer merges all services               |
| Error types          | `lib/services/*/errors.ts`  | Each service/core subfolder has own errors |

## CODE MAP

| Symbol                  | Type     | Location                              | Role                                      |
| ----------------------- | -------- | ------------------------------------- | ----------------------------------------- |
| `AppLayer`              | Layer    | `lib/layers.ts:10`                    | Merged service layer for Effect pipelines |
| `NextEffect.runPromise` | Function | `lib/next-effect/index.ts`            | Handles redirects outside Effect context  |
| `Auth`                  | Service  | `lib/services/auth/live-layer.ts`     | Authentication (sign in/up/out, sessions) |
| `Db`                    | Service  | `lib/services/db/live-layer.ts`       | Database (returns Drizzle client)         |
| `Email`                 | Service  | `lib/services/email/live-layer.ts`    | Resend email sending                      |
| `S3`                    | Service  | `lib/services/s3/live-layer.ts`       | AWS S3 file operations                    |
| `Telegram`              | Service  | `lib/services/telegram/live-layer.ts` | Telegram bot notifications                |
| `Activity`              | Service  | `lib/services/activity/live-layer.ts` | Activity logging via Telegram             |

## CONVENTIONS

### Code Style (Prettier)

- **No semicolons**
- **No trailing commas**
- Single quotes, 2-space indent, max 100 chars

### Effect-TS Service Pattern

```typescript
// Services use static layer/Live properties for v4 compatibility
export class ServiceName extends Effect.Service<ServiceName>()('@app/ServiceName', {
  effect: Effect.gen(function* () {
    /* ... */
  })
}) {
  static layer = this.Default
  static Live = this.layer.pipe(Layer.provide(ConfigLive))
}
```

### Configuration

- **Always** use `Config.string('VAR')` or `Config.redacted('SECRET')`
- **Never** use `process.env` directly with throws

### Observability

- All service methods: `Effect.withSpan('Service.method')`
- Error logging: `Effect.tapError()`
- Span attributes: `Effect.annotateCurrentSpan()`

### Imports

- Use `@/` path alias for project imports
- **No barrel files** - import directly from source files
- Import services from `live-layer.ts` directly

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                              | Correct Approach                                  |
| ------------------------------------ | ------------------------------------------------- |
| `process.env.X` with throws          | `yield* Config.string('X')`                       |
| `router.push()` for logout           | `window.location.href = '/'` (layout cache issue) |
| Barrel files (`index.ts` re-exports) | Import from `live-layer.ts` directly              |
| `Effect.runPromise()` in pages       | `NextEffect.runPromise()` (handles redirects)     |
| Layer `dependencies` option          | `Layer.provide()` externally (v4 compat)          |
| Multiple services per directory      | One service per directory                         |

## UNIQUE STYLES

### Next.js + Effect Integration

Pages use `NextEffect.runPromise()` which catches `RedirectError` and calls `redirect()` outside the Effect context. This is required because Next.js redirects must be called outside try-catch.

### UI Components

Uses **Base UI** (`@base-ui/react`) primitives instead of Radix UI. Components are shadcn-styled but built on a different foundation. See `components/ui/AGENTS.md`.

### Service Dependency Hierarchy

```
AppLayer
├── Auth.Live → Email.Live
├── Db.Live
├── Telegram.Live
├── Activity.Live → Telegram.Live
└── TelemetryLayer
```

## NOTES

- **No CI/CD configured** - deployment via Vercel auto-deploy
- **React Compiler enabled** - automatic memoization (experimental)
- **PostHog proxied** - requests via `/ph/*` rewrites to bypass ad-blockers
- **Drizzle beta** - using `1.0.0-beta.11`, may have breaking changes
- **No tests yet** - Vitest configured but no test files exist
- Effect v4 migration: services designed for easy `Effect.Service` → `ServiceMap.Service` transition

## SPECS

Detailed conventions and patterns are documented in `specs/`:

| Spec                                                             | Description                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------- |
| [EFFECT_BEST_PRACTICES.md](specs/EFFECT_BEST_PRACTICES.md)       | Critical rules for Effect code                           |
| [TYPESCRIPT_CONVENTIONS.md](specs/TYPESCRIPT_CONVENTIONS.md)     | TypeScript patterns and eslint-disable justification     |
| [EFFECT_TESTING.md](specs/EFFECT_TESTING.md)                     | Testing with @effect/vitest, TestClock, property testing |
| [USABILITY_BEST_PRACTICES.md](specs/USABILITY_BEST_PRACTICES.md) | UX patterns: auth, empty states, errors, forms, a11y     |

## SUBDIRECTORY DOCS

- `lib/services/AGENTS.md` - Effect-TS service architecture patterns
- `components/ui/AGENTS.md` - UI component patterns and customizations
