# Included Features

This template comes with several production-ready features out of the box. This document details each feature and how to use it.

## API Client

**Location:** [web/src/lib/api/client.ts](../web/src/lib/api/client.ts)

A comprehensive fetch wrapper that simplifies API interactions with type safety and robust error handling.

### Features

- **Type-safe requests and responses** - Full TypeScript generic support
- **Automatic JSON parsing** - Handles request/response serialization
- **Error handling** - Built-in handling for common HTTP status codes
- **Development logging** - Request/response logging with data sanitization
- **Binary response support** - Handle file downloads (PDFs, images, etc.)
- **Query parameter handling** - Automatic URL encoding
- **Custom headers** - Per-request or global header configuration
- **Audit trail support** - `LastChangedUser` header for tracking changes

### Basic Usage

```typescript
import { get, post, put, del } from '@/lib/api/client';

// Type-safe GET request
const users = await get<User[]>('/v1/users');

// POST with body and audit trail
const newUser = await post<User>('/v1/users', {
  name: 'John Doe',
  email: 'john@example.com'
}, 'admin@example.com');

// PUT for updates
const updated = await put<User>(`/v1/users/${id}`, userData, 'admin@example.com');

// DELETE
await del(`/v1/users/${id}`, 'admin@example.com');
```

### Configuration

**API Base URL:**
Set via environment variable in `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8042
```

Or directly in [web/src/lib/utils/constants.ts](../web/src/lib/utils/constants.ts):
```typescript
export const API_BASE_URL = 'http://localhost:8042';
```

**Error Handling:**
Customize error behavior by editing the `handleErrorResponse` function in [client.ts](../web/src/lib/api/client.ts).

### Advanced Features

**Query Parameters:**
```typescript
const users = await get<User[]>('/v1/users', {
  params: { role: 'admin', status: 'active' }
});
// Fetches: /v1/users?role=admin&status=active
```

**Custom Headers:**
```typescript
const data = await get<Data>('/v1/data', {
  headers: { 'X-Request-ID': requestId }
});
```

**Binary Responses (File Downloads):**
```typescript
const blob = await get<Blob>('/v1/reports/download', {
  params: { reportId: '123' },
  isBinaryResponse: true
});

// Create download
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'report.pdf';
link.click();
window.URL.revokeObjectURL(url);
```

**Development Logging:**
In development mode, all requests and responses are logged with sensitive data automatically sanitized:
- `password` → `[REDACTED]`
- `token` → `[REDACTED]`
- `apiKey` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `creditCard` → `[REDACTED]`
- `ssn` → `[REDACTED]`

See [API_INTEGRATION.md](API_INTEGRATION.md) for comprehensive API integration patterns and examples.

---

## Toast Notification System

**Location:** [web/src/contexts/ToastContext.tsx](../web/src/contexts/ToastContext.tsx)

A complete toast notification system with multiple variants and auto-dismiss functionality.

### Features

- **Multiple variants** - success, error, info, warning
- **Auto-dismiss** - Configurable duration (default 5 seconds)
- **Manual dismiss** - Click to close
- **Accessible** - ARIA attributes for screen readers
- **Customizable styling** - Tailwind CSS classes
- **Animation** - Smooth slide-in/fade-out transitions
- **Stacking** - Multiple toasts stack vertically

### Usage

**1. The provider is already set up in your layout:**

[web/src/app/layout.tsx](../web/src/app/layout.tsx) includes the `ToastProvider`.

**2. Use the toast hook in your components:**

```tsx
'use client';

import { useToast } from '@/contexts/ToastContext';

export default function MyComponent() {
  const { showToast } = useToast();

  const handleSuccess = () => {
    showToast('Operation completed successfully!', 'success');
  };

  const handleError = () => {
    showToast('Something went wrong.', 'error');
  };

  const handleInfo = () => {
    showToast('Here is some information.', 'info');
  };

  const handleWarning = () => {
    showToast('Please be careful!', 'warning');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
      <button onClick={handleInfo}>Info</button>
      <button onClick={handleWarning}>Warning</button>
    </div>
  );
}
```

### Toast Variants

| Variant | Color | Use Case |
|---------|-------|----------|
| `success` | Green | Successful operations |
| `error` | Red | Errors and failures |
| `info` | Blue | Informational messages |
| `warning` | Amber | Warnings and cautions |

### Customization

**Change default duration:**

Edit [web/src/lib/utils/constants.ts](../web/src/lib/utils/constants.ts):
```typescript
export const TOAST_DURATION = 5000; // milliseconds
```

**Customize styling:**

Edit the `ToastContainer` component in [ToastContext.tsx](../web/src/contexts/ToastContext.tsx) to modify colors, spacing, or animations.

**Custom position:**

By default, toasts appear at the top-right. To change position, modify the container classes:

```tsx
// For bottom-right
<div className="fixed bottom-4 right-4 z-50 space-y-2">

// For top-center
<div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2">

// For bottom-left
<div className="fixed bottom-4 left-4 z-50 space-y-2">
```

### Integration with API Client

Use toasts to show API operation results:

```tsx
'use client';

import { useToast } from '@/contexts/ToastContext';
import { createUser } from '@/lib/api/users';

export default function UserForm() {
  const { showToast } = useToast();

  const handleSubmit = async (data: UserData) => {
    try {
      await createUser(data, 'current@user.com');
      showToast('User created successfully!', 'success');
    } catch (error) {
      showToast('Failed to create user. Please try again.', 'error');
    }
  };

  // Form implementation...
}
```

### Accessibility

Toasts include ARIA attributes for screen readers:
- `role="alert"` - Announces new toasts
- `aria-live="polite"` - Non-intrusive announcements
- Visible focus indicators for dismiss button

---

## Styling System

The template includes a comprehensive styling system built on Tailwind CSS 4.

### Tailwind CSS 4

**Configuration:** [web/postcss.config.mjs](../web/postcss.config.mjs)

Tailwind is integrated via PostCSS with the `@tailwindcss/postcss` plugin, following the latest Tailwind CSS 4 architecture.

**Features:**
- Utility-first CSS framework
- JIT (Just-In-Time) compilation
- Custom design system support
- Responsive design utilities
- Dark mode support (configurable)
- Animation utilities

### Global Styles

**Location:** [web/src/app/globals.css](../web/src/app/globals.css)

Global styles are defined using Tailwind's `@layer` directive:

```css
@layer base {
  :root {
    /* Custom CSS variables */
    --color-primary: 59 130 246;      /* blue-500 */
    --color-secondary: 139 92 246;    /* violet-500 */
    --radius: 0.5rem;
  }
}
```

**Using custom variables:**
```tsx
<div className="bg-[rgb(var(--color-primary))] rounded-[var(--radius)]">
  Themed content
</div>
```

### Custom Theme Variables

Define reusable design tokens:

```css
@layer base {
  :root {
    /* Colors (RGB format for opacity support) */
    --color-primary: 59 130 246;
    --color-primary-dark: 37 99 235;
    --color-success: 34 197 94;
    --color-error: 239 68 68;
    --color-warning: 245 158 11;

    /* Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;

    /* Typography */
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;

    /* Border radius */
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-full: 9999px;
  }
}
```

### Animation Utilities

Included animations for common UI patterns:

**Modal/Dialog animations:**
```css
@layer utilities {
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fadeIn 0.2s ease-out;
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }
}
```

**Toast animations:**
```css
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.toast-enter {
  animation: slideInRight 0.3s ease-out;
}

.toast-exit {
  animation: fadeOut 0.2s ease-out;
}
```

### Responsive Design

Tailwind provides responsive breakpoints:

```tsx
<div className="
  w-full          /* Mobile: full width */
  md:w-1/2        /* Tablet: half width */
  lg:w-1/3        /* Desktop: one-third width */
  xl:w-1/4        /* Large desktop: one-quarter width */
">
  Responsive content
</div>
```

**Default breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Reduced Motion Support

The template respects user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Dark Mode (Optional)

To enable dark mode, add the `dark:` variant:

```tsx
<div className="
  bg-white dark:bg-gray-900
  text-black dark:text-white
">
  Content that adapts to dark mode
</div>
```

**Configure dark mode in Tailwind:**

Add to your Tailwind config (if needed):
```javascript
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  // ...
}
```

---

## TypeScript Configuration

**Location:** [web/tsconfig.json](../web/tsconfig.json)

The project uses TypeScript in strict mode for maximum type safety.

### Key Features

- **Strict mode enabled** - All strict type checking options enabled
- **Path aliases** - `@/*` maps to `src/*` for clean imports
- **JSX support** - React 19 JSX transform (`react-jsx`)
- **ES2017 target** - Modern JavaScript features
- **Module resolution** - Bundler-style resolution for Next.js

### Path Aliases

Import from `src/` using the `@/` prefix:

```typescript
// Instead of relative paths
import { apiClient } from '../../lib/api/client';
import type { User } from '../../types/user';

// Use path aliases
import { apiClient } from '@/lib/api/client';
import type { User } from '@/types/user';
```

### Strict Mode

Strict mode catches common errors at compile time:

```typescript
// ✗ Error: Implicit any
function process(data) { }

// ✓ Correct: Explicit type
function process(data: unknown) { }

// ✗ Error: Possibly null
const name = user.name;

// ✓ Correct: Null check
const name = user?.name;

// ✗ Error: No return type
function getUser(id: string) {
  return fetch(`/users/${id}`);
}

// ✓ Correct: Explicit return type
function getUser(id: string): Promise<User> {
  return fetch(`/users/${id}`);
}
```

---

## Testing Infrastructure

**Configuration:**
- [web/vitest.config.ts](../web/vitest.config.ts) - Vitest configuration
- [web/vitest.setup.ts](../web/vitest.setup.ts) - Test setup file

The template includes a complete testing setup with Vitest and React Testing Library.

### Features

- **Vitest** - Modern testing framework
- **React Testing Library** - Component testing utilities
- **TypeScript support** - Test files in TypeScript
- **Path alias support** - Use `@/` in tests
- **Coverage reporting** - Built-in coverage analysis
- **Watch mode** - Re-run tests on file changes

### Test Scripts

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

### Test Organization

Tests are centralized in `src/__tests__/`:

```
src/__tests__/
├── integration/    # Integration tests (primary focus)
├── api/           # API endpoint tests
└── utils/         # Utility function tests
```

### Template Tests

The template includes example tests:

- [web/src/__tests__/integration/api-client.test.ts](../web/src/__tests__/integration/api-client.test.ts) - API client integration testing
- [web/src/__tests__/integration/page-rendering.test.tsx](../web/src/__tests__/integration/page-rendering.test.tsx) - Component + data fetching integration

### Testing Philosophy

The template emphasizes **integration tests** over unit tests:

- Test realistic user workflows
- Test components with their dependencies
- Test API integration with actual or test endpoints
- Strategic mocking only when necessary

See [DEVELOPMENT.md](DEVELOPMENT.md) and [CLAUDE.md](../CLAUDE.md) for comprehensive testing guidance.

---

## Development Environment

### Hot Module Replacement (HMR)

Next.js dev server includes:
- Fast refresh for React components
- Instant updates without full page reload
- State preservation during updates
- Error recovery

### Environment Variables

**Supported files:**
- `.env.local` - Local development (not committed)
- `.env.production` - Production environment (not committed)
- `.env.example` - Template for required variables (committed)

**Usage:**
```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8042
```

**Access in code:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

**Important:** Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

### Linting

**Configuration:** [web/eslint.config.mjs](../web/eslint.config.mjs)

ESLint is configured with Next.js recommended rules.

```bash
npm run lint        # Check for issues
npm run lint -- --fix  # Auto-fix issues
```

---

## Next.js App Router

The template uses Next.js 16 with the **App Router** (not Pages Router).

### Key Concepts

**File-based routing:**
- `app/page.tsx` → `/`
- `app/about/page.tsx` → `/about`
- `app/users/[id]/page.tsx` → `/users/:id`

**Layouts:**
- `app/layout.tsx` - Root layout (wraps all pages)
- `app/dashboard/layout.tsx` - Nested layout (wraps dashboard pages)

**Server Components by default:**
- Components are server-side by default
- Use `'use client'` directive for client components
- Server components can fetch data directly

**Data fetching:**
```tsx
// Server Component (default)
export default async function UsersPage() {
  const users = await getUsers();  // Direct async/await
  return <UserList users={users} />;
}

// Client Component
'use client';
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    getUsers().then(setUsers);
  }, []);
  return <UserList users={users} />;
}
```

### Benefits

- **Faster initial page loads** - Less JavaScript sent to browser
- **Better SEO** - Server-rendered content
- **Simplified data fetching** - Async components
- **Automatic code splitting** - Per-route bundles
- **Streaming and suspense** - Progressive rendering

---

## Production Build

The template is optimized for production deployment.

### Build Process

```bash
cd web
npm run build
```

**What happens:**
1. TypeScript type checking
2. Code compilation and bundling
3. Minification and tree shaking
4. Static page generation (where possible)
5. Image optimization
6. CSS optimization
7. Output to `.next/` directory

### Production Server

```bash
npm start
```

Starts optimized production server on port 3000.

### Performance Optimizations

- **Automatic code splitting** - Per-route bundles
- **Image optimization** - Use `next/image` component
- **Font optimization** - Automatic font loading
- **CSS optimization** - Minified and purged
- **Caching headers** - Static assets cached
- **Compression** - Gzip/Brotli support

---

## Summary

This template includes:

✅ **Production-ready API client** with type safety and error handling
✅ **Toast notification system** with multiple variants
✅ **Tailwind CSS 4** with custom theme support
✅ **TypeScript strict mode** for type safety
✅ **Testing infrastructure** with Vitest and React Testing Library
✅ **Next.js App Router** for modern React patterns
✅ **Development tools** (HMR, linting, logging)
✅ **Optimized builds** for production deployment

For customization and advanced usage, see:
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development workflows and best practices
- [API_INTEGRATION.md](API_INTEGRATION.md) - Comprehensive API integration guide
- [CUSTOMIZATION.md](CUSTOMIZATION.md) - How to customize the template
