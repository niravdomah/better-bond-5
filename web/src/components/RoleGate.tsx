/**
 * RoleGate Component
 *
 * A server component for conditional rendering based on user role.
 * Use this component to show/hide UI elements based on the user's authorization level.
 *
 * IMPORTANT: This component performs server-side authorization checks.
 * The role check happens on the server, not the client, ensuring secure access control.
 *
 * @example
 * ```tsx
 * // Basic usage - single role
 * <RoleGate allowedRoles={[UserRole.ADMIN]}>
 *   <AdminPanel />
 * </RoleGate>
 *
 * // Multiple allowed roles
 * <RoleGate allowedRoles={[UserRole.ADMIN, UserRole.POWER_USER]}>
 *   <ManagementTools />
 * </RoleGate>
 *
 * // With fallback content
 * <RoleGate
 *   allowedRoles={[UserRole.ADMIN]}
 *   fallback={<p>You don't have permission to view this content.</p>}
 * >
 *   <AdminPanel />
 * </RoleGate>
 *
 * // With minimum role (hierarchy-based)
 * <RoleGate minimumRole={UserRole.POWER_USER}>
 *   <AdvancedFeatures />
 * </RoleGate>
 *
 * // Any authenticated user
 * <RoleGate requireAuth>
 *   <UserDashboard />
 * </RoleGate>
 * ```
 */

import { auth } from '@/lib/auth/auth';
import { hasAnyRole, hasMinimumRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export type RoleGateProps = {
  /**
   * Content to render when user is authorized
   */
  children: React.ReactNode;

  /**
   * Array of roles that are allowed to view the content.
   * User must have at least one of these roles.
   */
  allowedRoles?: UserRole[];

  /**
   * Minimum role level required (hierarchy-based).
   * User's role must be at or above this level.
   * Takes precedence over allowedRoles if both are provided.
   */
  minimumRole?: UserRole;

  /**
   * If true, only requires authentication (no specific role).
   * Takes precedence over allowedRoles and minimumRole.
   */
  requireAuth?: boolean;

  /**
   * Content to render when user is not authorized.
   * If not provided, renders nothing (null).
   */
  fallback?: React.ReactNode;
};

/**
 * Server component that conditionally renders children based on user role.
 *
 * Authorization checks are performed server-side using the session.
 * This ensures that role-based UI visibility cannot be bypassed client-side.
 *
 * @param props - RoleGate configuration
 * @returns Children if authorized, fallback otherwise
 */
export async function RoleGate({
  children,
  allowedRoles,
  minimumRole,
  requireAuth = false,
  fallback = null,
}: RoleGateProps): Promise<React.ReactNode> {
  const session = await auth();

  // Check if user is authenticated
  if (!session?.user) {
    return fallback;
  }

  // If only authentication is required (no specific role)
  if (requireAuth && !allowedRoles && !minimumRole) {
    return children;
  }

  // Check minimum role requirement (hierarchy-based)
  if (minimumRole) {
    if (hasMinimumRole(session.user, minimumRole)) {
      return children;
    }
    return fallback;
  }

  // Check allowed roles (any match)
  if (allowedRoles && allowedRoles.length > 0) {
    if (hasAnyRole(session.user, allowedRoles)) {
      return children;
    }
    return fallback;
  }

  // No role requirements specified, but user is authenticated
  return children;
}

export default RoleGate;
