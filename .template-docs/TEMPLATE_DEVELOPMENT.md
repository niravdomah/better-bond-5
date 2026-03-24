# Template Development Guide

> **This file is for template maintainers only.**
> Users of this template can safely delete this file after creating their project.

---

## Table of Contents

- [Overview](#overview)
- [Template Architecture](#template-architecture)
- [Design Decisions](#design-decisions)
- [Maintenance Workflow](#maintenance-workflow)
- [Testing Changes](#testing-changes)

---

## Overview

This document contains guidance for maintaining and improving this Next.js template.

### What This Template Provides

A production-ready Next.js 16 template optimized for:
- AI-assisted development with Claude Code
- Rapid application development with Shadcn/ui
- Enterprise-grade authentication and authorization (NextAuth v5 + RBAC)
- Automated quality gates and code quality enforcement
- Integration testing with Vitest + React Testing Library
- External REST API integration pattern

---

## Template Architecture

### Core Principles

1. **AI-First Development** - Optimized for Claude Code with MCP integration
2. **Zero Configuration** - Works out of the box with sensible defaults
3. **Production Ready** - Enterprise features included (auth, RBAC, quality gates)
4. **Developer Experience** - Fast setup, clear documentation, automated tooling
5. **Best Practices** - TypeScript strict mode, ESLint, Prettier, pre-commit hooks

### Technology Stack

| Category          | Technology      | Version | Rationale                                      |
| ----------------- | --------------- | ------- | ---------------------------------------------- |
| Framework         | Next.js         | 16.x    | Latest stable with App Router                  |
| Language          | TypeScript      | 5.x     | Type safety, better IDE support                |
| Styling           | Tailwind CSS    | 4.x     | Utility-first, fast development                |
| UI Components     | Shadcn/ui       | Latest  | Unstyled, accessible, customizable             |
| Authentication    | NextAuth.js     | 5.x     | Industry standard, flexible providers          |
| Validation        | Zod             | 4.x     | Type-safe schema validation                    |
| Testing           | Vitest + RTL    | Latest  | Integration testing                            |
| Linting/Formatting| ESLint/Prettier | Latest  | Code quality and consistency                   |
| Git Hooks         | Husky           | 9.x     | Pre-commit quality gates                       |

### Directory Structure

```
├── web/                         # Next.js frontend
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── auth/            # Authentication pages
│   │   │   ├── (protected)/     # Protected route group
│   │   │   └── api/             # API routes
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn UI components
│   │   │   └── auth/            # Auth components
│   │   ├── lib/
│   │   │   ├── api/             # API client
│   │   │   ├── auth/            # Auth configuration
│   │   │   └── validation/      # Zod schemas
│   │   └── types/               # TypeScript type definitions
│   └── __tests__/               # Vitest integration tests
├── api/                         # OpenAPI specification
├── .github/                     # GitHub Actions CI/CD
├── .husky/                      # Git hooks (in web/)
└── .template-docs/              # Documentation
```

---

## Design Decisions

### 1. NextAuth.js v5

**Decision:** Use NextAuth.js v5 (Auth.js)

**Rationale:**
- Modern API with better TypeScript support
- Improved session handling
- Better integration with Next.js App Router
- Official recommendation from NextAuth team

### 2. In-Memory User Store

**Decision:** Use in-memory demo user store instead of database

**Rationale:**
- Zero configuration required
- Users can test auth immediately
- Clear examples of password hashing with bcryptjs
- Users will replace with their own database

### 3. Server Component Authentication

**Decision:** Use Server Components (layouts) for authentication instead of middleware

**Rationale:**
- **Security:** Follows Next.js 16 and Vercel's recommendations
- **Clearer separation:** Authentication logic lives with the routes it protects
- **Better DX:** Easier to understand and maintain
- **Type safety:** Full TypeScript support in Server Components

### 4. Vitest for Testing

**Decision:** Use Vitest + React Testing Library for testing

**Rationale:**
- Sandbox-friendly (no browser installation required)
- Faster test execution
- Better for integration testing patterns
- Native ESM support and Vite ecosystem compatibility

---

## Maintenance Workflow

### Regular Maintenance Checklist

Run this checklist monthly or before releases:

- [ ] Update all dependencies to latest versions
- [ ] Run `npm audit` and fix security vulnerabilities
- [ ] Test authentication flows
- [ ] Test all quality gates (pre-commit + CI/CD)
- [ ] Verify Vitest tests pass
- [ ] Check MCP server integration with Claude Code
- [ ] Review and update documentation

### Dependency Updates

```bash
cd web

# Check for outdated packages
npm outdated

# Update all dependencies to latest
npm update

# Test after updates
npm run build
npm run lint
npm test
```

---

## Testing Changes

### Testing Checklist

Before committing template changes:

- [ ] Run `npm run build` - Ensure production build succeeds
- [ ] Run `npm run lint` - Check for linting errors
- [ ] Run `npm run format:check` - Verify formatting
- [ ] Run `npm test` - Run all Vitest tests
- [ ] Test pre-commit hooks - Make a dummy commit
- [ ] Test authentication - Sign in with demo credentials
- [ ] Test RBAC - Access protected routes

### Manual Testing Workflow

```bash
cd web

# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Build and lint
npm run build
npm run lint
npm run format:check

# 3. Run tests
npm test

# 4. Test dev server
npm run dev
# Visit http://localhost:3000
# Test authentication flows
# Test role-based access
```

---

**Last Updated:** 2025-12-03
