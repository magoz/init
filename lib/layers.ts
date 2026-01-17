import { Layer } from 'effect'
import { Db, DbLive } from './services/db/live-layer'
import { Auth, AuthLive } from './services/auth/live-layer'
import { Email } from './services/email/live-layer'
import { Telegram, TelegramLive } from './services/telegram/live-layer'
import { Activity, ActivityLive } from './services/activity/live-layer'
import { TelemetryLayer } from './services/telemetry/live-layer'

// Combined app layer
export const AppLayer = Layer.mergeAll(AuthLive, DbLive, TelegramLive, ActivityLive, TelemetryLayer)

// Re-export services for convenient imports
export { Auth, Db, Email, Telegram, Activity }
