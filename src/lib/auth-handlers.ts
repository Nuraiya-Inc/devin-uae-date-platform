/**
 * NextAuth route handlers. Split out so the route file at
 * /api/auth/[...nextauth] is a thin re-export — keeps the route file
 * compatible with Next.js App Router constraints.
 */
import { handlers } from './auth';

export const { GET, POST } = handlers;
