import * as PgDrizzle from "@effect/sql-drizzle/Pg"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer } from "effect"
import { NodeContext } from "@effect/platform-node"
import * as schema from "./schema"

// PostgreSQL connection layer
const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
  ssl: Config.succeed(true),
})

// Drizzle service with full schema typing
export class DbLive extends Effect.Service<DbLive>()("@app/DbLive", {
  dependencies: [PgLive],
  effect: PgDrizzle.make<typeof schema>({
    schema: schema,
  }),
}) {}

// Combined layer for external use
export const DbLayer = Layer.merge(DbLive.Default, PgLive).pipe(
  Layer.provide(NodeContext.layer)
)
