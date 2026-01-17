import {
  Resend as ResendClient,
  CreateEmailOptions,
  CreateEmailRequestOptions,
  CreateEmailResponseSuccess,
} from "resend"
import { Context, Effect, Layer, Config, Redacted } from "effect"
import { EmailConfigError, SendEmailError } from "./errors"

export { EmailConfigError, SendEmailError }

// Configuration service
export class EmailConfig extends Context.Tag("@app/EmailConfig")<
  EmailConfig,
  {
    readonly apiKey: Redacted.Redacted<string>
  }
>() {}

// Configuration layer
const EmailConfigLive = Layer.effect(
  EmailConfig,
  Effect.gen(function* () {
    const apiKey = yield* Config.redacted("RESEND_API_KEY").pipe(
      Effect.mapError(
        () => new EmailConfigError({ message: "RESEND_API_KEY not found" })
      )
    )
    return { apiKey }
  })
)

// Service interface
export class Email extends Context.Tag("@app/Email")<
  Email,
  {
    readonly sendEmail: (
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions
    ) => Effect.Effect<CreateEmailResponseSuccess, SendEmailError, never>
  }
>() {}

// Service implementation
const EmailServiceLive = Layer.effect(
  Email,
  Effect.gen(function* () {
    const config = yield* EmailConfig
    const resendClient = new ResendClient(Redacted.value(config.apiKey))

    const sendEmail = (
      payload: CreateEmailOptions,
      options?: CreateEmailRequestOptions
    ) =>
      Effect.gen(function* () {
        // Annotate span for observability
        yield* Effect.annotateCurrentSpan({
          operation: "email.send",
          "email.to": Array.isArray(payload.to)
            ? payload.to.join(",")
            : payload.to,
          "email.subject": payload.subject ?? "none",
        })

        const { data, error } = yield* Effect.promise(() =>
          resendClient.emails.send(payload, options)
        )

        if (error) {
          return yield* new SendEmailError({
            message: error.message,
            cause: error,
          })
        }

        // Annotate with result
        yield* Effect.annotateCurrentSpan({ "email.id": data.id })

        return data
      }).pipe(
        Effect.withSpan("email.send"),
        Effect.tapError((error) =>
          Effect.logError("Email send failed", {
            to: Array.isArray(payload.to) ? payload.to.join(",") : payload.to,
            subject: payload.subject,
            error,
          })
        )
      )

    return { sendEmail }
  })
)

// Composed layer for export
export const EmailLive = EmailServiceLive.pipe(Layer.provide(EmailConfigLive))
