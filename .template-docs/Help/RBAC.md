# Role-Based Access Control (RBAC)

Complete guide to the RBAC system for managing user permissions.

---

## Role Hierarchy

The template includes four example roles with different privilege levels:

| Role              | Level | Description                                               |
| ----------------- | ----- | --------------------------------------------------------- |
| **Admin**         | 100   | Full system access - manage users, configs, all resources |
| **Power User**    | 50    | Advanced features and bulk operations                     |
| **Standard User** | 25    | Create, edit, and delete own resources                    |
| **Read-Only**     | 10    | View-only access - cannot make changes                    |

Roles are defined in `web/src/types/roles.ts` with:

- `UserRole` enum for type-safe role references
- `ROLE_HIERARCHY` for privilege levels (higher = more access)
- `roleDescriptions` for UI display

---

## Demo Users

Test RBAC with these pre-configured accounts:

| Email                  | Password     | Role          |
| ---------------------- | ------------ | ------------- |
| `admin@example.com`    | `Admin123!`  | Admin         |
| `power@example.com`    | `Power123!`  | Power User    |
| `user@example.com`     | `User123!`   | Standard User |
| `readonly@example.com` | `Reader123!` | Read-Only     |

---

## Customizing Roles

### 1. Define Your Roles

Edit `web/src/types/roles.ts`:

```typescript
export enum UserRole {
  MANAGER = "manager",
  EMPLOYEE = "employee",
  CONTRACTOR = "contractor",
  GUEST = "guest",
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.MANAGER]: 100,
  [UserRole.EMPLOYEE]: 50,
  [UserRole.CONTRACTOR]: 25,
  [UserRole.GUEST]: 10,
};

export const roleDescriptions: Record<UserRole, string> = {
  [UserRole.MANAGER]: "Team management and reporting",
  [UserRole.EMPLOYEE]: "Standard employee access",
  [UserRole.CONTRACTOR]: "Limited contractor access",
  [UserRole.GUEST]: "View-only guest access",
};

export const DEFAULT_ROLE = UserRole.EMPLOYEE;
```

### 2. Update Auth Config

Update `web/src/lib/auth/auth.config.ts` with your roles if needed.

---

## Checking Permissions

### Helper Functions Overview

Import from `@/lib/auth/auth-helpers`:

| Function                               | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `hasRole(user, role)`                  | Check if user has exact role               |
| `hasAnyRole(user, roles[])`            | Check if user has any of the roles         |
| `hasMinimumRole(user, role)`           | Check if user meets minimum role level     |
| `requireAuth()`                        | Require authentication (throws if not)     |
| `requireRole(role)`                    | Require specific role (throws if not)      |
| `requireMinimumRole(role)`             | Require minimum role level (throws if not) |
| `requireAnyRole(roles[])`              | Require any of specified roles             |
| `withRoleProtection(handler, options)` | Wrap API routes with authorization         |
| `isAuthorized(user, resource, action)` | Resource-based authorization               |

### Server Components (Recommended)

**Using helper functions:**

```typescript
import { requireRole, hasRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export default async function AdminPage() {
  // Automatically throws if not ADMIN
  const session = await requireRole(UserRole.ADMIN);

  return <div>Admin content for {session.user.name}</div>;
}
```

**Conditional rendering based on role:**

```typescript
import { hasRole, hasAnyRole, requireAuth } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export default async function DashboardPage() {
  const session = await requireAuth();

  const isAdmin = hasRole(session.user, UserRole.ADMIN);
  const canManage = hasAnyRole(session.user, [
    UserRole.ADMIN,
    UserRole.POWER_USER,
  ]);

  return (
    <div>
      <h1>Dashboard</h1>
      {isAdmin && <AdminPanel />}
      {canManage && <ManagementTools />}
      <StandardFeatures />
    </div>
  );
}
```

### Using `hasAnyRole()` for Multiple Role Checks

```typescript
import { hasAnyRole } from "@/lib/auth/auth-helpers";
import { UserRole } from "@/types/roles";

// Check if user has any of the management roles
if (hasAnyRole(session?.user, [UserRole.ADMIN, UserRole.POWER_USER])) {
  // User is either admin or power user - can access management features
}

// Check if user can edit content
const canEdit = hasAnyRole(session?.user, [
  UserRole.ADMIN,
  UserRole.POWER_USER,
  UserRole.STANDARD_USER,
]);
```

### Using `isAuthorized()` for Resource-Based Authorization

The `isAuthorized()` function provides fine-grained control over what actions users can perform on specific resources:

```typescript
import { isAuthorized } from "@/lib/auth/auth-helpers";

// Check document permissions
if (isAuthorized(session?.user, "document", "read")) {
  // User can read documents
}

if (isAuthorized(session?.user, "document", "delete")) {
  // User can delete documents (requires POWER_USER or higher)
}

// Check user profile permissions
if (isAuthorized(session?.user, "user-profile", "write")) {
  // User can edit profiles (requires STANDARD_USER or higher)
}

// Check system settings
if (isAuthorized(session?.user, "system-settings", "admin")) {
  // Only ADMIN can access system settings
}
```

**Available actions:** `'read'`, `'write'`, `'delete'`, `'admin'`

Customize the authorization rules in `web/src/lib/auth/auth-helpers.ts` by modifying the `isAuthorized()` function.

### Client Components

```typescript
'use client';
import { useSession } from 'next-auth/react';
import { hasMinimumRole, hasAnyRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export default function Component() {
  const { data: session } = useSession();

  if (!session || !hasMinimumRole(session.user, UserRole.STANDARD_USER)) {
    return <div>Access Denied</div>;
  }

  // Check for multiple roles client-side
  const canManage = hasAnyRole(session.user, [
    UserRole.ADMIN,
    UserRole.POWER_USER,
  ]);

  return (
    <div>
      <h1>Protected content</h1>
      {canManage && <button>Management Action</button>}
    </div>
  );
}
```

### API Routes

**Using `withRoleProtection()` wrapper (Recommended):**

```typescript
import { NextResponse } from "next/server";
import { withRoleProtection } from "@/lib/auth/auth-helpers";
import { UserRole } from "@/types/roles";

// Protect route requiring exact role
export const GET = withRoleProtection(
  async (request) => {
    return NextResponse.json({ data: "admin-only data" });
  },
  { role: UserRole.ADMIN },
);

// Protect route requiring minimum role level
export const POST = withRoleProtection(
  async (request) => {
    const body = await request.json();
    return NextResponse.json({ success: true, data: body });
  },
  { minimumRole: UserRole.POWER_USER },
);

// Protect route requiring any of specified roles
export const DELETE = withRoleProtection(
  async (request) => {
    return NextResponse.json({ deleted: true });
  },
  { roles: [UserRole.ADMIN, UserRole.POWER_USER] },
);
```

**Manual approach:**

```typescript
import { auth } from "@/lib/auth/auth";
import { hasMinimumRole } from "@/lib/auth/auth-helpers";
import { UserRole } from "@/types/roles";

export async function POST(req: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasMinimumRole(session.user, UserRole.ADMIN)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Admin-only logic
  return Response.json({ success: true });
}
```

---

## Role-Based UI with RoleGate Component

The `RoleGate` component provides server-side conditional rendering based on user role. This ensures authorization checks happen on the server, not the client.

**Location:** `web/src/components/RoleGate.tsx`

### Basic Usage

```tsx
import { RoleGate } from "@/components/RoleGate";
import { UserRole } from "@/types/roles";

export default async function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Only visible to admins */}
      <RoleGate allowedRoles={[UserRole.ADMIN]}>
        <AdminPanel />
      </RoleGate>

      {/* Visible to admins and power users */}
      <RoleGate allowedRoles={[UserRole.ADMIN, UserRole.POWER_USER]}>
        <ManagementTools />
      </RoleGate>

      {/* Visible to everyone */}
      <StandardFeatures />
    </div>
  );
}
```

### With Fallback Content

```tsx
<RoleGate
  allowedRoles={[UserRole.ADMIN]}
  fallback={<p>You don't have permission to view this content.</p>}
>
  <AdminPanel />
</RoleGate>
```

### Using Minimum Role (Hierarchy-Based)

```tsx
{
  /* Visible to POWER_USER, ADMIN (anyone with level >= 50) */
}
<RoleGate minimumRole={UserRole.POWER_USER}>
  <AdvancedFeatures />
</RoleGate>;
```

### Any Authenticated User

```tsx
{
  /* Visible to any logged-in user */
}
<RoleGate requireAuth>
  <UserDashboard />
</RoleGate>;
```

### Props Reference

| Prop           | Type         | Description                               |
| -------------- | ------------ | ----------------------------------------- |
| `children`     | `ReactNode`  | Content to render when authorized         |
| `allowedRoles` | `UserRole[]` | Roles allowed to view (any match)         |
| `minimumRole`  | `UserRole`   | Minimum role level required               |
| `requireAuth`  | `boolean`    | Only require authentication               |
| `fallback`     | `ReactNode`  | Content when unauthorized (default: null) |

---

## Route Protection

### Method 1: Layout-Based Protection (Recommended)

Protect all routes in a directory with a layout:

```typescript
// app/admin/layout.tsx
import { requireRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(UserRole.ADMIN);

  return <div>{children}</div>;
}
```

### Method 2: Page-Level Protection

Protect individual pages:

```typescript
// app/admin/page.tsx
import { requireRole } from '@/lib/auth/auth-helpers';
import { UserRole } from '@/types/roles';

export default async function AdminPage() {
  const session = await requireRole(UserRole.ADMIN);

  return <div>Admin content for {session.user.name}</div>;
}
```

### Method 3: Proxy-Based Protection

Configure route protection in `web/src/proxy.ts`:

```typescript
// Protected routes are configured in proxy
// - Unauthenticated users receive 401 Unauthorized
// - Authenticated users without required role receive 403 Forbidden
```

---

## Input Validation with Zod

The project uses [Zod](https://zod.dev) for type-safe input validation. Validation schemas are defined in `web/src/lib/validation/schemas.ts`.

### Available Schemas

| Schema                 | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `emailSchema`          | Email validation with lowercase normalization                     |
| `passwordSchema`       | Strong password (8+ chars, uppercase, lowercase, number, special) |
| `simplePasswordSchema` | Basic password (8+ chars minimum)                                 |
| `signInSchema`         | Email + password for login                                        |
| `signUpSchema`         | Email, name, password with confirmation                           |
| `updateProfileSchema`  | Name + email for profile updates                                  |
| `fileUploadSchema`     | File name, size (max 5MB), type validation                        |
| `paginationSchema`     | Page + limit with defaults                                        |
| `searchSchema`         | Search query with optional filters                                |

### Using `validateRequest()`

The `validateRequest()` helper provides type-safe validation with error handling:

```typescript
import { validateRequest, signInSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  const body = await request.json();

  const result = validateRequest(signInSchema, body);

  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.errors },
      { status: 400 },
    );
  }

  // result.data is typed as { email: string, password: string }
  const { email, password } = result.data;

  // Proceed with validated data
}
```

### Custom Schema Example

```typescript
import { z } from "zod";
import { validateRequest } from "@/lib/validation/schemas";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = validateRequest(createPostSchema, body);

  if (!result.success) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  // result.data is typed as { title: string, content: string, tags?: string[] }
  return Response.json({ post: result.data });
}
```

### Sanitizing HTML Input

Use `sanitizeHtml()` to strip HTML tags and dangerous characters:

```typescript
import { sanitizeHtml, sanitizedStringSchema } from "@/lib/validation/schemas";

// Manual sanitization
const cleanInput = sanitizeHtml(userInput);

// Or use the schema transformer
const schema = z.object({
  comment: sanitizedStringSchema,
});
```

### Async Validation

For schemas with async refinements (e.g., database lookups):

```typescript
import { validateRequestAsync } from "@/lib/validation/schemas";

const result = await validateRequestAsync(asyncSchema, data);
```

---

## Best Practices

### Do's

- **Always validate permissions server-side** - client checks are for UX only
- **Never trust client-side authorization** - always verify on the server
- **Use minimum permission levels** for flexibility with `hasMinimumRole()`
- **Validate all input server-side** using Zod schemas before processing
- **Document permission requirements** for each feature
- **Test all role combinations** thoroughly
- **Fail securely** - default to denying access
- **Use `withRoleProtection()`** wrapper for consistent API route protection
- **Check authorization on every request** - no stale authorization

### Don'ts

- Don't rely on client-side checks alone
- Don't hardcode role names (use `UserRole` enum)
- Don't expose sensitive data to unauthorized roles
- Don't forget API route protection
- Don't skip input validation on the server
- Don't cache authorization decisions without proper invalidation

---

## File Reference

| File                                | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `web/src/types/roles.ts`            | Role enum, hierarchy, and descriptions            |
| `web/src/types/next-auth.d.ts`      | NextAuth type extensions for role field           |
| `web/src/lib/auth/auth-helpers.ts`  | Authorization helper functions                    |
| `web/src/lib/auth/auth.config.ts`   | NextAuth configuration with JWT/session callbacks |
| `web/src/lib/validation/schemas.ts` | Zod validation schemas                            |
| `web/src/components/RoleGate.tsx`   | Role-based UI component                           |
| `web/src/proxy.ts`                  | Route protection proxy                            |

---

**Need more help?** Ask Claude Code about RBAC implementation!
