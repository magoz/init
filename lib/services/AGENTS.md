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

Use `ServiceMap.Service` with `make` and a static `layer` property:

```typescript
import { Effect, Layer, Config, ServiceMap } from 'effect'
import { ServiceNameError } from './errors'

// Internal configuration (if needed)
class ServiceConfig extends ServiceMap.Service<ServiceConfig, { readonly apiKey: string }>()(
  '@app/ServiceConfig'
) {}

const ServiceConfigLive = Layer.effect(
  ServiceConfig,
  Effect.gen(function* () {
    const apiKey = yield* Config.string('SERVICE_API_KEY')
    return { apiKey }
  }).pipe(Effect.mapError(() => new ServiceConfigError({ message: 'Config missing' })))
)

// Service definition
export class ServiceName extends ServiceMap.Service<ServiceName>()('@app/ServiceName', {
  make: Effect.gen(function* () {
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
  })
}) {
  // Composed layer with all dependencies satisfied
  static layer = Layer.effect(this, this.make).pipe(Layer.provide(ServiceConfigLive))
}
```

Key patterns:

- `ServiceMap.Service<Self>()('id', { make: ... })` for services with effectful constructors
- `ServiceMap.Service<Self, Shape>()('id')` for interface-only services (used in tests)
- `Layer.effect(this, this.make)` builds a layer from the make effect
- `Layer.provide(...)` wires dependencies externally (no `dependencies` option)
- Convention: single `layer` property (not `layer` + `Live`)

## Naming Conventions

| Element       | Convention               | Example                   |
| ------------- | ------------------------ | ------------------------- |
| Service class | PascalCase, noun         | `Auth`, `Email`, `Db`     |
| Service tag   | `@app/ServiceName`       | `@app/Auth`               |
| Static layer  | `layer`                  | `Auth.layer`              |
| Methods       | camelCase, verb-first    | `sendEmail`, `getSession` |
| Spans         | `ServiceName.methodName` | `Auth.signIn`             |

## Error Definition Pattern

Define errors in a separate `errors.ts` file using `Schema.TaggedError`:

```typescript
import * as Schema from 'effect/Schema'

// Schema.TaggedError provides automatic type guards via Schema.is()
export class ServiceApiError extends Schema.TaggedError<ServiceApiError>()('ServiceApiError', {
  error: Schema.Unknown
}) {
  get message(): string {
    return `API error: ${String(this.error)}`
  }
}

export class ServiceConfigError extends Schema.TaggedError<ServiceConfigError>()(
  'ServiceConfigError',
  { message: Schema.String }
) {}

// Type guards are automatically derived
export const isServiceApiError = Schema.is(ServiceApiError)
export const isServiceConfigError = Schema.is(ServiceConfigError)
```

**Why Schema.TaggedError over Data.TaggedError:**

- `Schema.is()` creates type guards automatically
- Better integration with Schema validation
- Enables serialization/deserialization of errors
- See `patterns/EFFECT_BEST_PRACTICES.md` for detailed patterns

**Error naming:**

- Prefix with service name: `AuthApiError`, `EmailConfigError`
- Common suffixes: `ApiError`, `ConfigError`, `ValidationError`

**Domain errors** belong in each `lib/core/[domain]/errors.ts` file, colocated with domain logic.

## Configuration Pattern

Always use Effect's `Config` module — never use `process.env` directly with throws.

Config values are **Yieldable** but NOT `Effect` subtypes — yield directly, map errors on the whole block:

```typescript
// Correct — yield directly
const url = yield* Config.string('DATABASE_URL')
const apiKey = yield* Config.redacted('API_KEY') // For secrets

// Error mapping — wrap the whole block, not individual configs
Effect.gen(function* () {
  const url = yield* Config.string('DATABASE_URL')
  const key = yield* Config.redacted('API_KEY')
  return { url, key }
}).pipe(Effect.mapError(() => new ConfigError({ message: 'Config missing' })))

// Wrong — Config is not an Effect, cannot pipe with Effect operators
Config.string('URL').pipe(Effect.mapError(...)) // ERROR in v4
```

For optional environment variables:

```typescript
const optional = yield * Config.option(Config.string('OPTIONAL_VAR'))
// Returns Option<string>
const value = optional._tag === 'Some' ? optional.value : undefined
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
import { Auth } from './services/auth/live-layer'
import { Db } from './services/db/live-layer'

// Combined app layer — each .layer is fully self-contained
export const AppLayer = Layer.mergeAll(
  Auth.layer,
  Db.layer,
  S3.layer,
  Telegram.layer,
  Activity.layer,
  TelemetryLayer
)
```

### Layer Composition Functions

| Function             | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `Layer.provide`      | Satisfies dependencies, removes them from requirements |
| `Layer.provideMerge` | Satisfies dependencies AND keeps them in output        |
| `Layer.merge`        | Combines two independent layers                        |
| `Layer.mergeAll`     | Combines multiple independent layers                   |

## Using Services

```typescript
import { Effect } from 'effect'
import { Auth } from '@/lib/services/auth/live-layer'

const program = Effect.gen(function* () {
  const auth = yield* Auth
  const session = yield* auth.getSessionFromCookies()
  return session
})

// Run with layer
Effect.runPromise(program.pipe(Effect.provide(Auth.layer)))
```

## Checklist for New Services

- [ ] Create directory: `lib/services/[name]/`
- [ ] Create `live-layer.ts` with `ServiceMap.Service` + `make` pattern
- [ ] Add static `layer` property (fully composed with all deps)
- [ ] Create `errors.ts` with `Schema.TaggedError` errors (if needed)
- [ ] Use `yield* Config.string(...)` for all environment variables
- [ ] Add `Effect.withSpan()` to all methods
- [ ] Add `Effect.annotateCurrentSpan()` for relevant attributes
- [ ] Add `Effect.tapError()` for error logging
- [ ] Add to `lib/layers.ts` AppLayer
- [ ] Return `as const` from service make effect for type inference
