'use server'

import { Effect } from 'effect'
import { revalidatePath } from 'next/cache'
import { AppLayer } from '@/lib/layers'
import { NextEffect } from '@/lib/next-effect'
import { getSession } from '@/lib/services/auth/get-session'
import { Db } from '@/lib/services/db/live-layer'
import { NotFoundError, UnauthorizedError } from '@/lib/core/errors'
import * as schema from '@/lib/services/db/schema'
import { eq } from 'drizzle-orm'

export const deletePostAction = async (postId: schema.Post['id']) => {
  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const session = yield* getSession()
      const db = yield* Db

      yield* Effect.annotateCurrentSpan({
        'user.id': session.user.id,
        'user.email': session.user.email
      })

      // Verify post exists and belongs to user
      const [existing] = yield* db
        .select()
        .from(schema.post)
        .where(eq(schema.post.id, postId))
        .limit(1)
        .execute()

      if (!existing) {
        return yield* new NotFoundError({
          message: 'Post not found',
          entity: 'post',
          id: postId
        })
      }

      if (existing.userId !== session.user.id) {
        return yield* new UnauthorizedError({
          message: 'You can only delete your own posts'
        })
      }

      yield* db.delete(schema.post).where(eq(schema.post.id, postId)).execute()
    }).pipe(
      Effect.withSpan('action.post.delete', {
        attributes: {
          'post.id': postId,
          operation: 'post.delete'
        }
      }),
      Effect.provide(AppLayer),
      Effect.scoped,
      Effect.catchTag('UnauthenticatedError', () => NextEffect.redirect('/login')),
      Effect.catchTag('UnauthorizedError', error =>
        Effect.succeed({ _tag: 'Error' as const, message: error.message })
      ),
      Effect.catchTag('NotFoundError', error =>
        Effect.succeed({ _tag: 'Error' as const, message: error.message })
      ),
      Effect.tap(() => Effect.sync(() => revalidatePath('/'))),
      Effect.catch(() =>
        Effect.succeed({ _tag: 'Error' as const, message: 'Something went wrong' })
      )
    )
  )
}
