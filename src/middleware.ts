import NextAuth from 'next-auth';
import { authConfig } from './lib/auth';

export const { auth: middleware } = NextAuth(authConfig);

/**
 * Route matcher — protect everything except:
 *   - /_next/* (static assets)
 *   - /favicon.ico
 *   - /api/auth/* (NextAuth itself)
 *   - /api/health (Coolify healthcheck)
 *   - /api/cron/* (bearer-token auth via CRON_SECRET, set in route handler)
 *   - /investor-data-room/* (legacy static page)
 *   - /verify/* (PUBLIC certificate verification — QR codes on issued
 *     certificates resolve here; the page itself only exposes public standing)
 *   - /investor/* (per-investor read-only access — gated by InvestorAccessToken
 *     in src/lib/investor-access.ts; no platform auth required because the
 *     token IS the credential)
 *   - any request ending in a static-asset extension. This lets the public/
 *     folder's logos, fonts, etc. load without being redirected to /signin.
 *
 * Negative-lookahead pattern is a PREFIX bypass.
 */
export const config = {
  matcher: [
    // `api/chat/upload-attachment` is excluded so streaming uploads bypass the
    // default 10 MB middleware body cap entirely. The route does its own auth
    // check at the top, so this doesn't open an unauthenticated upload hole.
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/health|api/cron|api/chat/upload-attachment|investor-data-room|investor/|verify/|showcase|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|css|js|map|mp3|m4a|wav|ogg|mp4|webm|mov)$).*)',
  ],
};
