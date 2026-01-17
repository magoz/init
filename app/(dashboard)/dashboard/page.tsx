import { Effect, Match } from "effect"
import { Suspense } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/services/auth/get-session"
import { AuthLayer } from "@/lib/layers"
import { LogoutButton } from "./logout-button"

type Result =
  | { _tag: "Authenticated"; session: { user: { id: string; name: string; email: string; role: string } } }
  | { _tag: "Unauthenticated" }
  | { _tag: "Error"; message: string }

async function Content() {
  await cookies()

  const result: Result = await Effect.runPromise(
    Effect.gen(function* () {
      const session = yield* getSession()
      return { _tag: "Authenticated" as const, session }
    }).pipe(
      Effect.provide(AuthLayer),
      Effect.scoped,
      Effect.catchTag("UnauthenticatedError", () =>
        Effect.succeed({ _tag: "Unauthenticated" as const })
      ),
      Effect.catchAll((error) =>
        Effect.succeed({
          _tag: "Error" as const,
          message: error instanceof Error ? error.message : "Something went wrong",
        })
      )
    )
  )

  return Match.value(result).pipe(
    Match.when({ _tag: "Unauthenticated" }, () => redirect("/login")),
    Match.when({ _tag: "Error" }, ({ message }) => (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-red-500">Error: {message}</p>
      </main>
    )),
    Match.when({ _tag: "Authenticated" }, ({ session }) => (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <LogoutButton />
          </div>
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">Your Profile</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{session.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{session.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium">{session.user.role}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">User ID</p>
                <p className="font-medium text-xs">{session.user.id}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    )),
    Match.exhaustive
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Content />
    </Suspense>
  )
}
