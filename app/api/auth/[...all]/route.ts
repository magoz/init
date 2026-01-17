import { Effect } from "effect"
import { BetterAuth } from "@/lib/services/auth"
import { AuthLayer } from "@/lib/layers"
import { toNextJsHandler } from "better-auth/next-js"

async function getAuthHandler() {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const authService = yield* BetterAuth
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
