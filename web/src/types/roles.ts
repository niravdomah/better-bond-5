/**
 * User Role Definitions
 *
 * IMPORTANT: These are example roles for demonstration purposes.
 * Each application should define its own roles based on business requirements.
 *
 * To customize for your project:
 * 1. Update the UserRole enum with your application's specific roles
 * 2. Update the ROLE_HIERARCHY object to define permission levels
 * 3. Update the roleDescriptions with meaningful descriptions
 * 4. Consider role-to-permission mappings for fine-grained access control
 */

/**
 * Example role enum pattern.
 * Replace these with your application's specific roles.
 */
export enum UserRole {
  /**
   * Full system access - can manage users, configurations, and all resources
   */
  ADMIN = 'admin',

  /**
   * Advanced features and bulk operations - can manage resources within their scope
   */
  POWER_USER = 'power_user',

  /**
   * Standard access - can create, edit, and delete own resources
   */
  STANDARD_USER = 'standard_user',

  /**
   * View-only access - can only read data, cannot make changes
   */
  READ_ONLY = 'read_only',
}

/**
 * Role hierarchy defines the privilege level of each role.
 * Higher numbers indicate greater privilege.
 * Used for "at least" permission checks (e.g., "requires power user or higher").
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 100,
  [UserRole.POWER_USER]: 50,
  [UserRole.STANDARD_USER]: 25,
  [UserRole.READ_ONLY]: 10,
};

/**
 * Human-readable role descriptions for UI display
 */
export const roleDescriptions: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Full system access',
  [UserRole.POWER_USER]: 'Advanced features and bulk operations',
  [UserRole.STANDARD_USER]: 'Standard user access',
  [UserRole.READ_ONLY]: 'View-only access',
};

/**
 * Default role assigned to new users if not specified.
 * Customize based on your application's security requirements.
 */
export const DEFAULT_ROLE = UserRole.STANDARD_USER;

/**
 * Type guard to check if a string is a valid UserRole
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Get all available roles as an array
 */
export function getAllRoles(): UserRole[] {
  return Object.values(UserRole);
}

/**
 * Get role hierarchy level
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role] ?? 0;
}
