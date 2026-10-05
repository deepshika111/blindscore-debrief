export const pageSecurityHeaders: Record<string, string> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "connect-src 'self' ws://localhost:* wss://localhost:* ws://127.0.0.1:* wss://127.0.0.1:*",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export function securityHeaders(pageUrl: string): Record<string, string> {
  const url = new URL(pageUrl)
  const socket = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  // Vite's React preamble and its injected stylesheet are inline. Production
  // responses stay on scripts and styles from this origin.
  const scriptSrc = local ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'"
  const styleSrc = local ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'"
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `connect-src 'self' ${socket}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      scriptSrc,
      styleSrc,
      "font-src 'self'",
      "img-src 'self' data:",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}
