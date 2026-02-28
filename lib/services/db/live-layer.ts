import { PgClient } from '@effect/sql-pg'
import { Config, Effect, Layer, ServiceMap } from 'effect'
import { NodeServices } from '@effect/platform-node'
import { drizzle, type EffectPgDatabase } from 'drizzle-orm/effect-postgres'
import * as schema from './schema'

// PostgreSQL connection layer (internal)
const PgLive = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
  ssl: Config.succeed(true)
})

// Service definition
export class Db extends ServiceMap.Service<Db>()('@app/Db', {
  make: Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return drizzle(client, { schema })
  })
}) {
  // Composed layer with all dependencies satisfied
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provideMerge(PgLive),
    Layer.provide(NodeServices.layer)
  )
}

// Type export for convenience
export type Database = EffectPgDatabase<typeof schema>
