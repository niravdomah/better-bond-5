# Troubleshooting Guide

Common issues and their solutions.

---

## Setup Issues

### "Module not found" errors

**Symptoms:**
- Import errors after cloning
- Missing dependencies

**Solution (macOS/Linux):**
```bash
cd web

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next
npm run dev
```

**Solution (Windows PowerShell):**
```powershell
cd web

# Remove and reinstall
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install

# Clear Next.js cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

---

### "Port 3000 already in use"

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution (macOS/Linux):**
```bash
# Find and kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

**Solution (Windows PowerShell):**
```powershell
# Find and kill process on port 3000
npx kill-port 3000

# Or use different port
$env:PORT=3001; npm run dev
```

---

### `.env.local` not loading

**Checklist:**
- [ ] File named exactly `.env.local` (not `.env.local.txt`)
- [ ] File in `web/` directory (same level as `package.json`)
- [ ] Dev server restarted after creating file
- [ ] No syntax errors in file

---

## Authentication Issues

### "NEXTAUTH_SECRET is not set"

> **Note:** This should be auto-generated during `npm install`. If it's missing, try running `npm run setup:env` first.

**Solution (macOS/Linux):**
```bash
# Generate secret
openssl rand -base64 32

# Add to web/.env.local
echo "NEXTAUTH_SECRET=<generated-secret>" >> .env.local

# Restart server
npm run dev
```

**Solution (Windows PowerShell):**
```powershell
# Generate secret (copy the output)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to web/.env.local (replace <generated-secret> with the output above)
Add-Content .env.local "NEXTAUTH_SECRET=<generated-secret>"

# Restart server
npm run dev
```

---

### "CredentialsSignin" error

**Causes:**
- Incorrect email/password
- User not in `lib/auth/auth.config.ts`
- Password hash mismatch

**Solution:**
- Check user exists in `lib/auth/auth.config.ts`
- Verify password matches the demo passwords
- Check console for detailed error message

---

### Session not persisting

**Checklist:**
- [ ] `NEXTAUTH_SECRET` set in `.env.local`
- [ ] Cookies enabled in browser
- [ ] Not using incognito/private mode

---

## Build Issues

> These issues relate to **Gate 3: Code Quality**. See [Quality Gates documentation](Quality-Gates.md#gate-3-code-quality) for details.

### TypeScript errors during build

**Solution:**
```bash
# Check errors
npx tsc --noEmit

# Common fixes:
# - Add missing type annotations
# - Fix import paths
# - Update tsconfig.json if needed
```

---

### ESLint errors blocking build

**Solution:**
```bash
# Try auto-fix
npm run lint:fix

# If that doesn't work:
npm run lint

# Fix remaining issues manually
```

---

### Build succeeds locally but fails in CI

**Causes:**
- Environment variables missing in CI
- Different Node.js version
- Missing dependencies

**Solution:**
1. Check CI logs for specific error
2. Verify environment variables in deployment platform
3. Run `npm ci` locally to test clean install

---

## Test Issues

> These issues relate to **Gate 4: Testing**. See [Quality Gates documentation](Quality-Gates.md#gate-4-testing) for details.

### Tests fail locally

**Solution:**
```bash
# Run with verbose output
npm test -- --verbose

# Run specific test
npm test -- path/to/test.test.tsx

# Run in watch mode to debug
npm run test:watch
```

---

### Tests timeout

**Causes:**
- Slow network/API calls
- Component not rendering

**Solution:**
```typescript
// Increase timeout in test
vi.setConfig({ testTimeout: 30000 });

// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Loading')).not.toBeInTheDocument();
});
```

---

## Performance Issues

> For CI performance checks, see **Gate 5: Performance** in [Quality Gates documentation](Quality-Gates.md#gate-5-performance).

### Slow dev server

**Solution (macOS/Linux):**
```bash
# Clear cache
rm -rf .next

# Upgrade Node.js to latest LTS
node --version
```

**Solution (Windows PowerShell):**
```powershell
# Clear cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Check Node.js version
node --version
```

---

## Quality Gate Failures

> For detailed information about quality gates, see [Quality Gates documentation](Quality-Gates.md).

### Overview

Quality gate failures can occur at two stages:
1. **Pre-commit** (local): TypeScript, ESLint, Prettier
2. **Pull Request** (CI): All 5 gates run via GitHub Actions

### npm audit vulnerabilities (Gate 2: Security)

**Symptoms:**
```
found X vulnerabilities (Y moderate, Z high)
```

**Option 1: Fix automatically**
```bash
npm audit fix
```

**Option 2: Fix with breaking changes (use cautiously)**
```bash
npm audit fix --force
```

**Option 3: Update specific package**
```bash
npm update <package-name>

# Or install latest version
npm install <package-name>@latest
```

**Option 4: Document acceptable risk**

If a vulnerability cannot be fixed (e.g., dev dependency only, no exploit path):

1. Review the vulnerability details: `npm audit`
2. Verify it doesn't affect production code
3. Document the decision in the PR description
4. Create a tracking issue for future resolution

**When to suppress:**
- Dev-only dependencies with no production impact
- Vulnerabilities with no known exploit in your context
- Waiting for upstream fix (track in issue)

**Never suppress:**
- High/critical vulnerabilities in production dependencies
- Vulnerabilities with known exploits
- Anything affecting user data or authentication

### Lighthouse score below threshold (Gate 5: Performance)

**Symptoms:**
```
Lighthouse CI assertion failed: categories:performance (0.72 < 0.8)
```

**Performance Score (< 80%)**

Quick wins:
```bash
# Analyze bundle size
npm run build
# Check .next/analyze if bundle analyzer is configured
```

Common fixes:
- Add `loading="lazy"` to below-fold images
- Use `next/image` for automatic optimization
- Implement code splitting with `dynamic()` imports
- Remove unused dependencies
- Defer non-critical JavaScript

**Accessibility Score (< 90%)**

Common fixes:
- Add `alt` attributes to all images
- Ensure proper heading hierarchy (h1 → h2 → h3)
- Add ARIA labels to interactive elements
- Ensure sufficient color contrast (4.5:1 for text)
- Add `<label>` elements to form inputs

**Best Practices Score (< 80%)**

Common fixes:
- Use HTTPS for all resources
- Avoid `document.write()`
- Ensure no browser errors in console
- Use secure cookies (HttpOnly, Secure, SameSite)
- Avoid deprecated APIs

**Running Lighthouse Locally**
```bash
# Build and start production server
npm run build && npm start

# In another terminal, run Lighthouse
npx lhci autorun

# Or use Chrome DevTools
# 1. Open DevTools → Lighthouse tab
# 2. Select categories and run audit
```

### Handling unreliable checks (Flaky Tests, False Positives)

**Flaky Tests (Gate 4: Testing)**

Symptoms:
- Test passes locally but fails in CI
- Test fails intermittently with same code
- Test depends on timing or external services

Immediate fixes:
```typescript
// Add retry for flaky assertions
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
}, { timeout: 5000 });

// Mock external dependencies
vi.mock('@/lib/api/client', () => ({
  get: vi.fn().mockResolvedValue({ data: mockData })
}));
```

Long-term fixes:
- Isolate tests from external dependencies
- Use deterministic data (not random/time-based)
- Add proper async handling with `waitFor`
- Consider marking known flaky tests with `.skip` temporarily

**False Positive Security Warnings (Gate 2: Security)**

Symptoms:
- Security scanner flags legitimate code
- TruffleHog detects test credentials or examples
- Hardcoded secrets regex matches non-secrets

Solutions:
1. **Test credentials**: Use obviously fake values (`test@example.com`, `password123-test`)
2. **Example API keys**: Prefix with `EXAMPLE_` or use placeholder format
3. **Documentation**: Add inline comments explaining why the pattern is safe
4. **Exclude files**: Update scanner config to exclude test/example files

**Unreliable Lighthouse Scores (Gate 5: Performance)**

Symptoms:
- Scores vary between runs
- CI environment differs from local

Solutions:
- Lighthouse runs 3 times and averages (configured in `lighthouserc.js`)
- If still flaky, check for:
  - Third-party scripts loading inconsistently
  - Network-dependent resources
  - Animations affecting metrics
- Re-run the check if failure seems anomalous

**When to Request Manual Override**

If automated checks are genuinely incorrect:
1. Document the issue clearly in PR description
2. Explain why the check is wrong (not just inconvenient)
3. Create a tracking issue to fix the check
4. Request reviewer approval with full context

---

## Git Issues

> Pre-commit hooks enforce **Gate 3: Code Quality** locally. See [Quality Gates documentation](Quality-Gates.md#when-gates-run) for the full workflow.

### Pre-commit hook failing

**Solution:**
```bash
# See what's failing
git commit -m "test"

# Fix issues:
npm run lint:fix
npm run format

# If emergency, bypass (not recommended):
git commit --no-verify -m "Emergency fix"
```

---

### Merge conflicts in package-lock.json

**Solution:**
```bash
# Accept one side, then regenerate
git checkout --theirs package-lock.json
npm install

# Or accept yours
git checkout --ours package-lock.json
npm install
```

---

## Getting Help

### Check Logs

```bash
# Next.js dev logs
npm run dev

# Next.js build logs
npm run build

# Test logs
npm test -- --verbose
```

### Ask Claude Code

In Claude Code chat:
```
I'm getting this error: [paste error]
What's wrong and how do I fix it?
```

---

## Emergency Procedures

### Complete Reset

**macOS/Linux:**
```bash
cd web

# Nuclear option: start fresh
rm -rf node_modules .next package-lock.json
npm install
npm run dev
```

**Windows PowerShell:**
```powershell
cd web

# Nuclear option: start fresh
Remove-Item -Recurse -Force node_modules, .next, package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

---

**Still stuck?** Ask Claude Code - it has access to all documentation and can help debug!
