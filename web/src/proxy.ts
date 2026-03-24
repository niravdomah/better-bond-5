/**
 * Next.js Proxy with Role-Based Access Control (RBAC)
 *
 * This proxy intercepts requests and enforces authentication and
 * authorization requirements based on route configuration.
 *
 * Features:
 * - Route-based protection with flexible configuration
 * - Single role requirements per route
 * - Multiple role requirements (user needs any one of specified roles)
 * - Minimum role level requirements (hierarchy-based)
 * - "Any authenticated user" routes (no specific role required)
 * - Configurable behavior for missing roles
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';
import { hasAnyRole, hasMinimumRole, hasRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

import type { NextRequest } from 'next/server';

/**
 * Route Protection Configuration
 *
 * Define role requirements for protected routes. Routes not listed here
 * are publicly accessible (no authentication required).
 *
 * Configuration options for each route:
 * - `role`: Require exact role match
 * - `roles`: Require any one of the specified roles
 * - `minimumRole`: Require role at or above this level in hierarchy
 * - `authenticated`: Set to true for routes requiring only authentication (no specific role)
 *
 * Route matching:
 * - Exact match: '/admin/settings' matches only that path
 * - Prefix match: '/admin' matches '/admin', '/admin/users', '/admin/settings', etc.
 * - More specific routes take precedence over general ones
 *
 * @example
 * ```ts
 * // Exact role requirement
 * '/admin/settings': { role: UserRole.ADMIN }
 *
 * // Any of multiple roles
 * '/reports': { roles: [UserRole.ADMIN, UserRole.POWER_USER] }
 *
 * // Minimum role level (hierarchy-based)
 * '/dashboard': { minimumRole: UserRole.STANDARD_USER }
 *
 * // Any authenticated user
 * '/profile': { authenticated: true }
 * ```
 */
export type RouteProtectionConfig = {
  /** Require exact role match */
  role?: UserRole;
  /** Require any one of these roles */
  roles?: UserRole[];
  /** Require minimum role level (hierarchy-based) */
  minimumRole?: UserRole;
  /** Only require authentication, no specific role needed */
  authenticated?: boolean;
};

/**
 * Proxy configuration options
 */
export type ProxyConfig = {
  /**
   * Behavior when user has no role or role is missing from session.
   * - 'deny': Treat as unauthorized (403 Forbidden) - more secure
   * - 'lowest': Treat as lowest privilege role (READ_ONLY) - more permissive
   * @default 'deny'
   */
  missingRoleBehavior?: 'deny' | 'lowest';

  /**
   * URL to redirect unauthenticated users to.
   * If not set, returns 401 JSON response for API routes,
   * redirects to /auth/signin for page routes.
   */
  signInUrl?: string;

  /**
   * URL to redirect unauthorized users to (authenticated but insufficient permissions).
   * If not set, returns 403 JSON response for API routes,
   * redirects to /unauthorized for page routes.
   */
  unauthorizedUrl?: string;
};

/**
 * Route protection rules configuration
 *
 * CUSTOMIZE THIS: Add your application's protected routes here.
 * Routes are matched from most specific to least specific.
 *
 * Examples provided below - replace with your actual routes.
 */
export const routeProtection: Record<string, RouteProtectionConfig> = {
  // Admin-only routes
  '/admin': { role: UserRole.ADMIN },
  '/api/admin': { role: UserRole.ADMIN },

  // Power user and above routes
  '/management': { minimumRole: UserRole.POWER_USER },
  '/api/management': { minimumRole: UserRole.POWER_USER },

  // Routes accessible by specific roles
  '/reports': { roles: [UserRole.ADMIN, UserRole.POWER_USER] },
  '/api/reports': { roles: [UserRole.ADMIN, UserRole.POWER_USER] },

  // Standard user and above routes
  '/dashboard': { minimumRole: UserRole.STANDARD_USER },
  '/api/dashboard': { minimumRole: UserRole.STANDARD_USER },

  // Any authenticated user can access
  '/profile': { authenticated: true },
  '/settings': { authenticated: true },
  '/api/user': { authenticated: true },

  // Example API routes with different protection levels
  '/api/example/protected-action': { minimumRole: UserRole.POWER_USER },
};

/**
 * Proxy configuration
 * Customize behavior for missing roles and redirect URLs
 */
export const proxyConfig: ProxyConfig = {
  missingRoleBehavior: 'deny',
  signInUrl: '/auth/signin',
  unauthorizedUrl: '/unauthorized',
};

/**
 * Public routes that should never require authentication
 * Add paths that should always be accessible without login
 */
export const publicRoutes: string[] = [
  '/',
  '/auth/signin',
  '/auth/signout',
  '/auth/error',
  '/api/auth', // NextAuth API routes
];

/**
 * Find the most specific matching route configuration
 * More specific routes take precedence over general prefix matches
 */
function findRouteConfig(pathname: string): RouteProtectionConfig | null {
  // Sort routes by length (longest first) for most specific match
  const sortedRoutes = Object.keys(routeProtection).sort(
    (a, b) => b.length - a.length,
  );

  for (const route of sortedRoutes) {
    // Exact match
    if (pathname === route) {
      return routeProtection[route];
    }
    // Prefix match (route is a prefix of the pathname)
    if (pathname.startsWith(route + '/')) {
      return routeProtection[route];
    }
  }

  return null;
}

/**
 * Check if a path matches any public route
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );
}

/**
 * Check if the request is for an API route
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Check if user meets the route's role requirements
 */
function checkAuthorization(
  user: { role: UserRole } | null | undefined,
  config: RouteProtectionConfig,
  missingRoleBehavior: 'deny' | 'lowest',
): boolean {
  // If only authentication is required, user existence is enough
  if (
    config.authenticated &&
    !config.role &&
    !config.roles &&
    !config.minimumRole
  ) {
    return true;
  }

  // Handle missing role
  if (!user?.role) {
    if (missingRoleBehavior === 'deny') {
      return false;
    }
    // 'lowest' behavior: treat as READ_ONLY
    user = { role: UserRole.READ_ONLY };
  }

  // Check exact role requirement
  if (config.role) {
    return hasRole(user, config.role);
  }

  // Check multiple roles requirement (any match)
  if (config.roles) {
    return hasAnyRole(user, config.roles);
  }

  // Check minimum role requirement (hierarchy-based)
  if (config.minimumRole) {
    return hasMinimumRole(user, config.minimumRole);
  }

  // No specific role requirement and user is authenticated
  return true;
}

/**
 * Main proxy function
 * Handles authentication and authorization for all routes
 */
export const proxy = auth(
  (req: NextRequest & { auth: { user?: { role: UserRole } } | null }) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;

    // Allow public routes without any checks
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Find route protection configuration
    const routeConfig = findRouteConfig(pathname);

    // If no protection configured, allow access (public by default)
    if (!routeConfig) {
      return NextResponse.next();
    }

    // Check authentication
    if (!session?.user) {
      // Unauthenticated user trying to access protected route
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 },
        );
      }

      // Redirect to sign in for page routes
      const signInUrl = new URL(
        proxyConfig.signInUrl || '/auth/signin',
        req.url,
      );
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check authorization (user is authenticated, check role requirements)
    const isAuthorized = checkAuthorization(
      session.user,
      routeConfig,
      proxyConfig.missingRoleBehavior || 'deny',
    );

    if (!isAuthorized) {
      // Authenticated but insufficient permissions
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          { error: 'Forbidden - insufficient permissions' },
          { status: 403 },
        );
      }

      // Redirect to unauthorized page for page routes
      const unauthorizedUrl = new URL(
        proxyConfig.unauthorizedUrl || '/unauthorized',
        req.url,
      );
      return NextResponse.redirect(unauthorizedUrl);
    }

    // Authorization passed
    return NextResponse.next();
  },
);

/**
 * Proxy matcher configuration
 *
 * Defines which routes the proxy should run on.
 * Excludes static files and Next.js internal routes for performance.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
