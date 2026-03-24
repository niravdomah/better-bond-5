# Customization Guide

This guide covers how to customize the template for your specific project needs.

## Quick Customization Checklist

- [ ] Update project branding (title, description, favicon)
- [ ] Configure API base URL
- [ ] Customize color scheme and theme
- [ ] Add/remove features as needed
- [ ] Set up authentication (if required)
- [ ] Install shadcn/ui components
- [ ] Configure state management (if needed)

## Branding and Metadata

### Update Site Metadata

Edit [web/src/app/layout.tsx](../web/src/app/layout.tsx):

```typescript
export const metadata: Metadata = {
  title: "Your App Name",
  description: "Your app description",
};
```

### Replace Favicon

Replace the favicon at [web/src/app/favicon.ico](../web/src/app/favicon.ico) with your own icon file.

You can also add additional icons:

```typescript
// In layout.tsx
export const metadata: Metadata = {
  title: "Your App",
  description: "Description",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};
```

Place icon files in `/web/src/app/` or `/web/public/`.

### Update Color Scheme

Edit [web/src/app/globals.css](../web/src/app/globals.css) to customize your theme:

```css
@layer base {
  :root {
    /* Primary brand colors */
    --color-primary: 59 130 246; /* blue-500 */
    --color-primary-dark: 37 99 235; /* blue-600 */

    /* Secondary colors */
    --color-secondary: 139 92 246; /* violet-500 */

    /* Semantic colors */
    --color-success: 34 197 94; /* green-500 */
    --color-error: 239 68 68; /* red-500 */
    --color-warning: 245 158 11; /* amber-500 */
    --color-info: 59 130 246; /* blue-500 */

    /* Border radius */
    --radius: 0.5rem;
  }
}
```

Use these colors in components:

```tsx
<div className="bg-[rgb(var(--color-primary))]">Branded content</div>
```

## API Configuration

### Set API Base URL

The API base URL is configured via environment variables. The default is `http://localhost:8042`.

**For development** - Create `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8042
```

**For production** - Create `.env.production`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

You can also set it directly in [web/src/lib/utils/constants.ts](../web/src/lib/utils/constants.ts):

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8042";
```

### Customize Error Handling

Edit the `handleErrorResponse` function in [web/src/lib/api/client.ts](../web/src/lib/api/client.ts):

```typescript
function handleErrorResponse(status: number, statusText: string): void {
  switch (status) {
    case 401:
      // Redirect to login
      window.location.href = "/login";
      throw new Error("Authentication required");
    case 403:
      throw new Error("You do not have permission to perform this action");
    case 404:
      throw new Error("The requested resource was not found");
    case 500:
      throw new Error("An internal server error occurred");
    default:
      throw new Error(`Request failed: ${status} ${statusText}`);
  }
}
```

### Add Custom Headers

Modify the API client to include custom headers globally:

```typescript
// In client.ts, update the fetch call
const response = await fetch(url, {
  ...options,
  headers: {
    "Content-Type": "application/json",
    "X-Custom-Header": "value",
    ...options.headers,
  },
});
```

For per-request headers:

```typescript
const data = await get<User[]>("/v1/users", {
  headers: { "X-Request-ID": requestId },
});
```

## Adding Features

### Add a New Page

1. Create a new file in `/web/src/app/[page-name]/page.tsx`:

```tsx
export default function NewPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold">New Page</h1>
      <p>Page content here</p>
    </div>
  );
}
```

2. The page is automatically available at `/[page-name]`

### Add a New API Resource

1. Define types in `/web/src/types/resource.ts`:

```typescript
export interface Resource {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateResourceData {
  name: string;
}
```

2. Create API functions in `/web/src/lib/api/resources.ts`:

```typescript
import { get, post, put, del } from "./client";
import type { Resource, CreateResourceData } from "@/types/resource";

export const getResources = () => get<Resource[]>("/v1/resources");

export const getResource = (id: string) => get<Resource>(`/v1/resources/${id}`);

export const createResource = (data: CreateResourceData, user: string) =>
  post<Resource>("/v1/resources", data, user);

export const updateResource = (
  id: string,
  data: Partial<Resource>,
  user: string,
) => put<Resource>(`/v1/resources/${id}`, data, user);

export const deleteResource = (id: string, user: string) =>
  del(`/v1/resources/${id}`, user);
```

3. Use in components:

```tsx
import { getResources } from "@/lib/api/resources";

export default async function ResourcesPage() {
  const resources = await getResources();

  return (
    <div>
      {resources.map((resource) => (
        <div key={resource.id}>{resource.name}</div>
      ))}
    </div>
  );
}
```

### Add UI Components with shadcn/ui

shadcn/ui provides high-quality, accessible components that you can copy into your project.

**1. Initialize shadcn/ui:**

```bash
cd web
npx shadcn@latest init
```

Choose these options:

- Style: **Default**
- Base color: **Slate** (or your preference)
- CSS variables: **Yes**

**2. Add components as needed:**

```bash
# Common components
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add table
npx shadcn@latest add card
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
```

**3. Use components in your code:**

```tsx
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MyComponent() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        <p>Dialog content</p>
        <Button>Click me</Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Benefits:**

- Components are added to your codebase (not a dependency)
- Fully customizable and type-safe
- Accessible by default (WCAG compliant)
- Works seamlessly with Tailwind CSS and Shadcn UI

**Documentation:**

- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Installation Guide](https://ui.shadcn.com/docs/installation/next)

## Removing Features

### Remove Toast Notification System

If you don't need the built-in toast system:

1. **Remove the context:**
   Delete [web/src/contexts/ToastContext.tsx](../web/src/contexts/ToastContext.tsx)

2. **Remove the component:**
   Delete any toast-related components you're not using

3. **Update the layout:**
   Remove the ToastProvider from [web/src/app/layout.tsx](../web/src/app/layout.tsx):

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Remove <ToastProvider> wrapper */}
        {children}
      </body>
    </html>
  );
}
```

4. **Clean up constants:**
   Remove toast-related constants from [web/src/lib/utils/constants.ts](../web/src/lib/utils/constants.ts)

### Remove Unused Utilities

Review `/web/src/lib/utils/` and delete any utility files you're not using. Be sure to check for imports elsewhere in the codebase before deleting.

## Adding Authentication

### 1. Create Authentication Context

Create [web/src/contexts/AuthContext.tsx](../web/src/contexts/AuthContext.tsx):

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for stored session on mount
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Call your login API endpoint
    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const userData = await response.json();
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

### 2. Add Provider to Layout

Update [web/src/app/layout.tsx](../web/src/app/layout.tsx):

```tsx
import { AuthProvider } from "@/contexts/AuthContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

### 3. Update API Client for Auth

Modify [web/src/lib/api/client.ts](../web/src/lib/api/client.ts) to include auth token:

```typescript
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  // Get token from localStorage
  const token = localStorage.getItem("authToken");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Rest of implementation...
}
```

### 4. Create Login Page

Create [web/src/app/login/page.tsx](../web/src/app/login/page.tsx):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
        )}

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-2 border rounded"
          required
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full p-2 border rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Login
        </button>
      </form>
    </div>
  );
}
```

### 5. Protect Routes

Create a proxy to protect routes:

Create [web/src/proxy.ts](../web/src/proxy.ts):

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Check for authentication token
  const token = request.cookies.get("authToken");

  // If no token and accessing protected route, redirect to login
  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
```

## Adding State Management

### Option 1: React Context (Included)

The template already includes React Context. Add more contexts as needed:

```tsx
// contexts/ThemeContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

### Option 2: Zustand (Lightweight)

Install Zustand:

```bash
cd web
npm install zustand
```

Create a store:

```typescript
// lib/store/useUserStore.ts
import { create } from "zustand";

interface User {
  id: string;
  name: string;
}

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

Use in components:

```tsx
import { useUserStore } from "@/lib/store/useUserStore";

export default function Profile() {
  const { user, logout } = useUserStore();

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Option 3: Redux Toolkit (Enterprise)

For large applications with complex state:

```bash
cd web
npm install @reduxjs/toolkit react-redux
```

Follow the [Redux Toolkit documentation](https://redux-toolkit.js.org/tutorials/quick-start) for setup.

## Environment-Specific Configuration

### Development vs Production

Use environment variables for config that changes between environments:

```typescript
// lib/utils/config.ts
export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8042",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  enableLogging: process.env.NODE_ENV === "development",
};
```

### Feature Flags

Implement simple feature flags:

```typescript
// lib/utils/features.ts
export const features = {
  enableNewDashboard: process.env.NEXT_PUBLIC_FEATURE_NEW_DASHBOARD === 'true',
  enableAnalytics: process.env.NEXT_PUBLIC_FEATURE_ANALYTICS === 'true',
};

// Use in components
import { features } from '@/lib/utils/features';

export default function Dashboard() {
  if (features.enableNewDashboard) {
    return <NewDashboard />;
  }
  return <LegacyDashboard />;
}
```

Add to `.env.local`:

```env
NEXT_PUBLIC_FEATURE_NEW_DASHBOARD=true
NEXT_PUBLIC_FEATURE_ANALYTICS=false
```
