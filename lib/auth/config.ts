// Auth.js (next-auth v5) configuration: Google OAuth and an emailed magic link, JWT sessions.
//
// Why JWT sessions: the header asks /api/auth/session once per page load for every visitor; with JWT that answer is
// read from the cookie and costs no database query. The trade-off is that a session cannot be revoked server-side
// before it expires, so (a) it is short (SESSION_MAX_AGE_S), (b) the token holds only the user id, never a plan or
// balance (entitlement is always read from the database), and (c) lib/auth/session.ts re-checks that the user still
// exists. Magic links still need the adapter for User and VerificationToken rows; there is no Session table.
//
// Built per call from env, never at import time, so the build and public pages work with no secret set.

import { PrismaAdapter } from '@auth/prisma-adapter'
import type { Adapter } from 'next-auth/adapters'
import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Nodemailer from 'next-auth/providers/nodemailer'

import { sendSignInEmail } from './email'

import { emailConfigured, googleConfigured } from '@/lib/accounts/enabled'
import { prisma } from '@/lib/prisma'

type Env = Record<string, string | undefined>

export const SESSION_MAX_AGE_S = 14 * 24 * 60 * 60
export const SESSION_UPDATE_AGE_S = 24 * 60 * 60
export const MAGIC_LINK_MAX_AGE_S = 15 * 60

/** Sign-in cookie names and flags, spelled out. HttpOnly + SameSite=Lax always; Secure whenever the site is https. */
export function sessionCookie(secure: boolean) {
  return {
    name: secure ? '__Secure-authjs.session-token' : 'authjs.session-token',
    options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure },
  }
}

/** The Prisma adapter, minus storing Google's access, refresh and ID tokens: sign-in only needs who the person is. */
export function createAdapter(): Adapter {
  const base = PrismaAdapter(prisma)
  return {
    ...base,
    linkAccount: (account) => {
      const { access_token, refresh_token, id_token, ...identity } = account
      void access_token
      void refresh_token
      void id_token
      return base.linkAccount!(identity)
    },
  }
}

export function buildAuthConfig(env: Env = process.env): NextAuthConfig {
  const secure = (env.AUTH_URL ?? '').startsWith('https://') || env.NODE_ENV === 'production'

  const providers: NextAuthConfig['providers'] = []
  if (googleConfigured(env)) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // Lets someone who signed in by email link later use Google with the same address (and the reverse). Safe
        // only because the signIn callback below refuses Google accounts whose email Google has not verified.
        allowDangerousEmailAccountLinking: true,
      }),
    )
  }
  if (emailConfigured(env)) {
    providers.push(
      Nodemailer({
        server: env.EMAIL_SERVER,
        from: env.EMAIL_FROM,
        maxAge: MAGIC_LINK_MAX_AGE_S,
        sendVerificationRequest: ({ identifier, url, provider }) =>
          sendSignInEmail({
            identifier,
            url,
            server: String(provider.server),
            from: provider.from ?? '',
            minutesValid: Math.round(MAGIC_LINK_MAX_AGE_S / 60),
          }),
      }),
    )
  }

  return {
    providers,
    adapter: createAdapter(),
    session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_S, updateAge: SESSION_UPDATE_AGE_S },
    useSecureCookies: secure,
    cookies: { sessionToken: sessionCookie(secure) },
    // Origin comes from AUTH_URL (required in production by accountsEnabled); trustHost only lets local runs work.
    trustHost: true,
    pages: { signIn: '/sign-in', error: '/sign-in', verifyRequest: '/sign-in?sent=1' },
    callbacks: {
      signIn({ account, profile }) {
        if (account?.provider === 'google') return profile?.email_verified === true
        return true
      },
      session({ session, token }) {
        // The id is all the browser-visible session carries.
        if (session.user && token.sub) session.user.id = token.sub
        return session
      },
    },
    // Auth.js's default logger prints whole error objects, which can contain the recipient address or tokens.
    logger: {
      error: (error) => console.error('[auth] error', error.name, (error as { type?: string }).type ?? ''),
      warn: () => {},
      debug: () => {},
    },
  }
}
