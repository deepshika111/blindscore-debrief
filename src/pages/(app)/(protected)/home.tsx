import { Navigate } from 'react-router-dom'

/** Smoke tests still request /home. The product lives at /dashboard. */
export default function HomePage() {
  return <Navigate to="/dashboard" replace />
}
