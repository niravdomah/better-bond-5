# Development Guide

This guide covers development workflows, best practices, and patterns for building with this template.

## Development Workflow

### 1. API-First Development

Start with your API specification to establish a clear contract:

1. **Define your API** in `/api/*.yaml` (OpenAPI format)
2. **Document endpoints**, request/response schemas, and error codes
3. **Use the spec as a contract** between frontend and backend teams
4. **Generate types** from the spec when possible (e.g., using openapi-typescript)

### 2. Frontend Implementation Flow

Follow this recommended sequence:

1. **Define TypeScript types** in `/web/src/types/` based on API schema
2. **Create API endpoint functions** in `/web/src/lib/api/` using the API client
3. **Build UI components** in `/web/src/components/` (start simple, add complexity)
4. **Implement pages** in `/web/src/app/` using Next.js App Router
5. **Write integration tests** to verify the complete workflow

### 3. AI-Assisted Development

This template is optimized for collaboration with AI coding agents:

- **Clear file organization** - Easy for agents to navigate and understand
- **Comprehensive inline documentation** - Comments explain intent, not just mechanics
- **Reusable patterns** - Consistent approaches reduce context needed
- **Type-safe architecture** - TypeScript catches errors before they happen
- **Centralized configuration** - Single source of truth for constants and settings

**Tips for working with AI agents:**
- Provide context by referencing relevant files and patterns
- Ask agents to follow existing patterns in the codebase
- Review generated code for consistency with project standards
- Use the API client template for all HTTP requests

## File Organization

### Directory Structure Best Practices

**`/web/src/app/`** - Next.js App Router pages and layouts
- One file per route: `app/dashboard/page.tsx`
- Layouts for shared UI: `app/layout.tsx`, `app/dashboard/layout.tsx`
- Route groups for organization: `app/(auth)/login/page.tsx`
- API routes (if needed): `app/api/webhook/route.ts`

**`/web/src/components/`** - Reusable UI components
- Organize by feature or type: `components/forms/`, `components/modals/`
- Keep components focused and composable
- Include prop type definitions at the top of each file
- Co-locate related components in subdirectories

**`/web/src/lib/api/`** - API endpoint functions
- One file per resource: `api/users.ts`, `api/products.ts`
- Use the API client for all requests
- Export typed functions that other code can import
- Handle resource-specific error cases here

**`/web/src/lib/utils/`** - Helper functions and utilities
- Keep utilities pure and testable
- Avoid coupling utilities to React or Next.js when possible
- Document complex logic with comments
- Export constants from `constants.ts`

**`/web/src/types/`** - TypeScript type definitions
- Define API response types here
- Create shared types for common data structures
- Use interfaces for objects, types for unions/primitives
- Mirror API structure when possible

**`/web/src/contexts/`** - React Context providers
- One context per feature: `AuthContext.tsx`, `ThemeContext.tsx`
- Include provider component and custom hook
- Document context usage at the top of the file

## TypeScript Best Practices

### Type Definitions

**DO:**
```typescript
// Define types for all API responses
interface User {
  id: string;
  name: string;
  email: string;
}

// Use interfaces for objects
interface UserFormData {
  name: string;
  email: string;
}

// Use type aliases for unions and intersections
type UserRole = 'admin' | 'user' | 'guest';
type UserWithRole = User & { role: UserRole };
```

**DON'T:**
```typescript
// Don't use 'any' - use 'unknown' instead
function processData(data: any) { /* ... */ }

// Better:
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null) {
    // Type narrowing
  }
}
```

### Type Inference

Leverage TypeScript's inference to reduce verbosity:

```typescript
// The API client is generic - let it infer return types
const users = await get<User[]>('/v1/users');  // Type: User[]

// Explicit typing when needed
const userId: string = users[0].id;

// Inference works for most cases
const userName = users[0].name;  // Type: string (inferred)
```

### Strict Mode

The project uses TypeScript strict mode. Key implications:

- All variables must have defined types (no implicit `any`)
- Null checks are enforced (`strictNullChecks`)
- Function return types should be explicit for public APIs
- `this` binding must be explicit

## API Integration Patterns

### Using the API Client

The included API client provides convenience methods:

```typescript
import { get, post, put, del } from '@/lib/api/client';

// GET request with type safety
const users = await get<User[]>('/v1/users');

// POST request with request body and audit trail
const newUser = await post<User>('/v1/users', {
  name: 'John',
  email: 'john@example.com'
}, 'CurrentUser');

// PUT request
const updated = await put<User>(`/v1/users/${id}`, userData, 'CurrentUser');

// DELETE request
await del(`/v1/users/${id}`, 'CurrentUser');
```

### Error Handling

The API client handles common errors automatically:
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Access denied
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

For custom error handling:

```typescript
try {
  const data = await get<User>(`/v1/users/${id}`);
  return data;
} catch (error) {
  // API client throws errors with status codes
  if (error instanceof Error) {
    console.error('Failed to fetch user:', error.message);
  }
  throw error;
}
```

### Resource-Specific API Files

Organize endpoint functions by resource:

```typescript
// lib/api/users.ts
import { get, post, put, del } from './client';
import type { User, CreateUserData } from '@/types/user';

export const getUsers = () =>
  get<User[]>('/v1/users');

export const getUser = (id: string) =>
  get<User>(`/v1/users/${id}`);

export const createUser = (data: CreateUserData, currentUser: string) =>
  post<User>('/v1/users', data, currentUser);

export const updateUser = (id: string, data: Partial<User>, currentUser: string) =>
  put<User>(`/v1/users/${id}`, data, currentUser);

export const deleteUser = (id: string, currentUser: string) =>
  del(`/v1/users/${id}`, currentUser);
```

### Query Parameters

Use the `params` option for GET requests:

```typescript
const users = await get<User[]>('/v1/users', {
  params: { role: 'admin', limit: '10' }
});
// Fetches: /v1/users?role=admin&limit=10
```

## Styling Best Practices

### Tailwind CSS Patterns

**Responsive Design:**
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Mobile: full width, tablet: half, desktop: third */}
</div>
```

**State Variants:**
```tsx
<button className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-300">
  Submit
</button>
```

**Dark Mode (if configured):**
```tsx
<div className="bg-white dark:bg-gray-800 text-black dark:text-white">
  Content
</div>
```

### Custom Theme Variables

Define reusable theme tokens in `app/globals.css`:

```css
@layer base {
  :root {
    --color-primary: 59 130 246;     /* blue-500 */
    --color-secondary: 139 92 246;   /* violet-500 */
    --radius: 0.5rem;
  }
}
```

Use in components:
```tsx
<div className="bg-[rgb(var(--color-primary))] rounded-[var(--radius)]">
  Themed content
</div>
```

### Component Styling Strategy

1. **Use Tailwind utilities first** - Most styling can be done with utilities
2. **Extract repeated patterns** - Create components for repeated UI patterns
3. **Use CSS modules sparingly** - Only when Tailwind utilities aren't sufficient
4. **Keep animations in globals.css** - Define keyframes globally, reference in classes

## Development Environment

### Environment Variables

Create `.env.local` for development:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8042
```

Create `.env.production` for production:
```env
NEXT_PUBLIC_API_BASE_URL=https://api.production.com
```

**Important:**
- Prefix with `NEXT_PUBLIC_` to expose to browser
- Never commit `.env.local` or `.env.production` to version control
- Use `.env.example` to document required variables

### Development Server

```bash
cd web
npm run dev
```

Features:
- Hot module replacement (HMR)
- Fast refresh for React components
- Runs on http://localhost:3000
- API requests proxied to `NEXT_PUBLIC_API_BASE_URL`

### Production Build

```bash
cd web
npm run build
npm start
```

The build process:
1. Type checks all TypeScript files
2. Compiles and bundles application code
3. Optimizes for performance (minification, tree shaking)
4. Generates static pages where possible
5. Outputs to `.next` directory

## Debugging Tips

### Request/Response Logging

The API client automatically logs requests in development mode:

```
[API Request] GET /v1/users
[API Response] GET /v1/users (200 OK) - 145ms
Response data: [{ id: '1', name: 'John' }, ...]
```

Sensitive fields are automatically sanitized (password, token, apiKey, secret, creditCard, ssn).

### TypeScript Errors

Common issues and solutions:

**"Type 'X' is not assignable to type 'Y'"**
- Check your type definitions match the actual data structure
- Use type narrowing or type guards if needed

**"Cannot find module '@/lib/api/client'"**
- Ensure the path alias is correct in `tsconfig.json`
- Restart your IDE/editor after config changes

**"Object is possibly 'undefined'"**
- Use optional chaining: `user?.name`
- Add type guards: `if (user) { user.name }`

### React/Next.js Issues

**"Hydration failed"**
- Server and client rendered different HTML
- Check for dynamic content that changes between renders
- Ensure `useEffect` is used for browser-only code

**"Module not found"**
- Check import paths use the `@/` alias correctly
- Verify the file exists at the specified path
- Restart the dev server after adding new files

## Performance Optimization

### Code Splitting

Next.js automatically splits code by route. For additional splitting:

```typescript
// Lazy load heavy components
const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <div>Loading...</div>
});
```

### Image Optimization

Use Next.js Image component:

```tsx
import Image from 'next/image';

<Image
  src="/photo.jpg"
  alt="Description"
  width={500}
  height={300}
  priority // For above-the-fold images
/>
```

### Memoization

Use React hooks to prevent unnecessary re-renders:

```tsx
// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callbacks passed to children
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

## Testing

See [Testing Strategy](#testing-strategy) section in CLAUDE.md for comprehensive testing guidelines.

Quick reference:
- Focus on integration tests over unit tests
- Test realistic user workflows
- Use strategic API mocking only when necessary
- Keep tests in `src/__tests__/` organized by type
