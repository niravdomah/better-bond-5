'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signOut } from '@/lib/auth/auth-client';

export default function SignOutPage(): React.ReactElement {
  const handleSignOut = async (): Promise<void> => {
    await signOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign Out</CardTitle>
          <CardDescription>Are you sure you want to sign out?</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You will need to sign in again to access protected pages.
          </p>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button
            onClick={handleSignOut}
            variant="destructive"
            className="flex-1"
            aria-label="Confirm sign out"
          >
            Sign Out
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="flex-1"
            aria-label="Cancel sign out"
          >
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
