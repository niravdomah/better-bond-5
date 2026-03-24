# API Integration Guide

This guide covers how to integrate with external REST APIs using the included API client.

## API Client Overview

The template includes a production-ready API client at [web/src/lib/api/client.ts](../web/src/lib/api/client.ts) that provides:

- **Type-safe requests and responses** - Full TypeScript support
- **Automatic error handling** - Built-in handling for common HTTP status codes
- **Development logging** - Request/response logging with sensitive data sanitization
- **Binary response support** - Handle file downloads
- **Query parameter handling** - Clean URL construction
- **Custom headers** - Including audit trail support via `LastChangedUser`

## Basic Usage

### Making Requests

The API client exports convenience methods for common HTTP verbs:

```typescript
import { get, post, put, del } from '@/lib/api/client';

// GET request
const users = await get<User[]>('/v1/users');

// POST request
const newUser = await post<User>('/v1/users', {
  name: 'John Doe',
  email: 'john@example.com'
}, 'CurrentUser');

// PUT request
const updated = await put<User>(`/v1/users/${id}`, {
  name: 'Jane Doe'
}, 'CurrentUser');

// DELETE request
await del(`/v1/users/${id}`, 'CurrentUser');
```

### Type Safety

Always provide a type parameter for type-safe responses:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

// TypeScript knows 'users' is User[]
const users = await get<User[]>('/v1/users');

// TypeScript knows 'user' is User
const user = await get<User>(`/v1/users/${id}`);

// Access properties with full type safety
console.log(users[0].name);  // ✓ Type-safe
console.log(users[0].invalid);  // ✗ TypeScript error
```

## API Client Methods

### GET Requests

```typescript
get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>
```

**Examples:**

```typescript
// Simple GET
const users = await get<User[]>('/v1/users');

// GET with query parameters
const filteredUsers = await get<User[]>('/v1/users', {
  params: {
    role: 'admin',
    status: 'active',
    limit: '10'
  }
});
// Fetches: /v1/users?role=admin&status=active&limit=10

// GET with custom headers
const data = await get<Data>('/v1/data', {
  headers: {
    'X-Request-ID': requestId
  }
});
```

### POST Requests

```typescript
post<T>(
  endpoint: string,
  body?: unknown,
  lastChangedUser?: string
): Promise<T>
```

**Examples:**

```typescript
// POST with JSON body
const newUser = await post<User>('/v1/users', {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
}, 'admin@example.com');

// POST without body
const result = await post<Result>('/v1/actions/trigger');

// POST with file upload (FormData)
const formData = new FormData();
formData.append('file', fileBlob);
formData.append('description', 'My file');

const uploaded = await post<UploadResult>('/v1/upload', formData, 'user@example.com');
```

### PUT Requests

```typescript
put<T>(
  endpoint: string,
  body?: unknown,
  lastChangedUser?: string
): Promise<T>
```

**Examples:**

```typescript
// Full update
const updated = await put<User>(`/v1/users/${id}`, {
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'admin'
}, 'system@example.com');

// Partial update
const patched = await put<User>(`/v1/users/${id}`, {
  status: 'inactive'
}, 'admin@example.com');
```

### DELETE Requests

```typescript
del<T>(endpoint: string, lastChangedUser?: string): Promise<T>
```

**Examples:**

```typescript
// DELETE with no response body
await del(`/v1/users/${id}`, 'admin@example.com');

// DELETE with response body
const result = await del<DeleteResult>(`/v1/users/${id}`, 'admin@example.com');
console.log(result.deletedCount);
```

## Advanced Features

### Query Parameters

Query parameters are automatically URL-encoded:

```typescript
const results = await get<SearchResult[]>('/v1/search', {
  params: {
    q: 'search term with spaces',
    category: 'books & media',
    minPrice: '10.50'
  }
});
// Fetches: /v1/search?q=search+term+with+spaces&category=books+%26+media&minPrice=10.50
```

### Custom Headers

Add custom headers per request:

```typescript
const data = await get<Data>('/v1/data', {
  headers: {
    'X-Request-ID': crypto.randomUUID(),
    'X-Client-Version': '1.0.0'
  }
});
```

Or globally modify the API client in [client.ts](../web/src/lib/api/client.ts):

```typescript
const response = await fetch(url, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': '1.0.0',  // Add global header
    ...options.headers,
  },
});
```

### Binary Responses (File Downloads)

Use `isBinaryResponse: true` for file downloads:

```typescript
const blob = await get<Blob>('/v1/reports/download', {
  params: { reportId: '123' },
  isBinaryResponse: true
});

// Create download link
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'report.pdf';
link.click();
window.URL.revokeObjectURL(url);
```

### Audit Trail Support

The `lastChangedUser` parameter adds a `LastChangedUser` header for audit logging:

```typescript
// The API receives LastChangedUser: "admin@example.com" header
await post<User>('/v1/users', userData, 'admin@example.com');
await put<User>(`/v1/users/${id}`, updates, 'admin@example.com');
await del(`/v1/users/${id}`, 'admin@example.com');
```

This is useful for tracking who made changes in backend logs.

## Error Handling

### Automatic Error Handling

The API client automatically handles common HTTP errors:

| Status Code | Behavior |
|------------|----------|
| 401 | Throws error: "Authentication required. Please log in." |
| 403 | Throws error: "You do not have permission to perform this action." |
| 404 | Throws error: "The requested resource was not found." |
| 500 | Throws error: "An internal server error occurred. Please try again later." |
| Other | Throws error: "Request failed: {status} {statusText}" |

### Custom Error Handling

Catch errors in your code for custom handling:

```typescript
try {
  const user = await get<User>(`/v1/users/${id}`);
  console.log('User loaded:', user);
} catch (error) {
  if (error instanceof Error) {
    // Handle specific error messages
    if (error.message.includes('not found')) {
      console.error('User does not exist');
      // Redirect to 404 page or show error message
    } else if (error.message.includes('Authentication required')) {
      // Redirect to login
      router.push('/login');
    } else {
      console.error('Failed to load user:', error.message);
    }
  }
}
```

### Modifying Error Behavior

Edit the `handleErrorResponse` function in [client.ts](../web/src/lib/api/client.ts):

```typescript
function handleErrorResponse(status: number, statusText: string): void {
  switch (status) {
    case 401:
      // Custom behavior: redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    case 403:
      throw new Error('Access denied');
    case 404:
      throw new Error('Not found');
    case 500:
      // Custom behavior: show toast notification
      showToast('Server error occurred', 'error');
      throw new Error('Server error');
    default:
      throw new Error(`Request failed: ${status} ${statusText}`);
  }
}
```

## Development Logging

### Automatic Logging

In development mode, all requests and responses are logged:

```
[API Request] GET /v1/users
[API Response] GET /v1/users (200 OK) - 145ms
Response data: [{ id: '1', name: 'John' }, ...]
```

### Sensitive Data Sanitization

The following fields are automatically sanitized from logs:
- `password`
- `token`
- `apiKey`
- `secret`
- `creditCard`
- `ssn`

```typescript
// Request body
{
  username: 'john',
  password: 'secret123'  // Will be logged as '[REDACTED]'
}
```

### Disable Logging

Logging is only enabled in development. To disable it entirely, modify [client.ts](../web/src/lib/api/client.ts):

```typescript
const isDevelopment = false;  // Change this line
```

## Organizing API Code

### Resource-Based Organization

Create separate files for each API resource in `/web/src/lib/api/`:

```
lib/api/
├── client.ts       # API client (DO NOT MODIFY the core logic)
├── users.ts        # User endpoints
├── products.ts     # Product endpoints
├── orders.ts       # Order endpoints
└── auth.ts         # Authentication endpoints
```

### Example: User API Module

Create [web/src/lib/api/users.ts](../web/src/lib/api/users.ts):

```typescript
import { get, post, put, del } from './client';
import type { User, CreateUserData, UpdateUserData } from '@/types/user';

// List all users
export const getUsers = (params?: { role?: string; status?: string }) =>
  get<User[]>('/v1/users', { params });

// Get single user
export const getUser = (id: string) =>
  get<User>(`/v1/users/${id}`);

// Create user
export const createUser = (data: CreateUserData, currentUser: string) =>
  post<User>('/v1/users', data, currentUser);

// Update user
export const updateUser = (id: string, data: UpdateUserData, currentUser: string) =>
  put<User>(`/v1/users/${id}`, data, currentUser);

// Delete user
export const deleteUser = (id: string, currentUser: string) =>
  del(`/v1/users/${id}`, currentUser);

// Custom endpoint: Activate user
export const activateUser = (id: string, currentUser: string) =>
  post<User>(`/v1/users/${id}/activate`, undefined, currentUser);

// Custom endpoint: Get user statistics
export const getUserStats = (id: string) =>
  get<UserStats>(`/v1/users/${id}/stats`);
```

### Example: Using API Modules in Components

```tsx
// app/users/page.tsx
import { getUsers } from '@/lib/api/users';

export default async function UsersPage() {
  const users = await getUsers({ status: 'active' });

  return (
    <div>
      <h1>Active Users</h1>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

```tsx
// components/UserForm.tsx
'use client';

import { useState } from 'react';
import { createUser } from '@/lib/api/users';
import { useRouter } from 'next/navigation';

export default function UserForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createUser({ name, email }, 'admin@example.com');
      router.push('/users');
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <button type="submit">Create User</button>
    </form>
  );
}
```

## Type Definitions

### Define API Response Types

Create types for all API responses in `/web/src/types/`:

```typescript
// types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  role?: 'admin' | 'user' | 'guest';
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: 'admin' | 'user' | 'guest';
  status?: 'active' | 'inactive';
}

export interface UserStats {
  totalLogins: number;
  lastLoginAt: string;
  actionsPerformed: number;
}
```

### Use Types Consistently

```typescript
// Good: Explicit types
const user = await get<User>(`/v1/users/${id}`);
const users = await get<User[]>('/v1/users');

// Bad: No type annotation
const user = await get(`/v1/users/${id}`);  // Type is 'unknown'
```

## Common Patterns

### Pagination

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const getUsersPaginated = (page: number = 1, pageSize: number = 10) =>
  get<PaginatedResponse<User>>('/v1/users', {
    params: {
      page: String(page),
      pageSize: String(pageSize)
    }
  });

// Usage
const response = await getUsersPaginated(2, 20);
console.log(`Showing ${response.data.length} of ${response.total} users`);
```

### Search and Filtering

```typescript
interface SearchParams {
  q?: string;           // Search query
  category?: string;    // Filter by category
  minPrice?: number;    // Filter by minimum price
  maxPrice?: number;    // Filter by maximum price
  sortBy?: string;      // Sort field
  sortOrder?: 'asc' | 'desc';
}

export const searchProducts = (params: SearchParams) => {
  // Convert numbers to strings for query params
  const queryParams: Record<string, string> = {};
  if (params.q) queryParams.q = params.q;
  if (params.category) queryParams.category = params.category;
  if (params.minPrice) queryParams.minPrice = String(params.minPrice);
  if (params.maxPrice) queryParams.maxPrice = String(params.maxPrice);
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortOrder) queryParams.sortOrder = params.sortOrder;

  return get<Product[]>('/v1/products/search', { params: queryParams });
};

// Usage
const products = await searchProducts({
  q: 'laptop',
  category: 'electronics',
  minPrice: 500,
  maxPrice: 2000,
  sortBy: 'price',
  sortOrder: 'asc'
});
```

### Batch Operations

```typescript
export const batchDeleteUsers = async (userIds: string[], currentUser: string) => {
  return post<{ deletedCount: number }>('/v1/users/batch-delete', {
    userIds
  }, currentUser);
};

// Usage
const result = await batchDeleteUsers(['id1', 'id2', 'id3'], 'admin@example.com');
console.log(`Deleted ${result.deletedCount} users`);
```

### Optimistic Updates

```typescript
'use client';

import { useState } from 'react';
import { updateUser } from '@/lib/api/users';
import type { User } from '@/types/user';

export default function UserToggle({ user }: { user: User }) {
  const [localUser, setLocalUser] = useState(user);
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleStatus = async () => {
    // Optimistic update
    const newStatus = localUser.status === 'active' ? 'inactive' : 'active';
    setLocalUser({ ...localUser, status: newStatus });
    setIsUpdating(true);

    try {
      // Send API request
      const updated = await updateUser(
        user.id,
        { status: newStatus },
        'current@user.com'
      );
      // Update with server response
      setLocalUser(updated);
    } catch (error) {
      // Revert on error
      setLocalUser(user);
      console.error('Failed to update user:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      onClick={toggleStatus}
      disabled={isUpdating}
      className={localUser.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}
    >
      {localUser.status === 'active' ? 'Active' : 'Inactive'}
    </button>
  );
}
```

### Polling

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getJobStatus } from '@/lib/api/jobs';
import type { JobStatus } from '@/types/job';

export default function JobStatusMonitor({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<JobStatus | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const jobStatus = await getJobStatus(jobId);
        setStatus(jobStatus);

        // Stop polling if job is complete
        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Failed to fetch job status:', error);
      }
    };

    // Poll every 2 seconds
    pollStatus();  // Initial fetch
    intervalId = setInterval(pollStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId]);

  if (!status) return <div>Loading...</div>;

  return (
    <div>
      <p>Status: {status.status}</p>
      <p>Progress: {status.progress}%</p>
    </div>
  );
}
```

## Testing API Integration

See [DEVELOPMENT.md](DEVELOPMENT.md) for comprehensive testing guidance.

Quick example:

```typescript
// __tests__/integration/api-users.test.ts
import { getUser, createUser } from '@/lib/api/users';

describe('User API Integration', () => {
  it('should create and fetch a user', async () => {
    // Create user
    const newUser = await createUser({
      name: 'Test User',
      email: 'test@example.com'
    }, 'system');

    expect(newUser).toHaveProperty('id');
    expect(newUser.name).toBe('Test User');

    // Fetch user
    const fetched = await getUser(newUser.id);
    expect(fetched.name).toBe('Test User');
  });
});
```

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Ensure your API server includes CORS headers
2. Check that `NEXT_PUBLIC_API_BASE_URL` is correct
3. Verify the API endpoint path is correct

### Type Errors

If TypeScript complains about response types:

1. Verify your type definitions match the actual API response
2. Log the response to see the actual structure: `console.log(response)`
3. Update your types to match the API contract

### 401/403 Errors

If you're getting authentication/authorization errors:

1. Check if you need to add authentication headers
2. Verify tokens are being included in requests
3. Check token expiration and refresh logic

### Request Not Reaching API

If requests aren't reaching your API:

1. Verify `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
2. Check network tab in browser dev tools
3. Verify API server is running
4. Check for typos in endpoint paths
