# Migration Guide: Effect v4 + Drizzle 1.0

**Status:** Pre-migration planning (both libraries in beta)
**Branch:** `chore/v4-migration-guide`
**Last updated:** 2026-02-28

## Overview

This document tracks all breaking changes from Effect v4 and Drizzle ORM 1.0 that affect this codebase, with exact file locations, before/after examples, and migration order.

**Do not start migration until both libraries reach stable release.**

### Version Changes

| Package                    | Current      | Target     | Notes                            |
| -------------------------- | ------------ | ---------- | -------------------------------- |
| `effect`                   | `^3.19.14`   | `4.x`      | Major rewrite                    |
| `@effect/platform`         | `^0.94.1`    | **Remove** | Merged into `effect`             |
| `@effect/platform-node`    | `^0.104.0`   | `4.x`      | Stays separate                   |
| `@effect/sql`              | `^0.49.0`    | **Remove** | Merged into `effect`             |
| `@effect/sql-pg`           | `^0.50.1`    | `4.x`      | Stays separate                   |
| `@effect/opentelemetry`    | `^0.60.0`    | `4.x`      | Stays separate                   |
| `@effect/vitest`           | `^0.27.0`    | `4.x`      | Stays separate                   |
| `@effect/language-service` | `^0.67.0`    | `4.x`      | Stays separate                   |
| `@effect-aws/client-s3`    | `^1.10.7`    | **TBD**    | Community pkg, v4 compat unknown |
| `drizzle-orm`              | `beta` (0.x) | `1.0.x`    | Major release                    |
| `drizzle-kit`              | `beta`       | `1.0.x`    | Follows drizzle-orm              |

---

## Table of Contents

1. [Migration Order](#migration-order)
2. [Effect v4: Services](#1-services-contexttag--servicemapservice)
3. [Effect v4: Error Handling](#2-error-handling-renames)
4. [Effect v4: Forking](#3-forking-renames)
5. [Effect v4: FiberRef](#4-fiberref--servicemapreference)
6. [Effect v4: Schema](#5-schema-rewrite)
7. [Effect v4: Package Consolidation](#6-package-consolidation)
8. [Effect v4: Runtime / ManagedRuntime](#7-runtime--managedruntime)
9. [Effect v4: Cause](#8-cause-flattened)
10. [Effect v4: Equality](#9-equality)
11. [Effect v4: Yieldable](#10-yieldable-replaces-subtyping)
12. [Effect v4: Layer Memoization](#11-layer-memoization)
13. [Drizzle ORM 1.0](#12-drizzle-orm-10)
14. [Drizzle + Effect Schema Integration](#13-drizzle--effect-schema-integration)
15. [Blockers & Unknowns](#blockers--unknowns)
16. [File Index](#file-index)

---

## Migration Order

Recommended sequence (dependencies flow downward):

1. **Drizzle 1.0** — independent, no Effect coupling
2. **Package consolidation** — update imports from `@effect/platform` and `@effect/sql`
3. **Error handling renames** — mechanical find/replace
4. **Forking renames** — mechanical find/replace
5. **Service definitions** — `Context.Tag` and `Effect.Service` → `ServiceMap.Service`
6. **FiberRef → ServiceMap.Reference** — Activity service redesign
7. **Schema rewrite** — email schema, property tests
8. **Runtime / ManagedRuntime** — API route handler
9. **Drizzle + Effect Schema** — optional, new `drizzle-orm/effect-schema`
10. **Update AGENTS.md and specs** — reflect new patterns

---

## 1. Services: `Context.Tag` → `ServiceMap.Service`

**Impact:** HIGH — 6 services + 5 internal tags
**Upstream docs:** [migration/services.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/services.md)

### 1a. `Context.Tag` definitions (5 files)

All internal config tags must change from `Context.Tag` to `ServiceMap.Service`.

**Before** (`lib/services/auth/live-layer.ts:12`):

```typescript
import { Context } from 'effect'

class AuthDb extends Context.Tag('@app/AuthDb')<AuthDb, ReturnType<typeof drizzle>>() {}
```

**After:**

```typescript
import { ServiceMap } from 'effect'

class AuthDb extends ServiceMap.Service<AuthDb, ReturnType<typeof drizzle>>()('@app/AuthDb') {}
```

Note the argument order change: type params come first via `ServiceMap.Service<Self, Shape>()`, identifier string passed to the returned constructor `(id)`.

**Files to change:**

| Tag              | File                                  | Line  |
| ---------------- | ------------------------------------- | ----- |
| `AuthDb`         | `lib/services/auth/live-layer.ts`     | 12    |
| `AuthConfig`     | `lib/services/auth/live-layer.ts`     | 23-32 |
| `EmailConfig`    | `lib/services/email/live-layer.ts`    | 15-20 |
| `S3Config`       | `lib/services/s3/live-layer.ts`       | 8-15  |
| `TelegramConfig` | `lib/services/telegram/live-layer.ts` | 12-18 |

### 1b. `Effect.Service` definitions (6 services)

All services migrate from `Effect.Service` to `ServiceMap.Service` with `make`.

**Before** (`lib/services/db/live-layer.ts:15-26`):

```typescript
export class Db extends Effect.Service<Db>()('@app/Db', {
  effect: Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return drizzle(client, { schema })
  })
}) {
  static layer = this.Default
  static Live = this.layer.pipe(Layer.provideMerge(PgLive), Layer.provide(NodeContext.layer))
}
```

**After:**

```typescript
export class Db extends ServiceMap.Service<Db>()('@app/Db', {
  make: Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return drizzle(client, { schema })
  })
}) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provideMerge(PgLive),
    Layer.provide(NodeContext.layer)
  )
}
```

Key changes:

- `Effect.Service` → `ServiceMap.Service` (import from `effect`)
- `effect:` option → `make:` option
- `this.Default` → `Layer.effect(this, this.make)`
- v4 convention: single `layer` property instead of `layer` + `Live`
- `dependencies` option removed (already not used in our codebase)

**Files to change:**

| Service    | File                                  | Line   |
| ---------- | ------------------------------------- | ------ |
| `Db`       | `lib/services/db/live-layer.ts`       | 15-26  |
| `Auth`     | `lib/services/auth/live-layer.ts`     | 62-185 |
| `Email`    | `lib/services/email/live-layer.ts`    | 34-82  |
| `S3`       | `lib/services/s3/live-layer.ts`       | 74-289 |
| `Telegram` | `lib/services/telegram/live-layer.ts` | 36-97  |
| `Activity` | `lib/services/activity/live-layer.ts` | 47-102 |

### 1c. Layer composition (`lib/layers.ts`)

Rename `.Live` → `.layer` across the AppLayer composition:

**Before:**

```typescript
export const AppLayer = Layer.mergeAll(
  Auth.Live,
  Db.Live,
  S3.Live,
  Telegram.Live,
  Activity.Live,
  TelemetryLayer
)
```

**After:**

```typescript
export const AppLayer = Layer.mergeAll(
  Auth.layer,
  Db.layer,
  S3.layer,
  Telegram.layer,
  Activity.layer,
  TelemetryLayer
)
```

All consumers importing `.Live` must update to `.layer`.

---

## 2. Error Handling Renames

**Impact:** MEDIUM — ~8 files, mechanical
**Upstream docs:** [migration/error-handling.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/error-handling.md)

| v3                       | v4                   | Used in codebase?                                                  |
| ------------------------ | -------------------- | ------------------------------------------------------------------ |
| `Effect.catchAll`        | `Effect.catch`       | Yes — `lib/next-effect/index.ts:19`, `app/api/example/route.ts:14` |
| `Effect.catchAllCause`   | `Effect.catchCause`  | No (banned by ESLint)                                              |
| `Effect.catchTag`        | `Effect.catchTag`    | No change needed                                                   |
| `Effect.catchSome`       | `Effect.catchFilter` | Not used                                                           |
| `Effect.catchSomeDefect` | Removed              | Not used                                                           |

**Before** (`lib/next-effect/index.ts:19`):

```typescript
Effect.catchAll(Effect.map(effect, Either.right), e =>
  e instanceof RedirectError ? Effect.succeed(Either.left(e)) : Effect.fail(e)
)
```

**After:**

```typescript
Effect.catch(Effect.map(effect, Either.right), e =>
  e instanceof RedirectError ? Effect.succeed(Either.left(e)) : Effect.fail(e)
)
```

**ESLint rule update:** `local/no-catch-all-cause` → rename to match `Effect.catchCause`.

---

## 3. Forking Renames

**Impact:** LOW — 3 files, mechanical
**Upstream docs:** [migration/forking.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/forking.md)

| v3                  | v4                  | Used in codebase?                              |
| ------------------- | ------------------- | ---------------------------------------------- |
| `Effect.fork`       | `Effect.forkChild`  | Yes — tests                                    |
| `Effect.forkDaemon` | `Effect.forkDetach` | Yes — `lib/services/activity/live-layer.ts:90` |
| `Effect.forkScoped` | `Effect.forkScoped` | No change                                      |

**Files to change:**

| File                                  | Line     | Change                                       |
| ------------------------------------- | -------- | -------------------------------------------- |
| `lib/services/activity/live-layer.ts` | 90       | `Effect.forkDaemon` → `Effect.forkDetach`    |
| `lib/core/post/get-posts.test.ts`     | 22       | `Effect.fork(...)` → `Effect.forkChild(...)` |
| `lib/core/post/test-clock.test.ts`    | multiple | `Effect.fork(...)` → `Effect.forkChild(...)` |

---

## 4. FiberRef → ServiceMap.Reference

**Impact:** HIGH — requires architectural redesign of Activity service
**Upstream docs:** [migration/fiberref.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/fiberref.md)

The Activity service uses `FiberRef` for mutable log accumulation within a fiber. In v4, `FiberRef` is removed entirely — replaced by `ServiceMap.Reference` which uses scoped-provide semantics instead of imperative get/set/update.

**Before** (`lib/services/activity/live-layer.ts:14,52,62,85`):

```typescript
const LogsRef = FiberRef.unsafeMake<Log[]>([])

// Add a log entry
FiberRef.update(LogsRef, logs => [...logs, { timestamp, message }])

// Read accumulated logs
let logs = yield * FiberRef.get(LogsRef)

// Reset after sending
yield * FiberRef.set(LogsRef, [])
```

**After (approach 1 — ServiceMap.Reference):**

```typescript
import { ServiceMap } from 'effect'

const LogsRef = ServiceMap.Reference<Log[]>('@app/ActivityLogs', {
  defaultValue: () => []
})

// Reading
const logs = yield * LogsRef

// Writing requires scoped-provide pattern — does NOT support imperative update
```

**Problem:** `ServiceMap.Reference` is read-via-yield, write-via-provide. It doesn't support the imperative `update` pattern our Activity service needs (accumulate logs across multiple `add()` calls, then flush with `send()`).

**Recommended approach:** Replace `FiberRef` with a plain `Ref` (mutable reference) which is still available in v4:

```typescript
import { Effect, Ref } from 'effect'

// Inside the service make effect:
const logsRef = yield* Ref.make<Log[]>([])

const add = (message: string) =>
  Ref.update(logsRef, logs => [
    ...logs,
    { timestamp: new Date().toISOString(), message }
  ]).pipe(Effect.withSpan('Activity.add'))

const send = (...) =>
  Effect.gen(function* () {
    let logs = yield* Ref.get(logsRef)
    // ... format and send ...
    yield* Ref.set(logsRef, [])
  })
```

Note: In v4, `Ref` is no longer a subtype of `Effect` — use `Ref.get(ref)` explicitly instead of `yield* ref`.

---

## 5. Schema Rewrite

**Impact:** HIGH — complete API overhaul
**Upstream docs:** [SCHEMA.md](https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/SCHEMA.md)

### 5a. Email schema (`lib/schemas/email.ts`)

**Before:**

```typescript
import { Schema } from 'effect'

export const EmailSchema = Schema.compose(Schema.Trim, Schema.NonEmptyString).pipe(
  Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  Schema.annotations({ title: 'Email', description: 'A valid email address' }),
  Schema.brand('Email')
)

export type Email = Schema.Schema.Type<typeof EmailSchema>
export const parseEmail = Schema.decodeUnknown(EmailSchema)
```

**After:**

```typescript
import { Schema } from 'effect'

export const EmailSchema = Schema.Trimmed.check(Schema.isNonEmpty())
  .check(Schema.isPattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/))
  .pipe(
    Schema.annotate({ title: 'Email', description: 'A valid email address' }),
    Schema.brand('Email')
  )

export type Email = typeof EmailSchema.Type
export const parseEmail = Schema.decodeUnknownEffect(EmailSchema)
```

Key changes:

- `Schema.compose(Schema.Trim, X)` → `Schema.Trimmed` (built-in trimmed string)
- `Schema.pattern(regex)` → `.check(Schema.isPattern(regex))`
- `Schema.NonEmptyString` → `.check(Schema.isNonEmpty())`
- `Schema.annotations({})` → `Schema.annotate({})`
- `Schema.decodeUnknown` → `Schema.decodeUnknownEffect` (effectful variant)
- `Schema.Schema.Type<T>` → `typeof T.Type`
- `Schema.brand('X')` → `Schema.brand('X')` (unchanged)

### 5b. Property testing (`lib/core/post/property-testing.test.ts`)

**Before:**

```typescript
import { Schema, Arbitrary } from 'effect'

class PostInput extends Schema.Class<PostInput>('PostInput')({
  title: Schema.NonEmptyTrimmedString.pipe(Schema.maxLength(100)),
  content: Schema.optional(Schema.String.pipe(Schema.maxLength(5000))),
  published: Schema.Boolean
}) {}

const postInputArb = Arbitrary.make(PostInput)

// In tests:
yield* Schema.decodeUnknown(PostInput)(input, { errors: 'all', onExcessProperty: 'ignore' })

// Array schemas:
it.prop('...', [Schema.Array(PostInput)], ([posts]) => { ... })
```

**After:**

```typescript
import { Schema } from 'effect'
import { FastCheck } from 'effect/testing'

class PostInput extends Schema.Class<PostInput>('PostInput')({
  title: Schema.Trimmed.check(Schema.isNonEmpty()).check(Schema.isMaxLength(100)),
  content: Schema.optional(Schema.String.check(Schema.isMaxLength(5000))),
  published: Schema.Boolean
}) {}

const postInputArb = Schema.toArbitrary(PostInput)

// In tests:
yield* Schema.decodeUnknownEffect(PostInput)(input, { errors: 'all', onExcessProperty: 'ignore' })

// Array schemas:
it.prop('...', [Schema.Array(PostInput)], ([posts]) => { ... })
```

Key changes:

- `Schema.NonEmptyTrimmedString` → `Schema.Trimmed.check(Schema.isNonEmpty())`
- `.pipe(Schema.maxLength(N))` → `.check(Schema.isMaxLength(N))`
- `Arbitrary.make(schema)` → `Schema.toArbitrary(schema)`
- `Schema.decodeUnknown` → `Schema.decodeUnknownEffect`
- `Schema.Class` still exists with same pattern

### 5c. Schema renames reference table

| v3                             | v4                                                                    |
| ------------------------------ | --------------------------------------------------------------------- |
| `Schema.compose(A, B)`         | `A.pipe(Schema.decodeTo(B))`                                          |
| `Schema.pattern(regex)`        | `.check(Schema.isPattern(regex))`                                     |
| `Schema.filter(fn)`            | `.check(Schema.makeFilter(fn))`                                       |
| `Schema.annotations({})`       | `Schema.annotate({})`                                                 |
| `Schema.NonEmptyString`        | `Schema.String.check(Schema.isNonEmpty())` or `Schema.NonEmptyString` |
| `Schema.NonEmptyTrimmedString` | `Schema.Trimmed.check(Schema.isNonEmpty())`                           |
| `Schema.maxLength(n)`          | `.check(Schema.isMaxLength(n))`                                       |
| `Schema.minLength(n)`          | `.check(Schema.isMinLength(n))`                                       |
| `Schema.decodeUnknown`         | `Schema.decodeUnknownEffect`                                          |
| `Schema.decodeUnknownSync`     | `Schema.decodeUnknownSync` (unchanged)                                |
| `Schema.decodeUnknownEither`   | `Schema.decodeUnknownResult`                                          |
| `Arbitrary.make(schema)`       | `Schema.toArbitrary(schema)`                                          |
| `Schema.optional(X)`           | `Schema.optional(X)` (unchanged)                                      |
| `Schema.brand('X')`            | `Schema.brand('X')` (unchanged)                                       |
| `Schema.Class<T>(tag)({})`     | `Schema.Class<T>(tag)({})` (unchanged)                                |

---

## 6. Package Consolidation

**Impact:** MEDIUM — import path changes
**Upstream docs:** [MIGRATION.md](https://github.com/Effect-TS/effect-smol/blob/main/MIGRATION.md)

### 6a. `@effect/platform` → `effect`

`HttpApp`, `HttpServerResponse` move into core `effect` package.

**Before** (`app/api/example/route.ts:1`):

```typescript
import { HttpApp, HttpServerResponse } from '@effect/platform'
```

**After:**

```typescript
import { HttpApp, HttpServerResponse } from 'effect'
// or possibly from 'effect/unstable/http' if not yet stable
```

### 6b. `@effect/sql` → `effect`

SQL abstractions merged into core. The `SqlError` import changes.

**Before** (`lib/services/retry.ts:2`):

```typescript
import { SqlError } from '@effect/sql'
```

**After:**

```typescript
import { SqlError } from 'effect'
// or from 'effect/unstable/sql'
```

### 6c. `@effect/sql-pg` — stays separate

`PgClient` import path may change within `@effect/sql-pg` v4, but the package remains separate.

### 6d. `@effect/platform-node` — stays separate

`NodeContext` import stays from `@effect/platform-node` but at v4 version.

### 6e. Package.json changes

```diff
  "dependencies": {
-   "@effect/platform": "^0.94.1",
-   "@effect/sql": "^0.49.0",
+   // removed — merged into effect
    "@effect/platform-node": "4.x",
    "@effect/sql-pg": "4.x",
    "@effect/opentelemetry": "4.x",
    "effect": "4.x",
  },
  "devDependencies": {
    "@effect/vitest": "4.x",
    "@effect/language-service": "4.x",
  }
```

---

## 7. Runtime / ManagedRuntime

**Impact:** MEDIUM — 1 file, API unclear
**Upstream docs:** [migration/runtime.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/runtime.md)

`Runtime<R>` is removed in v4. `ManagedRuntime` likely still exists but the `.runtime()` method and `HttpApp.toWebHandlerRuntime` may have changed.

**Before** (`app/api/example/route.ts:27-31`):

```typescript
const managedRuntime = ManagedRuntime.make(AppLayer)
const runtime = await managedRuntime.runtime()
const effectHandler = HttpApp.toWebHandlerRuntime(runtime)(getHandler)

export const GET = (request: Request) => effectHandler(request)
```

**After (likely — verify against v4 API):**

```typescript
// Option A: ManagedRuntime still works but API simplified
const managedRuntime = ManagedRuntime.make(AppLayer)
const effectHandler = HttpApp.toWebHandler(getHandler, { runtime: managedRuntime })

// Option B: Direct provide pattern (no managed runtime needed)
const effectHandler = HttpApp.toWebHandler(getHandler.pipe(Effect.provide(AppLayer)))
```

**Action:** Verify `ManagedRuntime` and `HttpApp.toWebHandler*` API when v4 stabilizes.

---

## 8. Cause (Flattened)

**Impact:** LOW — mostly internal, affects error inspection in tests
**Upstream docs:** [migration/cause.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/cause.md)

`Cause<E>` is now a flat `{ reasons: ReadonlyArray<Reason<E>> }` instead of a recursive tree. The `Sequential` and `Parallel` variants are removed.

Affects `lib/core/post/error-testing.test.ts` where `Effect.exit` is used to inspect `Cause`:

```typescript
// v3: cause._tag === 'Fail'
// v4: cause.reasons[0]._tag === 'Fail'
```

Also `*Exception` classes renamed to `*Error`:

| v3                               | v4                           |
| -------------------------------- | ---------------------------- |
| `Cause.NoSuchElementException`   | `Cause.NoSuchElementError`   |
| `Cause.TimeoutException`         | `Cause.TimeoutError`         |
| `Cause.IllegalArgumentException` | `Cause.IllegalArgumentError` |

---

## 9. Equality

**Impact:** LOW — behavioral change, no code changes needed
**Upstream docs:** [migration/equality.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/equality.md)

`Equal.equals` now uses **structural equality by default** for plain objects, arrays, Maps, Sets, Dates, RegExps. In v3 it was reference equality.

```typescript
// v3: Equal.equals({ a: 1 }, { a: 1 }) → false
// v4: Equal.equals({ a: 1 }, { a: 1 }) → true
```

Also: `NaN === NaN` is now `true` via `Equal.equals`.

No code changes needed, but test assertions using `Equal.equals` may behave differently.

---

## 10. Yieldable (Replaces Subtyping)

**Impact:** LOW-MEDIUM — affects how types interact with Effect combinators
**Upstream docs:** [migration/yieldable.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/yieldable.md)

Many types that were subtypes of `Effect` in v3 no longer are in v4. They implement `Yieldable` instead — `yield*` still works in generators, but they can't be passed directly to Effect combinators.

Relevant to our codebase:

- `Either` — used in `lib/next-effect/index.ts` with `Either.right`/`Either.left`. These are passed to `Effect.succeed(Either.left(e))` which is fine (wrapping in Effect, not treating Either as Effect).
- `Config` — used throughout services. `yield* Config.string(...)` still works via Yieldable.
- `Fiber` — used in tests with `Fiber.join(fiber)` which is already the correct v4 pattern.

**Likely no code changes needed** — our codebase already uses explicit `yield*` patterns.

---

## 11. Layer Memoization

**Impact:** POSITIVE — automatic improvement
**Upstream docs:** [migration/layer-memoization.md](https://github.com/Effect-TS/effect-smol/blob/main/migration/layer-memoization.md)

v4 memoizes layers across `Effect.provide` calls automatically. Our `AppLayer` with `Layer.mergeAll` already follows best practices. `Telegram.Live` won't be built twice (provided by both `Activity.Live` and directly in `AppLayer`).

No code changes needed. Optional: use `Layer.fresh()` or `Effect.provide(layer, { local: true })` in tests for isolation.

---

## 12. Drizzle ORM 1.0

**Impact:** LOW — already on beta, minimal breaking changes expected
**Upstream docs:** [drizzle-orm v1.0.0-beta.15](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-beta.15)

### 12a. Validator packages consolidated

Drizzle has moved all validator packages into `drizzle-orm`:

| Old package       | New import                  |
| ----------------- | --------------------------- |
| `drizzle-zod`     | `drizzle-orm/zod`           |
| `drizzle-valibot` | `drizzle-orm/valibot`       |
| **New**           | `drizzle-orm/effect-schema` |

We don't currently use any validator packages, but the new `drizzle-orm/effect-schema` integration is relevant (see next section).

### 12b. Package versions

```diff
  "dependencies": {
-   "drizzle-orm": "beta",
+   "drizzle-orm": "^1.0.0",
  },
  "devDependencies": {
-   "drizzle-kit": "beta",
-   "drizzle-seed": "beta",
+   "drizzle-kit": "^1.0.0",
+   "drizzle-seed": "^1.0.0",
  }
```

### 12c. `drizzle-orm/effect-postgres`

Our `Db` service uses `drizzle-orm/effect-postgres` which integrates with `@effect/sql-pg`. This import path should remain stable in Drizzle 1.0, but verify the Effect v4 compatibility of `PgClient` from `@effect/sql-pg`.

---

## 13. Drizzle + Effect Schema Integration

**Impact:** OPTIONAL — new capability, not a migration requirement

Drizzle 1.0 introduces `drizzle-orm/effect-schema` which auto-generates Effect Schema validators from your Drizzle table definitions.

**Usage:**

```typescript
import * as p from 'drizzle-orm/pg-core'
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema
} from 'drizzle-orm/effect-schema'
import { Schema } from 'effect'

// Given our existing schema:
// lib/services/db/schema.ts
const users = p.pgTable('users', {
  id: p.serial().primaryKey(),
  name: p.text().notNull(),
  email: p.text().notNull(),
  role: p.text({ enum: ['admin', 'user'] }).notNull(),
  createdAt: p.timestamp('created_at').notNull().defaultNow()
})

// Auto-generated schemas:
const UserInsert = createInsertSchema(users)
const UserUpdate = createUpdateSchema(users)
const UserSelect = createSelectSchema(users)

// With field overrides:
const UserInsert = createInsertSchema(users, {
  role: Schema.String
})

// With refinements:
const UserInsert = createInsertSchema(users, {
  id: schema => schema.pipe(Schema.greaterThanOrEqualTo(0)),
  role: Schema.String
})

// Usage in Effect:
const program = Effect.gen(function* () {
  const parsedUser = yield* Schema.validate(UserInsert)({
    name: 'John Doe',
    email: 'johndoe@test.com',
    role: 'admin'
  })
})
```

**Note:** The `drizzle-orm/effect-schema` API uses v3 Schema syntax in current docs. When Effect v4 Schema API stabilizes, the Drizzle integration will need to update. Wait for both to be stable before adopting.

**Potential use:** Replace manual validation in server actions with Drizzle-derived schemas that stay in sync with the database schema automatically.

---

## Blockers & Unknowns

### Blockers

| Item                                                | Status  | Impact                      |
| --------------------------------------------------- | ------- | --------------------------- |
| `@effect-aws/client-s3` v4 compat                   | Unknown | Blocks S3 service migration |
| `drizzle-orm/effect-postgres` + `@effect/sql-pg` v4 | Unknown | Blocks Db service migration |
| `HttpApp.toWebHandlerRuntime` v4 API                | Unknown | Blocks API route migration  |

### Open Questions

- `@effect-aws/client-s3` v4 support timeline?
- `ManagedRuntime` API unchanged in v4?
- `HttpApp.toWebHandlerRuntime` replacement?
- `Layer.provideMerge` still exists in v4?
- `drizzle-orm/effect-schema` compatible with Effect v4 Schema?
- `@effect/vitest` API (`it.effect`, `it.prop`, `layer()`) unchanged?
- `NodeSdk.layer` from `@effect/opentelemetry` API unchanged?
- ESLint `local/no-catch-all-cause` rule — update for `Effect.catchCause`?

---

## File Index

Every file requiring changes, grouped by migration step.

### Step 1: Package consolidation (imports)

| File                         | Change                                                   |
| ---------------------------- | -------------------------------------------------------- |
| `package.json`               | Remove `@effect/platform`, `@effect/sql`; bump all to v4 |
| `app/api/example/route.ts:1` | `@effect/platform` → `effect`                            |
| `lib/services/retry.ts:2`    | `@effect/sql` → `effect`                                 |

### Step 2: Error handling renames

| File                       | Line | Change                             |
| -------------------------- | ---- | ---------------------------------- |
| `lib/next-effect/index.ts` | 19   | `Effect.catchAll` → `Effect.catch` |
| `app/api/example/route.ts` | 14   | `Effect.catchAll` → `Effect.catch` |

### Step 3: Forking renames

| File                                  | Line     | Change                                    |
| ------------------------------------- | -------- | ----------------------------------------- |
| `lib/services/activity/live-layer.ts` | 90       | `Effect.forkDaemon` → `Effect.forkDetach` |
| `lib/core/post/get-posts.test.ts`     | 22       | `Effect.fork` → `Effect.forkChild`        |
| `lib/core/post/test-clock.test.ts`    | multiple | `Effect.fork` → `Effect.forkChild`        |

### Step 4: Service definitions

| File                                  | Change                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `lib/services/auth/live-layer.ts`     | `Context.Tag` → `ServiceMap.Service` (2 tags), `Effect.Service` → `ServiceMap.Service` |
| `lib/services/db/live-layer.ts`       | `Effect.Service` → `ServiceMap.Service`                                                |
| `lib/services/email/live-layer.ts`    | `Context.Tag` → `ServiceMap.Service` (1 tag), `Effect.Service` → `ServiceMap.Service`  |
| `lib/services/s3/live-layer.ts`       | `Context.Tag` → `ServiceMap.Service` (1 tag), `Effect.Service` → `ServiceMap.Service`  |
| `lib/services/telegram/live-layer.ts` | `Context.Tag` → `ServiceMap.Service` (1 tag), `Effect.Service` → `ServiceMap.Service`  |
| `lib/services/activity/live-layer.ts` | `Effect.Service` → `ServiceMap.Service`, `FiberRef` → `Ref`                            |
| `lib/layers.ts`                       | `.Live` → `.layer`                                                                     |

### Step 5: Schema rewrite

| File                                     | Change                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `lib/schemas/email.ts`                   | Full rewrite (compose → Trimmed.check, pattern → isPattern, etc.)                                       |
| `lib/core/post/property-testing.test.ts` | `Schema.Class` fields, `Arbitrary.make` → `Schema.toArbitrary`, `decodeUnknown` → `decodeUnknownEffect` |

### Step 6: Runtime / API routes

| File                       | Change                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `app/api/example/route.ts` | `ManagedRuntime` + `HttpApp.toWebHandlerRuntime` — verify v4 API |

### Step 7: Error definitions (optional improvement)

| File                              | Change                                                  |
| --------------------------------- | ------------------------------------------------------- |
| `lib/core/errors/index.ts`        | Consider `Data.TaggedError` → `Schema.TaggedErrorClass` |
| `lib/services/auth/errors.ts`     | Consider `Data.TaggedError` → `Schema.TaggedErrorClass` |
| `lib/services/email/errors.ts`    | Consider `Data.TaggedError` → `Schema.TaggedErrorClass` |
| `lib/services/s3/errors.ts`       | Consider `Data.TaggedError` → `Schema.TaggedErrorClass` |
| `lib/services/telegram/errors.ts` | Consider `Data.TaggedError` → `Schema.TaggedErrorClass` |

### Step 8: Tests (Cause changes)

| File                                  | Change                              |
| ------------------------------------- | ----------------------------------- |
| `lib/core/post/error-testing.test.ts` | `Cause` tree → flat `reasons` array |
| `lib/core/post/test-clock.test.ts`    | `Effect.fork` → `Effect.forkChild`  |

### Step 9: Documentation updates

| File                             | Change                                         |
| -------------------------------- | ---------------------------------------------- |
| `AGENTS.md`                      | Update patterns, conventions, code map         |
| `lib/services/AGENTS.md`         | Update service pattern to `ServiceMap.Service` |
| `specs/EFFECT_BEST_PRACTICES.md` | Update all v3 patterns to v4                   |
