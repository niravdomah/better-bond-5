# Authentication Setup

This template includes NextAuth.js v5 (Auth.js) with email/password authentication configured out of the box.

---

## Quick Setup

### 1. Generate Secret

```bash
openssl rand -base64 32
```

Add to `web/.env.local`:
```bash
NEXTAUTH_SECRET=<your-generated-secret>
NEXTAUTH_URL=http://localhost:3000
```

### 2. Demo Credentials

For testing, use these pre-configured accounts:

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `Admin123!` | Admin |
| `power@example.com` | `Power123!` | Power User |
| `user@example.com` | `User123!` | Standard User |
| `readonly@example.com` | `Reader123!` | Read-Only |

---

## Configure Users

The template uses an in-memory user store for demonstration (`lib/auth/auth.config.ts`):

```typescript
const users = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    password: await bcrypt.hash('your-password-here', 10),
    role: UserRole.ADMIN,
  },
  // ... more users
];
```

### For Production

Replace the in-memory store with a database:

1. **Choose a database:** PostgreSQL, MySQL, MongoDB, etc.
2. **Install adapter:** See [NextAuth.js adapters](https://authjs.dev/getting-started/adapters)
3. **Replace `users` array** with database queries
4. **Implement registration** in `app/auth/signup/page.tsx`

---

## Authentication Pages

| Route | Purpose |
|-------|---------|
| `/auth/signin` | Sign in with email/password |
| `/auth/signup` | Create new account (requires DB integration) |
| `/auth/signout` | Sign out confirmation |
| `/auth/error` | Authentication error handling |
| `/auth/forbidden` | Access denied page |

---

## Usage in Your App

### Server Components (Recommended)

**Using helper functions (recommended):**

```typescript
import { requireAuth } from '@/lib/auth/auth-server';

export default async function ProtectedPage() {
  // Automatically redirects to /auth/signin if not authenticated
  const session = await requireAuth();

  return <div>Hello {session.user.name}!</div>;
}
```

**Optional authentication:**

```typescript
import { getSession } from '@/lib/auth/auth-server';

export default async function OptionalAuthPage() {
  const session = await getSession();

  if (session) {
    return <div>Welcome back, {session.user.name}!</div>;
  }

  return <div>Welcome, guest!</div>;
}
```

### Client Components

```typescript
'use client';
import { useSession } from '@/lib/auth/auth-client';

export default function ClientComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return <div>Hello {session.user.name}!</div>;
}
```

### API Routes

```typescript
import { auth } from '@/lib/auth/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
```

---

## Protected Routes

**Next.js 16 uses Server Component-based protection (more secure than middleware):**

### Method 1: Protected Layouts (Recommended)

Create a layout that wraps all routes in a directory:

```typescript
// app/(protected)/layout.tsx
import { requireAuth } from '@/lib/auth/auth-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Automatically redirects to /auth/signin if not authenticated
  await requireAuth();

  return <div>{children}</div>;
}
```

**All routes under `(protected)` are now protected:**
- `/(protected)/dashboard` → Protected
- `/(protected)/settings` → Protected
- `/(protected)/profile` → Protected

### Method 2: Per-Page Protection

Protect individual pages:

```typescript
// app/profile/page.tsx
import { requireAuth } from '@/lib/auth/auth-server';

export default async function ProfilePage() {
  const session = await requireAuth('/profile');

  return <div>Profile for {session.user.name}</div>;
}
```

---

## Adding OAuth Providers

### 1. Uncomment Provider

In `lib/auth/auth.config.ts`, uncomment desired provider:

```typescript
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

providers: [
  Credentials({ /* ... */ }),
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
],
```

### 2. Add Credentials

Add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## Security Best Practices

- Always use HTTPS in production
- Never commit `.env.local` to git
- Use strong, unique NEXTAUTH_SECRET
- Hash passwords with bcrypt (10+ rounds)
- Implement rate limiting for auth endpoints
- Validate and sanitize user input
- Use CSRF protection (NextAuth.js handles this)
- Use Server Components for auth (not middleware)

---

**Need more help?** Check [NextAuth.js Documentation](https://authjs.dev/) or ask Claude Code!
