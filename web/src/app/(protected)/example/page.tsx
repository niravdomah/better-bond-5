/**
 * Example Protected Page
 *
 * This page demonstrates a minimal protected route.
 * It's only accessible to authenticated users.
 *
 * To create your own protected pages:
 * 1. Add pages inside app/(protected)/ directory
 * 2. The layout.tsx in (protected) handles authentication
 *
 * For role-based access control examples, see:
 * - lib/auth/auth-server.ts: requireMinimumRole(), requireExactRole()
 * - lib/auth/auth-helpers.ts: hasRole(), hasMinimumRole(), isAuthorized()
 */

import Link from 'next/link';

import { getSession } from '@/lib/auth/auth-server';

export default async function ExampleProtectedPage(): Promise<React.ReactElement> {
  const session = await getSession();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Protected Page</h1>
      <p className="text-gray-600 mb-4">
        You are signed in as: {session?.user?.email}
      </p>
      <p className="text-gray-600 mb-4">Your role: {session?.user?.role}</p>
      <p className="text-sm text-gray-500 mb-8">
        This is a minimal example. Replace with your implementation.
      </p>
      <Link href="/auth/signout" className="text-blue-600 hover:underline">
        Sign out
      </Link>
    </div>
  );
}
