/**
 * Authorization Helper Functions
 *
 * Utilities for role-based access control (RBAC) throughout the application.
 * Use these functions to check user permissions in both server and client components.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';

import { getRoleLevel, UserRole } from '@/types/roles';

import { auth } from './auth';

/**
 * Check if a user has a specific role
 *
 * @param user - The user object from session (must have role field)
 * @param role - The role to check for
 * @returns true if user has the exact role specified
 *
 * @example
 * ```ts
 * const session = await getServerSession();
 * if (hasRole(session?.user, UserRole.ADMIN)) {
 *   // User is an admin
 * }
 * ```
 */
export function hasRole(
  user: { role: UserRole } | null | undefined,
  role: UserRole,
): boolean {
  if (!user) return false;
  return user.role === role;
}

/**
 * Check if a user has any of the specified roles
 *
 * @param user - The user object from session
 * @param roles - Array of roles to check
 * @returns true if user has at least one of the specified roles
 *
 * @example
 * ```ts
 * if (hasAnyRole(session?.user, [UserRole.ADMIN, UserRole.POWER_USER])) {
 *   // User is either admin or power user
 * }
 * ```
 */
export function hasAnyRole(
  user: { role: UserRole } | null | undefined,
  roles: UserRole[],
): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Check if user's role meets or exceeds the minimum required role level
 * Uses role hierarchy to determine if user has sufficient privileges
 *
 * @param user - The user object from session
 * @param minimumRole - The minimum role level required
 * @returns true if user's role level is >= minimum role level
 *
 * @example
 * ```ts
 * // ADMIN (100) and POWER_USER (50) can access, others cannot
 * if (hasMinimumRole(session?.user, UserRole.POWER_USER)) {
 *   // User has power user privileges or higher
 * }
 * ```
 */
export function hasMinimumRole(
  user: { role: UserRole } | null | undefined,
  minimumRole: UserRole,
): boolean {
  if (!user) return false;
  return getRoleLevel(user.role) >= getRoleLevel(minimumRole);
}

/**
 * Server-side middleware function to require authentication
 * Redirects to signin if not authenticated
 *
 * @returns Session if authenticated, redirects to signin otherwise
 *
 * @example
 * ```ts
 * // In a Server Component
 * export default async function ProtectedPage() {
 *   const session = await requireAuth();
 *   return <div>Welcome {session.user.name}</div>;
 * }
 * ```
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) {
    throw new Error('Unauthorized - authentication required');
  }
  return session;
}

/**
 * Server-side function to require a specific role
 * Throws error if user doesn't have the required role
 *
 * @param role - The role required to access the resource
 * @returns Session if user has required role
 * @throws Error if user doesn't have required role or not authenticated
 *
 * @example
 * ```ts
 * export default async function AdminPage() {
 *   const session = await requireRole(UserRole.ADMIN);
 *   return <div>Admin Dashboard</div>;
 * }
 * ```
 */
export async function requireRole(role: UserRole): Promise<Session> {
  const session = await requireAuth();
  if (!hasRole(session.user, role)) {
    // Log detailed info server-side, return generic message to client
    console.error(
      `Authorization failed: requires ${role} role, user ${session.user.id} has ${session.user.role}`,
    );
    throw new Error('Forbidden - insufficient permissions');
  }
  return session;
}

/**
 * Server-side function to require minimum role level
 * Throws error if user doesn't meet minimum role requirement
 *
 * @param minimumRole - The minimum role level required
 * @returns Session if user meets minimum role requirement
 * @throws Error if user doesn't meet requirement or not authenticated
 *
 * @example
 * ```ts
 * export default async function PowerUserPage() {
 *   // ADMIN and POWER_USER can access
 *   const session = await requireMinimumRole(UserRole.POWER_USER);
 *   return <div>Power User Features</div>;
 * }
 * ```
 */
export async function requireMinimumRole(
  minimumRole: UserRole,
): Promise<Session> {
  const session = await requireAuth();
  if (!hasMinimumRole(session.user, minimumRole)) {
    // Log detailed info server-side, return generic message to client
    console.error(
      `Authorization failed: requires minimum ${minimumRole} role (level ${getRoleLevel(minimumRole)}), user ${session.user.id} has ${session.user.role} (level ${getRoleLevel(session.user.role)})`,
    );
    throw new Error('Forbidden - insufficient permissions');
  }
  return session;
}

/**
 * Server-side function to require any of the specified roles
 *
 * @param roles - Array of acceptable roles
 * @returns Session if user has one of the specified roles
 * @throws Error if user doesn't have any of the required roles
 *
 * @example
 * ```ts
 * export default async function ManagementPage() {
 *   const session = await requireAnyRole([UserRole.ADMIN, UserRole.POWER_USER]);
 *   return <div>Management Dashboard</div>;
 * }
 * ```
 */
export async function requireAnyRole(roles: UserRole[]): Promise<Session> {
  const session = await requireAuth();
  if (!hasAnyRole(session.user, roles)) {
    // Log detailed info server-side, return generic message to client
    console.error(
      `Authorization failed: requires one of ${roles.join(', ')}, user ${session.user.id} has ${session.user.role}`,
    );
    throw new Error('Forbidden - insufficient permissions');
  }
  return session;
}

/**
 * API route wrapper to protect endpoints with role-based access control
 *
 * @param handler - The API route handler function
 * @param options - Protection options (role, minimumRole, or roles array)
 * @returns Wrapped handler with authorization checks
 *
 * @example
 * ```ts
 * // Protect route requiring admin role
 * export const GET = withRoleProtection(
 *   async (request) => {
 *     return NextResponse.json({ data: 'sensitive data' });
 *   },
 *   { role: UserRole.ADMIN }
 * );
 *
 * // Protect route requiring minimum power user level
 * export const POST = withRoleProtection(
 *   async (request) => {
 *     return NextResponse.json({ success: true });
 *   },
 *   { minimumRole: UserRole.POWER_USER }
 * );
 *
 * // Protect route requiring any of specified roles
 * export const DELETE = withRoleProtection(
 *   async (request) => {
 *     return NextResponse.json({ deleted: true });
 *   },
 *   { roles: [UserRole.ADMIN, UserRole.POWER_USER] }
 * );
 * ```
 */
export function withRoleProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: { role?: UserRole; minimumRole?: UserRole; roles?: UserRole[] },
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const session = await auth();

      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 },
        );
      }

      // Check role requirements
      if (options.role && !hasRole(session.user, options.role)) {
        console.error(
          `API authorization failed: requires ${options.role} role, user ${session.user.id} has ${session.user.role}`,
        );
        return NextResponse.json(
          { error: 'Forbidden - insufficient permissions' },
          { status: 403 },
        );
      }

      if (
        options.minimumRole &&
        !hasMinimumRole(session.user, options.minimumRole)
      ) {
        console.error(
          `API authorization failed: requires minimum ${options.minimumRole} role, user ${session.user.id} has ${session.user.role}`,
        );
        return NextResponse.json(
          { error: 'Forbidden - insufficient permissions' },
          { status: 403 },
        );
      }

      if (options.roles && !hasAnyRole(session.user, options.roles)) {
        console.error(
          `API authorization failed: requires one of ${options.roles.join(', ')}, user ${session.user.id} has ${session.user.role}`,
        );
        return NextResponse.json(
          { error: 'Forbidden - insufficient permissions' },
          { status: 403 },
        );
      }

      // Authorization passed, call handler
      return await handler(request);
    } catch (error) {
      console.error('Authorization error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}

/**
 * Check if user is authorized to perform an action on a resource
 * This is a flexible pattern for implementing resource-based access control
 *
 * @param user - The user object from session
 * @param resource - The resource being accessed (e.g., 'document', 'user-profile')
 * @param action - The action being performed (e.g., 'read', 'write', 'delete')
 * @returns true if user is authorized
 *
 * @example
 * ```ts
 * // Implement custom authorization logic
 * if (isAuthorized(session?.user, 'document', 'delete')) {
 *   // User can delete documents
 * }
 * ```
 */
export function isAuthorized(
  user: { role: UserRole; id?: string } | null | undefined,
  resource: string,
  action: 'read' | 'write' | 'delete' | 'admin',
): boolean {
  if (!user) return false;

  // Example authorization rules - customize for your application
  switch (resource) {
    case 'user-profile':
      if (action === 'read') return true; // All authenticated users can read profiles
      if (action === 'write')
        return hasMinimumRole(user, UserRole.STANDARD_USER);
      if (action === 'delete') return hasRole(user, UserRole.ADMIN);
      if (action === 'admin') return hasRole(user, UserRole.ADMIN);
      break;

    case 'document':
      if (action === 'read') return hasMinimumRole(user, UserRole.READ_ONLY);
      if (action === 'write')
        return hasMinimumRole(user, UserRole.STANDARD_USER);
      if (action === 'delete') return hasMinimumRole(user, UserRole.POWER_USER);
      if (action === 'admin') return hasRole(user, UserRole.ADMIN);
      break;

    case 'system-settings':
      // Only admins can access system settings
      return hasRole(user, UserRole.ADMIN);

    default:
      // By default, require admin for unknown resources
      return hasRole(user, UserRole.ADMIN);
  }

  return false;
}
