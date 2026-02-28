import { Config, Effect, Layer, Redacted, ServiceMap } from 'effect'
import { TelegramConfigError, TelegramSendError } from './errors'

const TELEGRAM_MESSAGE_MAX_LENGTH = 4096

const splitIntoChunks = (str: string, chunkSize: number): string[] => {
  const length = Math.ceil(str.length / chunkSize)
  return Array.from({ length }, (_, i) => str.slice(i * chunkSize, i * chunkSize + chunkSize))
}

// Configuration service (internal)
class TelegramConfig extends ServiceMap.Service<
  TelegramConfig,
  {
    readonly botToken: Redacted.Redacted<string>
    readonly chatId: string
  }
>()('@app/TelegramConfig') {}

const TelegramConfigLive = Layer.effect(
  TelegramConfig,
  Effect.gen(function* () {
    const botToken = yield* Config.redacted('TELEGRAM_BOT_TOKEN')
    const chatId = yield* Config.string('TELEGRAM_CHAT_ID')

    return { botToken, chatId }
  }).pipe(Effect.mapError(() => new TelegramConfigError({ message: 'Telegram config missing' })))
)

// Service definition
export class Telegram extends ServiceMap.Service<Telegram>()('@app/Telegram', {
  make: Effect.gen(function* () {
    const config = yield* TelegramConfig

    const sendMessage = (message: string) =>
      Effect.tryPromise({
        try: async () => {
          const endpoint = `https://api.telegram.org/bot${Redacted.value(config.botToken)}/sendMessage`
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              chat_id: config.chatId,
              disable_web_page_preview: true,
              text: message
            })
          })
          if (!response.ok) {
            const body = await response.text()
            throw new Error(`Telegram API error: ${response.status} - ${body}`)
          }
        },
        catch: error =>
          new TelegramSendError({
            message: error instanceof Error ? error.message : 'Unknown error',
            cause: error
          })
      })

    const send = (message: string) =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan({
          'telegram.messageLength': message.length,
          'telegram.chatId': config.chatId
        })

        const chunks = splitIntoChunks(message, TELEGRAM_MESSAGE_MAX_LENGTH)

        yield* Effect.annotateCurrentSpan({
          'telegram.chunks': chunks.length
        })

        for (const chunk of chunks) {
          yield* sendMessage(chunk)
        }
      }).pipe(
        Effect.withSpan('Telegram.send'),
        Effect.tapError(error => Effect.logError('Telegram send failed', { error }))
      )

    return { send } as const
  })
}) {
  static layer = Layer.effect(this, this.make).pipe(Layer.provide(TelegramConfigLive))
}
