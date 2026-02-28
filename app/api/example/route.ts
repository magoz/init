import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse'
import * as HttpEffect from 'effect/unstable/http/HttpEffect'
import { Effect } from 'effect'
import { AppLayer } from '@/lib/layers'
import { getPosts } from '@/lib/core/post/get-posts'

export const dynamic = 'force-dynamic'

// GET /api/example - Fetch posts for authenticated user
const getHandler = Effect.gen(function* () {
  const posts = yield* getPosts()

  return yield* HttpServerResponse.json({ posts })
}).pipe(
  Effect.catchTag('UnauthenticatedError', () =>
    HttpServerResponse.json({ error: 'Not authenticated' }, { status: 401 })
  ),
  Effect.catch(error => {
    console.error('API error:', error)
    return HttpServerResponse.json({ error: 'Internal server error' }, { status: 500 })
  })
)

const { handler: effectHandler } = HttpEffect.toWebHandlerLayer(getHandler, AppLayer)

export const GET = (request: Request) => effectHandler(request)
