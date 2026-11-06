import NextAuth from 'next-auth'

import { buildAuthConfig } from './config'

// Lazy form: the config (and with it the Prisma adapter and providers) is built on each request from env, not when
// this module is imported. Only code reached after the ACCOUNTS_ENABLED gate imports this file.
export const { handlers, auth } = NextAuth(() => buildAuthConfig())
