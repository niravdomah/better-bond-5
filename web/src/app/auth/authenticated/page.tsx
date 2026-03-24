'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * BFF Authentication Successful Page
 *
 * Landing page after the backend completes OIDC authentication and redirects
 * the user back to the frontend. This page:
 * 1. Calls the backend's userinfo endpoint to fetch user details (id, email, name, role)
 * 2. Redirects the user to the page they originally wanted to visit (via callbackUrl)
 *
 * This page is only used with the Backend For Frontend (BFF) authentication method.
 * The backend has already set the HTTP-only session cookie by the time the user arrives here.
 */

function validateCallbackUrl(url: string | null): string {
  if (!url) return '/';

  if (url.startsWith('//')) return '/';
  if (!url.startsWith('/')) return '/';
  if (/^\/*(data|javascript):/i.test(url)) return '/';

  return url;
}

function AuthenticatedContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = validateCallbackUrl(searchParams.get('callbackUrl'));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchUserInfoAndRedirect(): Promise<void> {
      try {
        // TODO: Replace with actual userinfo endpoint from BFF configuration
        const response = await fetch('/api/auth/userinfo', {
          credentials: 'include',
        });

        if (!response.ok) {
          if (!cancelled) {
            setError(
              'Failed to retrieve user information. Please try signing in again.',
            );
          }
          return;
        }

        if (!cancelled) {
          router.replace(callbackUrl);
        }
      } catch {
        if (!cancelled) {
          setError(
            'An error occurred while verifying your session. Please try signing in again.',
          );
        }
      }
    }

    fetchUserInfoAndRedirect();

    return () => {
      cancelled = true;
    };
  }, [router, callbackUrl]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If the problem persists, contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Successful</CardTitle>
          <CardDescription>
            You have been signed in. Redirecting...
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function AuthenticatedPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div>Loading...</div>
        </div>
      }
    >
      <AuthenticatedContent />
    </Suspense>
  );
}
