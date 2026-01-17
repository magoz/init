# Init

A Next.js project starter with Effect-TS, designed to be cloned as the foundation for new projects.

## Stack

| Category   | Technology                               |
| ---------- | ---------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack)       |
| Language   | TypeScript 5                             |
| Functional | Effect-TS                                |
| Database   | PostgreSQL via Drizzle ORM + @effect/sql |
| Auth       | better-auth (Email OTP, passwordless)    |
| Email      | Resend                                   |
| Styling    | Tailwind CSS 4                           |
| Telemetry  | Sentry + OpenTelemetry                   |
| Analytics  | PostHog                                  |
| Testing    | Vitest                                   |

## Getting Started

1. **Clone and rename:**

   ```bash
   git clone <repo> my-project
   cd my-project
   rm -rf .git && git init
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Set up environment:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

4. **Push database schema:**

   ```bash
   pnpm db:push
   ```

5. **Run development server:**
   ```bash
   pnpm dev
   ```

## Project Structure

```
lib/
├── core/                    # Core business logic (each subfolder has own errors)
│   └── post/                # Example: getPosts()
├── services/                # Infrastructure services
│   ├── auth/                # Authentication (better-auth)
│   ├── db/                  # Database (Drizzle + Effect SQL)
│   ├── email/               # Email (Resend)
│   ├── s3/                  # AWS S3 file storage
│   ├── telegram/            # Telegram notifications
│   ├── activity/            # Activity logging
│   └── telemetry/           # Error reporting & tracing
├── layers.ts                # Effect layer composition
└── next-effect/             # Next.js + Effect utilities

app/
├── (auth)/                  # Auth routes (login)
├── (dashboard)/             # Protected routes
├── api/
│   ├── auth/[...all]/       # Auth API handler
│   └── example/             # Example API route
└── page.tsx                 # Home page example
```

## Scripts

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `pnpm dev`            | Start dev server (Turbopack) |
| `pnpm build`          | Production build             |
| `pnpm start`          | Start production server      |
| `pnpm tsc`            | Type check                   |
| `pnpm lint`           | Lint code                    |
| `pnpm knip`           | Dead code detection          |
| `pnpm prettier:check` | Check formatting             |
| `pnpm prettier:fix`   | Fix formatting               |
| `pnpm test`           | Run tests (watch mode)       |
| `pnpm test:run`       | Run tests (single run)       |
| `pnpm db:generate`    | Generate Drizzle migrations  |
| `pnpm db:push`        | Push schema to database      |
| `pnpm db:studio`      | Open Drizzle Studio          |

## Environment Variables

| Variable                  | Description                   |
| ------------------------- | ----------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string  |
| `NEXT_PUBLIC_PROJECT_URL` | Production URL                |
| `RESEND_API_KEY`          | Resend API key for emails     |
| `SENTRY_DSN`              | Sentry DSN for error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key           |

## Patterns

### Effect in Pages

```typescript
async function Content() {
  await cookies()

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const posts = yield* getPosts()
      return <div>{/* render posts */}</div>
    }).pipe(
      Effect.provide(Layer.mergeAll(AppLayer)),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.orElse(() => Effect.succeed(<ErrorPage />))
          ),
        onSuccess: Effect.succeed
      })
    )
  )
}
```

### Effect in API Routes

```typescript
const handler = Effect.gen(function* () {
  const posts = yield* getPosts()
  return yield* HttpServerResponse.json({ posts })
}).pipe(
  Effect.catchAll(error =>
    Match.value(error).pipe(
      Match.tag('UnauthenticatedError', () =>
        HttpServerResponse.json({ error: 'Not authenticated' }, { status: 401 })
      ),
      Match.orElse(() =>
        HttpServerResponse.json({ error: 'Internal server error' }, { status: 500 })
      )
    )
  )
)
```

### Creating Services

```typescript
// lib/core/example/get-something.ts
export const getSomething = (id: string) =>
  Effect.gen(function* () {
    const { user } = yield* getSession()
    const db = yield* DbLive

    const result = yield* Effect.tryPromise(() =>
      db.select().from(schema.something).where(eq(schema.something.id, id))
    )

    return result
  }).pipe(Effect.withSpan('example.get-something'))
```

## After Cloning

1. Update `package.json` name and version
2. Update this README
3. Remove example code (`lib/core/post/`, example routes)
4. Add your own database schema in `lib/services/db/schema.ts`
5. Create your services in `lib/core/`
