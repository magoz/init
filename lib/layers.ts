import { Layer } from "effect"
import { DbLayer } from "./services/db/live-layer"
import { BetterAuth, AuthDbLive } from "./services/auth"
import { EmailLive } from "./services/email"
import { TelemetryLayer } from "./services/telemetry/live-layer"

// Auth layer with dependencies
export const AuthLayer = Layer.provide(
  BetterAuth.Default,
  Layer.merge(AuthDbLive, EmailLive)
)

// Combined app layer
export const AppLayer = Layer.mergeAll(AuthLayer, DbLayer, TelemetryLayer)
