import { Context, Effect, Layer, Ref } from 'effect'
import { Telegram } from '../telegram/live-layer'

export type Log = {
  timestamp: string
  message: string
}

export type SendOptions = {
  header?: string
  timestamps?: boolean
}

const BORDER = '─────────────────────'

type FormatOptions = {
  header?: string
  executionTime?: string
}

const format = (messages: string[], options?: FormatOptions) => {
  const content = messages.join('\n')
  const hasMultiple = messages.length > 1

  if (!options?.header) {
    return hasMultiple ? `${BORDER}\n${content}\n${BORDER}` : content
  }

  const headerBlock = options.executionTime
    ? `${options.header}\nExecution time: ${options.executionTime}`
    : options.header

  return `${BORDER}\n${headerBlock}\n${BORDER}\n${content}\n${BORDER}`
}

const formatDuration = (ms: number) => (ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)

const getDuration = (logs: Log[]) =>
  logs.length > 1
    ? new Date(logs.at(-1)!.timestamp).getTime() - new Date(logs[0].timestamp).getTime()
    : 0

// Service definition
export class Activity extends Context.Service<Activity>()('@app/Activity', {
  make: Effect.gen(function* () {
    const telegram = yield* Telegram
    const logsRef = yield* Ref.make<Log[]>([])

    const add = (message: string) =>
      Ref.update(logsRef, logs => [...logs, { timestamp: new Date().toISOString(), message }]).pipe(
        Effect.withSpan('Activity.add')
      )

    const send = (messageOrOptions?: string | SendOptions, options?: SendOptions) => {
      const message = typeof messageOrOptions === 'string' ? messageOrOptions : undefined
      const opts = typeof messageOrOptions === 'object' ? messageOrOptions : options

      return Effect.gen(function* () {
        let logs = yield* Ref.get(logsRef)

        if (message) {
          logs = [...logs, { timestamp: new Date().toISOString(), message }]
        }

        if (logs.length === 0) return

        yield* Effect.annotateCurrentSpan({
          'activity.logCount': logs.length,
          'activity.hasHeader': !!opts?.header
        })

        const messages = opts?.timestamps
          ? logs.map(l => `${l.timestamp} ${l.message}`)
          : logs.map(l => l.message)

        const text = format(messages, {
          header: opts?.header,
          executionTime: opts?.timestamps ? formatDuration(getDuration(logs)) : undefined
        })

        yield* telegram.send(text)
        yield* Ref.set(logsRef, [])
      }).pipe(
        Effect.withSpan('Activity.send'),
        Effect.tapError(error => Effect.logError('Activity send failed', { error })),
        Effect.catch(() => Effect.void),
        Effect.forkDetach
      )
    }

    return { add, send } as const
  })
}) {
  static layer = Layer.effect(this, this.make).pipe(Layer.provide(Telegram.layer))
}
