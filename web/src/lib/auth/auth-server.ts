/**
 * Server-Side Authentication Helpers
 *
 * These functions should ONLY be used in Server Components and Server Actions.
 * For Client Components, use hooks from auth-client.ts instead.
 *
 * Security Note:
 * Following Next.js 16 and Vercel's security recommendations, authentication
 * checks are performed in Server Components (layouts) rather than middleware/proxy.
 * This approach provides defense-in-depth and ensures auth checks cannot be bypassed.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { hasMinimumRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

import type { Session } from 'next-auth';

/**
 * Requires authentication for the current page.
 * Redirects to sign-in if not authenticated.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function DashboardPage() {
 *   const session = await requireAuth();
 *   // User is guaranteed to be authenticated here
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 *
 * @param callbackUrl - Optional URL to redirect back to after sign-in
 * @returns Session object if authenticated
 */
export async function requireAuth(callbackUrl?: string): Promise<Session> {
  const session = await auth();

  if (!session) {
    // Auto-detect current path if callbackUrl not provided
    let redirectUrl = callbackUrl;
    if (!redirectUrl) {
      const headersList = await headers();
      const pathname =
        headersList.get('x-pathname') || headersList.get('x-invoke-path');
      if (pathname) {
        redirectUrl = pathname;
      }
    }

    const signInUrl = redirectUrl
      ? `/auth/signin?callbackUrl=${encodeURIComponent(redirectUrl)}`
      : '/auth/signin';
    redirect(signInUrl);
  }

  return session;
}

/**
 * Requires minimum role level for the current page (hierarchical check).
 * Redirects to forbidden page if user doesn't meet minimum role requirement.
 *
 * Hierarchical: ADMIN (100) can access POWER_USER (50) routes.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function PowerUserPage() {
 *   // Both ADMIN and POWER_USER can access
 *   const session = await requireMinimumRole(UserRole.POWER_USER);
 *   return <div>Power User Features</div>;
 * }
 * ```
 *
 * @param minimumRole - The minimum required role level
 * @param callbackUrl - Optional URL to redirect back to after sign-in
 * @returns Session object if user meets minimum role requirement
 */
export async function requireMinimumRole(
  minimumRole: UserRole,
  callbackUrl?: string,
): Promise<Session> {
  const session = await requireAuth(callbackUrl);

  if (!hasMinimumRole(session.user, minimumRole)) {
    const forbiddenUrl = `/auth/forbidden?required=${minimumRole}&current=${session.user.role}`;
    redirect(forbiddenUrl);
  }

  return session;
}

/**
 * Requires exact role match for the current page (strict check).
 * Redirects to forbidden page if user doesn't have the exact role.
 *
 * Non-hierarchical: Only ADMIN can access ADMIN routes, not POWER_USER.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function AdminOnlyPage() {
 *   // ONLY users with exact ADMIN role can access
 *   const session = await requireExactRole(UserRole.ADMIN);
 *   return <div>Admin Dashboard</div>;
 * }
 * ```
 *
 * @param role - The exact required role
 * @param callbackUrl - Optional URL to redirect back to after sign-in
 * @returns Session object if user has exact role
 */
export async function requireExactRole(
  role: UserRole,
  callbackUrl?: string,
): Promise<Session> {
  const session = await requireAuth(callbackUrl);

  if (session.user.role !== role) {
    const forbiddenUrl = `/auth/forbidden?required=${role}&current=${session.user.role}`;
    redirect(forbiddenUrl);
  }

  return session;
}

/**
 * Gets the current session without requiring authentication.
 * Returns null if not authenticated.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function OptionalAuthPage() {
 *   const session = await getSession();
 *   if (session) {
 *     return <div>Welcome {session.user.name}</div>;
 *   }
 *   return <div>Welcome Guest</div>;
 * }
 * ```
 *
 * @returns Session object if authenticated, null otherwise
 */
export async function getSession(): Promise<Session | null> {
  return await auth();
}

/**
 * Checks if the current user meets minimum role requirement (hierarchical).
 * Returns false if not authenticated.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function Page() {
 *   const canAccessPowerFeatures = await checkMinimumRole(UserRole.POWER_USER);
 *   if (canAccessPowerFeatures) {
 *     return <PowerUserFeatures />;
 *   }
 *   return <RegularContent />;
 * }
 * ```
 *
 * @param minimumRole - The minimum role level to check for
 * @returns true if user meets minimum role requirement, false otherwise
 */
export async function checkMinimumRole(
  minimumRole: UserRole,
): Promise<boolean> {
  const session = await auth();

  if (!session) {
    return false;
  }

  return hasMinimumRole(session.user, minimumRole);
}

/**
 * Checks if the current user has exact role match (non-hierarchical).
 * Returns false if not authenticated.
 *
 * Usage in Server Components:
 * ```tsx
 * export default async function Page() {
 *   const isExactlyAdmin = await checkExactRole(UserRole.ADMIN);
 *   if (isExactlyAdmin) {
 *     return <AdminOnlyControls />;
 *   }
 *   return <RegularContent />;
 * }
 * ```
 *
 * @param role - The exact role to check for
 * @returns true if user has exact role, false otherwise
 */
export async function checkExactRole(role: UserRole): Promise<boolean> {
  const session = await auth();

  if (!session) {
    return false;
  }

  return session.user.role === role;
}
