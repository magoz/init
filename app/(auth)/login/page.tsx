import { redirect } from 'next/navigation'
import { LoginForm } from './login-form'
import { Suspense } from 'react'
import { AuthLayer } from '@/lib/layers'
import { getSessionEffect } from '@/lib/services/auth/get-session-effect'
import { Effect, Match } from 'effect'
import { cookies } from 'next/headers'

async function Content() {
  // Make nextjs happy
  await cookies()

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      yield* getSessionEffect()
      return { _tag: 'Authenticated' as const }
    }).pipe(
      Effect.provide(AuthLayer),
      Effect.scoped,
      Effect.catchTags({
        UnauthenticatedError: () => Effect.succeed({ _tag: 'Unauthenticated' as const })
      }),
      Effect.catchAll(error => {
        return Effect.succeed({ _tag: 'UnknownError' as const, error })
      })
    )
  )

  return Match.value(result).pipe(
    Match.tag('Authenticated', () => redirect('/')),
    Match.tag('UnknownError', ({ error }) => {
      throw error
    }),
    Match.tag('Unauthenticated', () => <LoginForm />),
    Match.exhaustive
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  )
}
