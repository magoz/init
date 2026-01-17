import { PgClient } from '@effect/sql-pg'
import { Config, Effect, Layer } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { drizzle, type EffectPgDatabase } from 'drizzle-orm/effect-postgres'
import * as schema from './schema'

// PostgreSQL connection layer (internal)
const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
  ssl: Config.succeed(true)
})

// Database service definition
export class Db extends Effect.Service<Db>()('@app/Db', {
  dependencies: [PgLive],
  effect: Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return drizzle(client, { schema })
  })
}) {}

// Type export for convenience
export type Database = EffectPgDatabase<typeof schema>

// Layer export for composition
export const DbLive = Layer.merge(Db.Default, PgLive).pipe(Layer.provide(NodeContext.layer))
