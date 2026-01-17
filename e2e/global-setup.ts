import { Effect } from 'effect'
import { sql } from 'drizzle-orm'
import { Db } from '@/lib/services/db/live-layer'
import { ensureTestEnvironment } from './utils/ensure-test-environment'

const globalSetup = async () => {
  ensureTestEnvironment('Database reset')

  console.log('🧹 Resetting database...')

  const resetEffect = Effect.gen(function* () {
    const db = yield* Db

    yield* db.execute(sql`TRUNCATE TABLE "post" CASCADE`)
    yield* db.execute(sql`TRUNCATE TABLE "session" CASCADE`)
    yield* db.execute(sql`TRUNCATE TABLE "account" CASCADE`)
    yield* db.execute(sql`TRUNCATE TABLE "verification" CASCADE`)
    yield* db.execute(sql`TRUNCATE TABLE "user" CASCADE`)
  }).pipe(Effect.provide(Db.Live), Effect.scoped)

  await Effect.runPromise(resetEffect)

  console.log('✅ Database reset complete')
}

export default globalSetup
