import { PgClient } from '@effect/sql-pg'
import { Config, Effect, Layer } from 'effect'
import { NodeContext } from '@effect/platform-node'
import { drizzle, type EffectPgDatabase } from 'drizzle-orm/effect-postgres'
import * as schema from './schema'

// PostgreSQL connection layer
const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
  ssl: Config.succeed(true)
})

// Drizzle service with full schema typing using native Effect implementation
export class DbLive extends Effect.Service<DbLive>()('@app/DbLive', {
  dependencies: [PgLive],
  effect: Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return drizzle(client, { schema })
  })
}) {}

// Type export for convenience
export type Db = EffectPgDatabase<typeof schema>

// Combined layer for external use
export const DbLayer = Layer.merge(DbLive.Default, PgLive).pipe(Layer.provide(NodeContext.layer))
