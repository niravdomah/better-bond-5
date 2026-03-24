/**
 * Protected Layout - Authentication Required
 *
 * This layout wraps all routes in the (protected) group and requires authentication.
 * Unauthenticated users are redirected to /auth/signin.
 *
 * Usage:
 * - Place pages that require authentication inside app/(protected)/
 * - The route group "(protected)" doesn't affect the URL path
 * - For role-based access, use requireMinimumRole() or requireExactRole() instead
 *
 * Examples:
 *   app/(protected)/dashboard/page.tsx  → /dashboard (requires auth)
 *   app/(protected)/settings/page.tsx   → /settings (requires auth)
 *
 * For role-specific protection, create nested layouts:
 *   app/(protected)/admin/layout.tsx    → Use requireMinimumRole(UserRole.ADMIN)
 */

import { requireAuth } from '@/lib/auth/auth-server';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps): Promise<React.ReactElement> {
  // Redirects to /auth/signin if not authenticated
  await requireAuth();

  return <>{children}</>;
}
