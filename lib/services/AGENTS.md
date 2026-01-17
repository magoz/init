# Services Architecture

This document defines the patterns for creating services in this codebase. All services must follow these conventions for consistency.

## File Structure

```
lib/services/
├── [service-name]/
│   ├── live-layer.ts    # Service definition and layer
│   ├── errors.ts        # Service-specific errors (optional)
│   └── [helpers].ts     # Additional utilities (optional)
```

- **No barrel files** - Import directly from `live-layer.ts`
- **One service per directory** - Keep services focused and single-purpose

## Service Definition Pattern

Use `Effect.Service` for all service definitions:

```typescript
import { Effect, Layer, Config, Context } from 'effect'
import { ServiceNameError } from './errors'

// Internal configuration (if needed)
class ServiceConfig extends Context.Tag('@app/ServiceConfig')<
  ServiceConfig,
  {
    readonly apiKey: string
  }
>() {}

const ServiceConfigLive = Layer.effect(
  ServiceConfig,
  Effect.gen(function* () {
    const apiKey = yield* Config.string('SERVICE_API_KEY').pipe(
      Effect.mapError(() => new ServiceConfigError({ message: 'SERVICE_API_KEY not found' }))
    )
    return { apiKey }
  })
)

// Service definition
export class ServiceName extends Effect.Service<ServiceName>()('@app/ServiceName', {
  effect: Effect.gen(function* () {
    const config = yield* ServiceConfig

    const methodOne = (arg: string) =>
      Effect.gen(function* () {
        // Implementation
        return result
      }).pipe(Effect.withSpan('ServiceName.methodOne'))

    const methodTwo = () =>
      Effect.gen(function* () {
        // Implementation
      }).pipe(Effect.withSpan('ServiceName.methodTwo'))

    return { methodOne, methodTwo } as const
  }),
  dependencies: [ServiceConfigLive] // Optional: internal layers
}) {}

// Layer export for composition
export const ServiceLive = ServiceName.Default
```

## Naming Conventions

| Element       | Convention               | Example                   |
| ------------- | ------------------------ | ------------------------- |
| Service class | PascalCase, noun         | `Auth`, `Email`, `Db`     |
| Service tag   | `@app/ServiceName`       | `@app/Auth`               |
| Layer export  | `ServiceLive`            | `AuthLive`, `EmailLive`   |
| Methods       | camelCase, verb-first    | `sendEmail`, `getSession` |
| Spans         | `ServiceName.methodName` | `Auth.signIn`             |

## Error Definition Pattern

Define errors in a separate `errors.ts` file using `Data.TaggedError`:

```typescript
import { Data } from 'effect'

export class ServiceApiError extends Data.TaggedError('ServiceApiError')<{
  error: unknown
}> {}

export class ServiceConfigError extends Data.TaggedError('ServiceConfigError')<{
  message: string
}> {}
```

**Error naming:**

- Prefix with service name: `AuthApiError`, `EmailConfigError`
- Common suffixes: `ApiError`, `ConfigError`, `ValidationError`

**Shared errors** (authentication, authorization, not found) belong in `lib/core/errors/`:

```typescript
import { UnauthenticatedError, UnauthorizedError } from '@/lib/core/errors'
```

## Configuration Pattern

Always use Effect's `Config` module - never use `process.env` directly with throws:

```typescript
// Correct
const url = yield * Config.string('DATABASE_URL')
const apiKey = yield * Config.redacted('API_KEY') // For secrets

// Wrong - never do this
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not found')
```

For optional environment variables:

```typescript
const optional =
  yield *
  Config.string('OPTIONAL_VAR').pipe(
    Effect.option,
    Effect.map(opt => (opt._tag === 'Some' ? opt.value : undefined))
  )
```

## Observability Pattern

All service methods must include tracing:

```typescript
const methodName = (arg: string) =>
  Effect.gen(function* () {
    // Add attributes to the span
    yield* Effect.annotateCurrentSpan({
      'service.arg': arg
    })

    const result = yield* doSomething()

    // Add result attributes
    yield* Effect.annotateCurrentSpan({
      'service.resultId': result.id
    })

    return result
  }).pipe(
    Effect.withSpan('ServiceName.methodName'),
    Effect.tapError(error => Effect.logError('Operation failed', { arg, error }))
  )
```

## Layer Composition

Services are composed in `lib/layers.ts`:

```typescript
import { Layer } from 'effect'
import { Auth, AuthDbLive } from './services/auth/live-layer'
import { Email, EmailLive } from './services/email/live-layer'
import { Db, DbLive } from './services/db/live-layer'

// Compose layers with dependencies
export const AuthLayer = Layer.provide(Auth.Default, Layer.merge(AuthDbLive, EmailLive))

// Combined app layer
export const AppLayer = Layer.mergeAll(AuthLayer, DbLive, TelemetryLayer)
```

## Using Services

```typescript
import { Effect } from 'effect'
import { Auth } from '@/lib/services/auth/live-layer'
import { AuthLayer } from '@/lib/layers'

const program = Effect.gen(function* () {
  const auth = yield* Auth
  const session = yield* auth.getSessionFromCookies()
  return session
})

// Run with layer
Effect.runPromise(program.pipe(Effect.provide(AuthLayer)))
```

## Effect v4 Migration

When upgrading to Effect v4, services will migrate from `Effect.Service` to `ServiceMap.Service`:

```typescript
// v3 (current)
export class Auth extends Effect.Service<Auth>()("@app/Auth", {
  effect: Effect.gen(function* () { ... }),
}) {}

// v4 (future)
export class Auth extends ServiceMap.Service<Auth, {
  readonly signIn: (email: string, password: string) => Effect.Effect<Session, AuthError>
  readonly signOut: () => Effect.Effect<void>
}>("@app/Auth") {
  static Live = Layer.effect(this)(
    Effect.gen(function* () { ... })
  )
}
```

## Checklist for New Services

- [ ] Create directory: `lib/services/[name]/`
- [ ] Create `live-layer.ts` with `Effect.Service` pattern
- [ ] Create `errors.ts` with `Data.TaggedError` errors (if needed)
- [ ] Use `Config.*` for all environment variables
- [ ] Add `Effect.withSpan()` to all methods
- [ ] Add `Effect.annotateCurrentSpan()` for relevant attributes
- [ ] Add `Effect.tapError()` for error logging
- [ ] Export `ServiceLive` layer
- [ ] Add layer composition to `lib/layers.ts`
- [ ] Return `as const` from service effect for type inference
