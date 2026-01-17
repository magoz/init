import { Layer } from 'effect'
import { Db, DbLive } from './services/db/live-layer'
import { Auth, AuthDbLive } from './services/auth/live-layer'
import { Email, EmailLive } from './services/email/live-layer'
import { TelemetryLayer } from './services/telemetry/live-layer'

// Auth layer with dependencies
export const AuthLayer = Layer.provide(Auth.Default, Layer.merge(AuthDbLive, EmailLive))

// Combined app layer
export const AppLayer = Layer.mergeAll(AuthLayer, DbLive, TelemetryLayer)

// Re-export services for convenient imports
export { Auth, Db, Email }
