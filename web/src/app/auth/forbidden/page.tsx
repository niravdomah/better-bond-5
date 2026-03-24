import Link from 'next/link';

import { roleDescriptions } from '@/types/roles';

interface ForbiddenPageProps {
  searchParams: Promise<{
    required?: string;
    current?: string;
  }>;
}

export default async function ForbiddenPage({
  searchParams,
}: ForbiddenPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const requiredRole = params.required;
  const currentRole = params.current;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-red-600">403</h1>
          <h2 className="text-2xl font-semibold">Access Forbidden</h2>
          <p className="text-gray-600">
            You do not have permission to access this page.
          </p>
        </div>

        {requiredRole && currentRole && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-left">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-semibold text-gray-700">Required Role:</dt>
                <dd className="text-gray-600">
                  {roleDescriptions[
                    requiredRole as keyof typeof roleDescriptions
                  ] || requiredRole}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-700">Your Role:</dt>
                <dd className="text-gray-600">
                  {roleDescriptions[
                    currentRole as keyof typeof roleDescriptions
                  ] || currentRole}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Return to Home
          </Link>
          <Link
            href="/auth/signout"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Sign out and switch accounts
          </Link>
        </div>

        <p className="text-xs text-gray-500">
          If you believe you should have access to this page, please contact
          your administrator.
        </p>
      </div>
    </div>
  );
}
