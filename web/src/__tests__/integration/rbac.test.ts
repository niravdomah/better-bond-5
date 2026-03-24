/**
 * Integration Test: RBAC (Role-Based Access Control)
 *
 * Tests the complete authorization flow through withRoleProtection,
 * verifying auth + role checking + validation work together correctly.
 */

import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock next-auth before imports
vi.mock('next-auth', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { UserRole } from '@/types/roles';
import { auth } from '@/lib/auth/auth';
import { withRoleProtection } from '@/lib/auth/auth-helpers';
import { validateRequest } from '@/lib/validation/schemas';
import { z } from 'zod';

type MockAuthFn = Mock<
  () => Promise<{ user: { id: string; role: UserRole } } | null>
>;

function createSession(role: UserRole) {
  return { user: { id: 'user-123', role } };
}

function createMockRequest(
  url = 'http://localhost:3000/api/test',
): NextRequest {
  return new NextRequest(url);
}

describe('RBAC Integration Tests', () => {
  const mockAuth = auth as unknown as MockAuthFn;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withRoleProtection API wrapper', () => {
    const successHandler = async () => NextResponse.json({ success: true });

    it('should return 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const protectedHandler = withRoleProtection(successHandler, {
        role: UserRole.ADMIN,
      });

      const response = await protectedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toContain('Unauthorized');
    });

    it('should return 403 when user lacks required exact role', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.STANDARD_USER));

      const protectedHandler = withRoleProtection(successHandler, {
        role: UserRole.ADMIN,
      });

      const response = await protectedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('Forbidden');
    });

    it('should return 403 when user does not meet minimum role requirement', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.STANDARD_USER));

      const protectedHandler = withRoleProtection(successHandler, {
        minimumRole: UserRole.POWER_USER,
      });

      const response = await protectedHandler(createMockRequest());

      expect(response.status).toBe(403);
    });

    it('should return 403 when user has none of the required roles', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.STANDARD_USER));

      const protectedHandler = withRoleProtection(successHandler, {
        roles: [UserRole.ADMIN, UserRole.POWER_USER],
      });

      const response = await protectedHandler(createMockRequest());

      expect(response.status).toBe(403);
    });

    it('should allow access when user has exact required role', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.ADMIN));

      const protectedHandler = withRoleProtection(successHandler, {
        role: UserRole.ADMIN,
      });

      const response = await protectedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should allow access when user meets minimum role requirement', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.ADMIN));

      const protectedHandler = withRoleProtection(successHandler, {
        minimumRole: UserRole.POWER_USER,
      });

      const response = await protectedHandler(createMockRequest());

      expect(response.status).toBe(200);
    });

    it('should allow access when user has any of the required roles', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.POWER_USER));

      const protectedHandler = withRoleProtection(successHandler, {
        roles: [UserRole.ADMIN, UserRole.POWER_USER],
      });

      const response = await protectedHandler(createMockRequest());

      expect(response.status).toBe(200);
    });
  });

  describe('Authorization + Validation integration', () => {
    const requestSchema = z.object({
      action: z.enum(['create', 'update', 'delete']),
      name: z.string().min(1).max(100),
    });

    it('should validate request body after authorization passes', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.ADMIN));

      const handlerWithValidation = withRoleProtection(
        async () => {
          // Simulate reading request body and validating
          const body = { action: 'create', name: 'Test Item' };
          const validation = validateRequest(requestSchema, body);

          if (!validation.success) {
            return NextResponse.json(
              { error: 'Validation failed', details: validation.errors },
              { status: 400 },
            );
          }

          return NextResponse.json({ success: true, data: validation.data });
        },
        { minimumRole: UserRole.POWER_USER },
      );

      const response = await handlerWithValidation(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.action).toBe('create');
      expect(body.data.name).toBe('Test Item');
    });

    it('should return 400 for invalid request body when authorized', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.ADMIN));

      const handlerWithValidation = withRoleProtection(
        async () => {
          const body = { action: 'invalid', name: '' }; // Invalid data
          const validation = validateRequest(requestSchema, body);

          if (!validation.success) {
            return NextResponse.json(
              { error: 'Validation failed', details: validation.errors },
              { status: 400 },
            );
          }

          return NextResponse.json({ success: true });
        },
        { minimumRole: UserRole.POWER_USER },
      );

      const response = await handlerWithValidation(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');
      expect(body.details.length).toBeGreaterThan(0);
    });

    it('should return 403 before validation when not authorized', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.READ_ONLY));

      let validationCalled = false;
      const handlerWithValidation = withRoleProtection(
        async () => {
          validationCalled = true;
          return NextResponse.json({ success: true });
        },
        { minimumRole: UserRole.POWER_USER },
      );

      const response = await handlerWithValidation(createMockRequest());

      expect(response.status).toBe(403);
      expect(validationCalled).toBe(false); // Handler never called
    });
  });

  describe('Error handling', () => {
    it('should return 500 when handler throws an error', async () => {
      mockAuth.mockResolvedValue(createSession(UserRole.ADMIN));

      const errorHandler = withRoleProtection(
        async () => {
          throw new Error('Something went wrong');
        },
        { role: UserRole.ADMIN },
      );

      const response = await errorHandler(createMockRequest());

      expect(response.status).toBe(500);
    });
  });
});
