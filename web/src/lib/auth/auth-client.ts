'use client';

import {
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
} from 'next-auth/react';

export { useSession } from 'next-auth/react';

export async function signIn(
  email: string,
  password: string,
): Promise<{ error?: string; ok: boolean }> {
  try {
    const result = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: 'Invalid credentials', ok: false };
    }

    return { ok: true };
  } catch {
    return { error: 'An error occurred during sign in', ok: false };
  }
}

export async function signOut(): Promise<void> {
  await nextAuthSignOut({ redirect: true, callbackUrl: '/auth/signin' });
}
