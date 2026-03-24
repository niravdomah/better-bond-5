<!-- Source: .claude/agents/developer.md — keep in sync when agent process steps change -->

## IMPLEMENT Phase Process

1. **Read story + FRS**: Read the story file for acceptance criteria, the FRS for spec requirements, and the test file for failing tests. **If the FRS requires a different approach than what template code provides (e.g., BFF auth instead of NextAuth), replace the template code — do not extend it.**
2. **Implement code**: Make the failing tests pass. Follow project patterns from CLAUDE.md (App Router, Shadcn UI, API client, path aliases)
3. **Do NOT write new tests** — tests already exist from WRITE-TESTS phase
4. **Run quality gates** (all must exit 0):
   - `cd web && npm test` — all tests pass
   - `npm run test:quality` — zero anti-patterns
   - `npm run lint` — zero errors/warnings
   - `npm run build` — successful build
5. **Fix any failures** before proceeding — no rationalizations
6. **Transition to QA**:
   ```bash
   node .claude/scripts/transition-phase.js --current --story M --to QA --verify-output
   ```

## What Happens Next
- QA phase: code-reviewer agent reviews code, runs quality gates, presents manual verification checklist
- After manual verification passes → commit & push → mandatory /clear + /continue
- Then next story's REALIGN (or next epic's STORIES if last story)

## BFF Auth Implementation Guide

When `context.authMethod` is `"bff"` in the intake manifest (`generated-docs/context/intake-manifest.json`):

**What to use:**
- BFF endpoint URLs from `context.bffEndpoints` (login, userinfo, logout)
- `web/src/app/auth/authenticated/page.tsx` — post-login landing page (calls userinfo, redirects to original page)
- `web/src/app/auth/logged-out/page.tsx` — post-logout landing page

**What to replace:**
- `web/src/app/(protected)/layout.tsx` — replace `requireAuth()` (next-auth) with a server-side check against the BFF session cookie. If not authenticated, redirect to the BFF login endpoint (append `callbackUrl` pointing to `/auth/authenticated?callbackUrl=<original-page>`)
- `web/src/lib/auth/auth-server.ts` — replace next-auth `auth()` calls with BFF userinfo fetch (validate cookie server-side)
- `web/src/lib/auth/auth-client.ts` — replace next-auth client helpers with BFF-aware equivalents (signOut → redirect to BFF logout endpoint)

**What to remove (not needed with BFF):**
- `web/src/lib/auth/auth.ts` (next-auth init)
- `web/src/lib/auth/auth.config.ts` (next-auth config with demo users)
- `web/src/app/auth/signin/page.tsx` (frontend login form)
- `web/src/app/auth/signout/page.tsx` (frontend logout confirmation)
- `web/src/app/auth/signup/page.tsx` (frontend registration form)

**BFF auth flow:**
1. User visits protected page → server checks session cookie → no cookie → redirect to `bffEndpoints.login?callbackUrl=/auth/authenticated?callbackUrl=<original-page>`
2. Backend login → OIDC → backend sets cookie → redirects to `/auth/authenticated?callbackUrl=<original-page>`
3. Authenticated page calls `bffEndpoints.userinfo` (cookie sent automatically) → gets user details → redirects to original page
4. Logout: redirect to `bffEndpoints.logout` → backend clears cookie → redirects to `/auth/logged-out`
