import { Suspense } from 'react'
import { Effect, Layer, Match } from 'effect'
import { cookies } from 'next/headers'
import { NextEffect } from '@/lib/next-effect'
import { AppLayer } from '@/lib/layers'
import { getPosts } from '@/lib/core/post/get-posts'

async function Content() {
  await cookies()

  return await NextEffect.runPromise(
    Effect.gen(function* () {
      const posts = yield* getPosts()

      return (
        <main className="p-8 space-y-6">
          <h1 className="text-3xl font-semibold">Posts</h1>
          This is an example of how to use Effect at page level in Next.js.
          {posts.length === 0 ? (
            <p className="text-gray-500">No posts yet.</p>
          ) : (
            <ul className="space-y-4">
              {posts.map(post => (
                <li key={post.id} className="border p-4 rounded-lg">
                  <h2 className="text-xl font-medium">{post.title}</h2>
                  {post.content && <p className="text-gray-600 mt-2">{post.content}</p>}
                  <p className="text-sm text-gray-400 mt-2">
                    {post.createdAt.toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </main>
      )
    }).pipe(
      Effect.provide(Layer.mergeAll(AppLayer)),
      Effect.scoped,
      Effect.matchEffect({
        onFailure: error =>
          Match.value(error._tag).pipe(
            Match.when('UnauthenticatedError', () => NextEffect.redirect('/login')),
            Match.orElse(() =>
              Effect.succeed(
                <main className="p-8">
                  <p>Something went wrong.</p>
                  <p className="text-red-500">Error: {error.message}</p>
                </main>
              )
            )
          ),
        onSuccess: Effect.succeed
      })
    )
  )
}

export default async function Page() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  )
}

