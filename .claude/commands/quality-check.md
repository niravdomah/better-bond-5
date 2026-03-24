---
description: Run all 5 quality gates to verify code is ready to commit
model: haiku
---

You are helping a developer validate that their code passes all quality gates before committing and pushing to main.

## Quality Gates Overview

There are 5 quality gates that must pass:

1. **Gate 1 - Functional**: Feature works as expected (manual testing)
2. **Gate 2 - Security**: No vulnerabilities, no hardcoded secrets
3. **Gate 3 - Code Quality**: TypeScript compiles, ESLint passes, builds successfully
4. **Gate 4 - Testing**: Vitest tests written and passing
5. **Gate 5 - Performance**: Page loads reasonably fast (optional)

## Step 1: Run Automated Quality Gates

Run the quality gates script with auto-fix enabled:

```bash
node .claude/scripts/quality-gates.js --auto-fix
```

This script:
- Runs auto-fixes first (`npm run format`, `npm run lint:fix`, `npm audit fix`)
- Gate 2: Runs `npm audit` and `security-validator.js`
- Gate 3: Runs Prettier, TypeScript, ESLint, and build checks
- Gate 4: Runs Vitest and `test-quality-validator.js`
- Gate 5: Runs Lighthouse (if configured, otherwise skipped)

## Step 2: Review Results

The script outputs a summary showing pass/fail for each gate:

```
═══ Summary ═══

  Gate 2 security: ✓ PASS
  Gate 3 codeQuality: ✓ PASS
  Gate 4 testing: ✓ PASS
  Gate 5 performance: ○ SKIP

═══ ALL GATES PASSED ═══
```

## Step 3: Manual Verification (Gate 1)

After automated gates pass, ask the user about manual testing:

**Gate 1 - Functional:**
Ask: "Have you manually tested the feature? Does it work as expected?"

## Step 4: Handle Failures

If any gate fails:
- The script shows which gate failed and specific errors
- Provide fix suggestions based on the errors
- Offer to help fix the issues
- Re-run the script after fixes

### Common Fixes

| Issue | Fix |
|-------|-----|
| TypeScript error | Fix type issues in reported files |
| Prettier error | `npm run format` to auto-format |
| ESLint error | `npm run lint:fix` or fix manually |
| Build failure | Check error output, usually type/import issue |
| Test failure | Debug test, fix code or test |
| Security vulnerability | `npm audit fix` or update package |

## Step 5: Next Steps

If all gates pass:
- Suggest committing and pushing to main
- Offer to help with the commit
- Remind them that GitHub Actions will verify again

## Important Notes

- Be encouraging even if gates fail - failures are learning opportunities
- The script runs auto-fixes first, so many issues are resolved automatically
- Gate 5 (Performance) is optional and skips if Lighthouse isn't configured
- For JSON output (agent use), run with `--json` flag
