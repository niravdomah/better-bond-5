import NextAuth from 'next-auth';

import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Server-side auth helpers are provided by lib/auth/auth-helpers.ts
// This file only exports the core NextAuth configuration
