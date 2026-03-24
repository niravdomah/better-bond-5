/**
 * Next.js 16 Proxy - Lightweight Request Interception
 *
 * IMPORTANT: This file uses Next.js 16's new proxy convention.
 * - File name: proxy.ts (NOT middleware.ts)
 * - Export name: proxy (NOT middleware)
 * - Runtime: Node.js (NOT Edge Runtime)
 *
 * Following Next.js 16 and Vercel's security best practices:
 * - This proxy is used ONLY for lightweight redirects
 * - Authentication/authorization checks are in Server Components (layouts)
 * - This prevents middleware-based authentication vulnerabilities
 *
 * Security Note:
 * Do NOT add authentication or authorization logic here. Use Server Components instead.
 *
 * See:
 * - https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 * - https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/auth';

import type { NextRequest } from 'next/server';

/**
 * Proxy function - handles lightweight request interception
 *
 * Current responsibilities:
 * - Redirect authenticated users away from auth pages (signin/signup)
 *
 * NOT handled here (moved to layouts):
 * - Authentication checks → See app/dashboard/layout.tsx
 * - Role-based access control → See app/admin/layout.tsx, app/power-user/layout.tsx
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Define auth routes (signin, signup, etc.)
  const authRoutes = ['/auth/signin', '/auth/signup'];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect authenticated users away from auth pages
  if (isAuthRoute) {
    const session = await auth();
    if (session) {
      // User is already logged in, redirect to home
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Allow request to continue
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
