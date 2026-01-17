import * as Effect from 'effect/Effect'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import * as schema from '../db/schema'
import { Context, Layer, Config } from 'effect'
import { emailOTP } from 'better-auth/plugins'
import { Email } from '../email'
import { BetterAuthApiError } from './errors'
import { drizzle } from 'drizzle-orm/neon-http'

// Create a separate Drizzle database tag for better-auth
export class AuthDb extends Context.Tag('@app/AuthDb')<AuthDb, any>() {}

// Auth database layer using Neon HTTP driver (stateless, serverless-compatible)
export const AuthDbLive = Layer.effect(
  AuthDb,
  Effect.gen(function* () {
    const url = yield* Config.string('DATABASE_URL')
    return drizzle({ connection: url, schema })
  })
)

const NEXT_PUBLIC_PROJECT_URL = process.env.NEXT_PUBLIC_PROJECT_URL
if (!NEXT_PUBLIC_PROJECT_URL) throw new Error('NEXT_PUBLIC_PROJECT_URL env variable not found')

const APP_NAME = process.env.APP_NAME
if (!APP_NAME) throw new Error('APP_NAME env variable not found')

const EMAIL_SENDER = process.env.EMAIL_SENDER
if (!EMAIL_SENDER) throw new Error('EMAIL_SENDER env variable not found')

export class BetterAuth extends Effect.Service<BetterAuth>()('@app/BetterAuth', {
  accessors: true,
  effect: Effect.gen(function* () {
    // Get the separate Drizzle database instance for auth
    const authDb = yield* AuthDb
    const emailService = yield* Email

    const auth = betterAuth({
      baseURL: process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : NEXT_PUBLIC_PROJECT_URL,
      trustedOrigins: [
        NEXT_PUBLIC_PROJECT_URL,
        ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
        ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])
      ],
      database: drizzleAdapter(authDb, {
        provider: 'pg',
        schema
      }),
      user: {
        additionalFields: {
          role: {
            type: 'string',
            required: true,
            defaultValue: 'USER',
            input: false // Prevent users from setting their own role
          }
        }
      },
      session: {
        expiresIn: 60 * 60 * 24 * 90, // 90 days

        cookieCache: {
          enabled: true,
          maxAge: 5 * 60 // Cache duration in seconds
        }
      },
      plugins: [
        emailOTP({
          // disableSignUp: true,
          async sendVerificationOTP({ email, otp, type }) {
            if (type !== 'sign-in') return

            await emailService
              .sendEmail({
                from: `${APP_NAME} <${EMAIL_SENDER}>`,
                to: email,
                subject: `${APP_NAME} - Login code`,
                html: `Your login code is: <strong>${otp}</strong>`
              })
              .pipe(
                Effect.tap(result =>
                  Effect.sync(() => console.log('✉️ OTP email sent!', result.id))
                ),
                Effect.tapError(error =>
                  Effect.sync(() => console.error('Error while sending OTP code', error))
                ),
                Effect.runPromise
              )
          }
        }),

        nextCookies() // make sure this is the last plugin in the array
      ]
    })

    const call = <A>(f: (client: typeof auth, signal: AbortSignal) => Promise<A>) =>
      Effect.tryPromise({
        try: signal => f(auth, signal),
        catch: error => {
          console.error('Better-auth API error:', error)
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
          console.error('Error details:', JSON.stringify(error, null, 2))
          return new BetterAuthApiError({ error })
        }
      })

    const signUp = (email: string, password: string, name: string) =>
      call(auth => auth.api.signUpEmail({ body: { email, password, name } }))

    const signIn = (email: string, password: string) =>
      call(auth => auth.api.signInEmail({ body: { email, password } }))

    const signOut = (headers: Headers = new Headers()) =>
      call(auth => auth.api.signOut({ headers }))

    const getSession = (headers: Headers = new Headers()) =>
      call(auth => auth.api.getSession({ headers }))

    const updateUser = (data: { name?: string; email?: string }) =>
      call(auth => auth.api.updateUser({ body: data }))

    const changePassword = (currentPassword: string, newPassword: string) =>
      call(auth =>
        auth.api.changePassword({
          body: { currentPassword, newPassword }
        })
      )

    // Server-side helper that automatically gets cookies from Next.js
    const getSessionFromCookies = () =>
      Effect.gen(function* () {
        // Import cookies dynamically to avoid issues in client-side code
        const { cookies } = yield* Effect.tryPromise(() => import('next/headers'))
        const cookieStore = yield* Effect.tryPromise(() => cookies())

        // Create Headers object from cookies
        const headers = new Headers()
        cookieStore.getAll().forEach((cookie: { name: string; value: string }) => {
          headers.append('cookie', `${cookie.name}=${cookie.value}`)
        })

        return yield* getSession(headers)
      })

    return {
      // call,
      auth,
      signUp,
      signIn,
      signOut,
      getSession,
      getSessionFromCookies,
      updateUser,
      changePassword
    } as const
  })
}) {}
