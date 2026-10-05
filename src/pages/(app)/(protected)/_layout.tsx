/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * The `fallback` keeps signed-out visitors inside the app's own chrome
 * (without it, AuthGate shows the SDK's full-screen, non-dismissible
 * overlay). The sign-in overlay opens on demand and can be dismissed.
 */

import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AuthGate, AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <Outlet />
    </AuthGate>
  )
}

function SignedOutPanel() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const hint = useSignInHint()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Sign in to BlindScore</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to open a room, or to join one you were invited to.
        </p>
        {hint ? <p className="mt-4 text-sm text-destructive">{hint}</p> : null}
        <Button
          className="mt-6 w-full"
          onClick={() => {
            rememberInvite()
            setShowAuthModal(true)
          }}
        >
          Sign in
        </Button>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to home
        </Link>
      </div>

      {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
    </div>
  )
}

function rememberInvite(): void {
  const next = window.location.pathname + window.location.search
  if (!next.startsWith('/join/')) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `blindscore-next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}`
}

function useSignInHint(): string | null {
  const [hint, setHint] = useState<string | null>(null)
  useEffect(() => {
    const { protocol, hostname } = window.location
    const safari = /safari/i.test(navigator.userAgent) && !/chrome|chromium|crios|android/i.test(navigator.userAgent)
    if (protocol !== 'https:' && safari) {
      setHint('Safari does not keep a sign-in on http. Stop the server, run npm run dev:safari, then open https://localhost:5173/dashboard.')
      return
    }
    if (protocol === 'http:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      setHint('This address cannot keep a sign-in. Open http://localhost:5173/dashboard in Chrome.')
    }
  }, [])
  return hint
}
