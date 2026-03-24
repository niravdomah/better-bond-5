/**
 * NextAuth Type Extensions
 *
 * This file extends NextAuth's default types to include custom fields
 * like user roles. TypeScript will automatically pick up these declarations.
 */

import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

import { UserRole } from './roles';

/**
 * Extend the Session user object to include role
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: UserRole;
  }
}

/**
 * Extend the JWT token to include role
 */
declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: UserRole;
  }
}
