'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * BFF Logged Out Page
 *
 * Landing page after the backend completes logout (clears session cookie,
 * terminates the OIDC session) and redirects the user back to the frontend.
 *
 * This page is only used with the Backend For Frontend (BFF) authentication method.
 */

export default function LoggedOutPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Successfully Logged Out</CardTitle>
          <CardDescription>
            You have been signed out of your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your session has been terminated. You will need to sign in again to
            access protected pages.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" aria-label="Return to home page">
            <Link href="/">Return to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
