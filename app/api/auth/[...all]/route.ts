import { Effect } from 'effect'
import { Auth } from '@/lib/services/auth/live-layer'
import { AuthLayer } from '@/lib/layers'
import { toNextJsHandler } from 'better-auth/next-js'

async function getAuthHandler() {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const authService = yield* Auth
      return authService.auth
    }).pipe(Effect.provide(AuthLayer), Effect.scoped)
  )
}

export async function GET(request: Request) {
  const auth = await getAuthHandler()
  const handler = toNextJsHandler(auth.handler)
  return handler.GET(request)
}

export async function POST(request: Request) {
  const auth = await getAuthHandler()
  const handler = toNextJsHandler(auth.handler)
  return handler.POST(request)
}
