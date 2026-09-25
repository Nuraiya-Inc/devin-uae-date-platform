import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './db';
import type { UserRole, SafaEntity } from '@prisma/client';

/**
 * HARD OVERRIDE — Coolify's env var UI has been inconsistent and keeps
 * leaving NEXTAUTH_URL pointing at the bare IP address. This forces the
 * canonical URL regardless of what's passed at runtime. Set BEFORE
 * NextAuth() is called so the auth library picks up the right value.
 * Applied in production only — in dev, honor AUTH_URL/NEXTAUTH_URL so
 * localhost signin and redirects stay on the dev origin.
 */
const CANONICAL_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://uae.safabioworks.com'
    : (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000');
process.env.NEXTAUTH_URL = CANONICAL_URL;
process.env.AUTH_URL = CANONICAL_URL;
process.env.AUTH_TRUST_HOST = 'true';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      entity: SafaEntity;
      title?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
    entity?: SafaEntity;
    title?: string | null;
  }
}

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(200),
});

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
  },
  trustHost: true,
  providers: [
    Credentials({
      name: 'Email + Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // Fire-and-forget last-login update
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          entity: user.entity,
          title: user.title,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.entity = user.entity;
        token.title = user.title;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (typeof token.id === 'string') session.user.id = token.id;
        if (typeof token.role === 'string') session.user.role = token.role as UserRole;
        if (typeof token.entity === 'string') session.user.entity = token.entity as SafaEntity;
        session.user.title = typeof token.title === 'string' ? token.title : null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnSignIn = nextUrl.pathname.startsWith('/signin');
      const isOnPublic =
        nextUrl.pathname === '/' ||
        nextUrl.pathname.startsWith('/api/health') ||
        nextUrl.pathname.startsWith('/_next') ||
        nextUrl.pathname.startsWith('/favicon');

      if (isOnPublic) return true;
      if (isOnSignIn) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
