import { Effect } from 'effect'
import { getSession } from '@/lib/services/auth/get-session'
import { DbLive } from '@/lib/services/db/live-layer'
import * as schema from '@/lib/services/db/schema'
import { eq } from 'drizzle-orm'

export const getPosts = () =>
  Effect.gen(function* () {
    const { user } = yield* getSession()
    const db = yield* DbLive

    const posts = yield* Effect.tryPromise(() =>
      db.select().from(schema.post).where(eq(schema.post.userId, user.id))
    )

    return posts
  }).pipe(Effect.withSpan('post.get-posts'))
