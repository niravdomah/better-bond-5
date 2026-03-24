/**
 * Integration Test: RoleGate Component
 *
 * Tests for the RoleGate server component that conditionally renders
 * UI elements based on user role authorization.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Session } from 'next-auth';

type MockAuthFn = ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

// Mock next-auth before imports
vi.mock('next-auth', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  __esModule: true,
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { auth } from '@/lib/auth/auth';
import { UserRole } from '@/types/roles';
import { RoleGate } from '@/components/RoleGate';

// Helper to create mock sessions
function createMockSession(
  role: UserRole,
  overrides?: Partial<Session['user']>,
): Session {
  return {
    user: {
      id: '1',
      email: `${role.toLowerCase()}@example.com`,
      name: `${role} User`,
      role,
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('RoleGate Component', () => {
  const mockAuth = auth as unknown as MockAuthFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders children when authorized', () => {
    it('should render when user has exact required role', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.ADMIN));

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN],
        children: <div>Admin Panel</div>,
      });

      expect(result).toEqual(<div>Admin Panel</div>);
    });

    it('should render when user role is in allowedRoles list', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.POWER_USER));

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN, UserRole.POWER_USER],
        children: <div>Management Tools</div>,
      });

      expect(result).toEqual(<div>Management Tools</div>);
    });

    it('should render when user meets minimumRole requirement', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.ADMIN));

      const result = await RoleGate({
        minimumRole: UserRole.POWER_USER,
        children: <div>Advanced Features</div>,
      });

      expect(result).toEqual(<div>Advanced Features</div>);
    });

    it('should render for any authenticated user with requireAuth', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.READ_ONLY));

      const result = await RoleGate({
        requireAuth: true,
        children: <div>Authenticated Content</div>,
      });

      expect(result).toEqual(<div>Authenticated Content</div>);
    });

    it('should render when no role requirements specified', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.STANDARD_USER));

      const result = await RoleGate({
        children: <div>Default Content</div>,
      });

      expect(result).toEqual(<div>Default Content</div>);
    });
  });

  describe('hides children when unauthorized', () => {
    it('should return null when user lacks required role', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.READ_ONLY));

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN],
        children: <div>Admin Panel</div>,
      });

      expect(result).toBeNull();
    });

    it('should return null when user does not meet minimumRole', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.READ_ONLY));

      const result = await RoleGate({
        minimumRole: UserRole.POWER_USER,
        children: <div>Advanced Features</div>,
      });

      expect(result).toBeNull();
    });

    it('should return null for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await RoleGate({
        allowedRoles: [UserRole.STANDARD_USER],
        children: <div>User Content</div>,
      });

      expect(result).toBeNull();
    });

    it('should return null when session has no user object', async () => {
      mockAuth.mockResolvedValue({
        user: undefined as unknown as Session['user'],
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN],
        children: <div>Admin Panel</div>,
      });

      expect(result).toBeNull();
    });
  });

  describe('fallback content', () => {
    it('should show fallback when user lacks required role', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.READ_ONLY));
      const fallback = <div>Access Denied</div>;

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN],
        children: <div>Admin Panel</div>,
        fallback,
      });

      expect(result).toEqual(fallback);
    });

    it('should show fallback for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);
      const fallback = <p>Please log in</p>;

      const result = await RoleGate({
        requireAuth: true,
        children: <div>Dashboard</div>,
        fallback,
      });

      expect(result).toEqual(fallback);
    });

    it('should render children (not fallback) when authorized', async () => {
      mockAuth.mockResolvedValue(createMockSession(UserRole.ADMIN));
      const children = <div>Admin Panel</div>;
      const fallback = <div>Access Denied</div>;

      const result = await RoleGate({
        allowedRoles: [UserRole.ADMIN],
        children,
        fallback,
      });

      expect(result).toEqual(children);
    });
  });
});
