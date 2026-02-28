import { Data, Effect, Result } from 'effect'
import { redirect } from 'next/navigation'

// Tagged error for redirect intents
class RedirectError extends Data.TaggedError('RedirectError')<{
  path: string
}> {}

/**
 * Create a redirect effect. Use this instead of Next.js redirect() inside Effect pipelines.
 */
const redirectEffect = (path: string) => Effect.fail(new RedirectError({ path }))

/**
 * Custom Effect.runPromise that handles Next.js redirects outside the Effect context.
 *
 * Catches RedirectError (from NextEffect.redirect) and calls Next.js redirect()
 * outside the Effect context — required because Next.js redirect throws and
 * must not be called inside a try-catch (which Effect.runPromise uses).
 */
const runPromise = async <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  const result = await Effect.runPromise(
    effect.pipe(
      Effect.map((a): Result.Result<A, RedirectError> => Result.succeed(a)),
      Effect.catch(
        (e): Effect.Effect<Result.Result<A, RedirectError>> =>
          e instanceof RedirectError ? Effect.succeed(Result.fail(e)) : Effect.die(e)
      )
    )
  )
  if (Result.isFailure(result)) {
    return redirect(result.failure.path)
  }
  return result.success
}

export const NextEffect = {
  redirect: redirectEffect,
  runPromise
}
