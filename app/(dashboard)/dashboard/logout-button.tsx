"use client"

import { useTransition } from "react"
import { authClient } from "@/lib/services/auth/auth-client"

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => {
      authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            // Full page reload clears cache
            window.location.href = "/"
          },
        },
      })
    })
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="px-4 py-2 text-sm text-gray-600 hover:text-black border border-gray-300 rounded-lg hover:border-black disabled:opacity-50 transition-colors"
    >
      {isPending ? "Signing out..." : "Sign Out"}
    </button>
  )
}
