# Quality Gate Enforcement Policy

## Core Principle

Quality gates are **objective, automated checks**. They either **pass** or **fail**. There are **NO exceptions, caveats, or conditional passes**.

---

## Gate Definitions

### Gate 1: Functional Completeness
**Type:** Manual verification
**Pass Criteria:** User confirms feature works as specified

### Gate 2: Security
**Type:** Automated
**Commands:**
- `npm audit`

**Pass Criteria:**
- 0 high or critical vulnerabilities
- No hardcoded secrets

### Gate 3: Code Quality
**Type:** Automated
**Commands:**
- `npm run format:check` (Prettier)
- `npx tsc --noEmit` (TypeScript)
- `npm run lint` (ESLint)
- `npm run build` (Build)

**Pass Criteria:**

| Check | Pass | Fail |
|-------|------|------|
| Prettier | Exit code 0 (all files formatted) | 1+ unformatted files |
| TypeScript | Exit code 0 | Any non-zero exit code |
| ESLint | 0 errors (warnings OK) | 1+ errors |
| Build | Successful | Build fails |

**NO EXCEPTIONS** for:
- "Expected errors from TDD"
- "Future story test files"
- "Will be fixed later"

### Gate 4: Testing
**Type:** Automated
**Commands:**
- `npm test`

**Pass Criteria:**
- All tests pass (0 failures)
- Coverage ≥ 80% (if configured)

### Gate 5: Performance
**Type:** Manual verification
**Pass Criteria:** User confirms reasonable performance

---

## Reporting Results

### ✅ Correct Reporting

```markdown
## Gate 3: Code Quality ❌ FAIL

**Automated Checks:**
- TypeScript: 30 errors
- ESLint: 3 errors, 15 warnings
- Build: ✅ Success

**Why it failed:**
Test files for Stories 2-6 reference components that don't exist yet (TDD workflow).

**Options to proceed:**
1. **Continue to IMPLEMENT phase** - These failures are expected; implementation follows immediately
2. **Investigate** - If errors seem unexpected, let me check for real issues

Which approach would you prefer?
```

### ❌ Incorrect Reporting (NEVER DO THIS)

```markdown
## Gate 3: Code Quality ✅ PASS

TypeScript has errors but they're expected from TDD, so this passes.
```

```markdown
## Gate 3: Code Quality ⚠️ CONDITIONAL PASS

Story 1 code itself is clean, so we can proceed.
```

```markdown
## Gate 3: Code Quality ✅ PASS with notes

There are errors in future story tests but that's acceptable.
```

**Why these are wrong:**
- They report "PASS" when the check **actually failed** (non-zero exit code)
- They make the decision for the user instead of presenting options
- They rationalize failures as acceptable without user input

---

## TDD Workflow and Quality Gates

### Per-Epic Test Generation

The TDD workflow generates tests **one epic at a time**, immediately before implementing that epic:

```
DESIGN (once) → PLAN → [TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA] per epic
```

**How it works:**
1. **PLAN**: Feature-planner creates stories for the current epic only
2. **WRITE-TESTS**: Test-generator creates tests for the current epic only
3. **IMPLEMENT**: Developer implements code to make tests pass
4. **QA**: Code review and quality gates run
5. **Repeat**: Return to PLAN for next epic's stories

**Why this approach:**
- ✅ Tests are written immediately before implementation (true TDD)
- ✅ Quality gates always pass (no failing tests from future epics)
- ✅ CI/CD friendly - no skipped tests needed
- ✅ Clear pass/fail status at all times

### During WRITE-TESTS Phase

When tests are first generated for an epic:
- Tests WILL fail (imports don't exist yet) - this is expected TDD behavior
- Tests from PREVIOUS epics should still pass
- The IMPLEMENT phase follows immediately, so brief test failures are acceptable
- After IMPLEMENT completes, ALL tests must pass before QA

**Agents MUST NOT:**
- Generate tests for ALL epics upfront
- Use `.skip()` for any reason — tests must pass or fail, never be skipped
- Report failed gates as "conditional passes"

---

## Agent Responsibilities

### When Running Quality Gates

1. **Run all checks** - Don't skip any
2. **Report facts** - Exit codes, error counts, actual results
3. **Be binary** - Each gate either passes or fails
4. **Present options** - When gates fail, show remediation choices
5. **Let user decide** - Don't make the decision to proceed despite failures
6. **Verify FRS compliance** - During code review (Gate 1), check that implementation matches FRS requirements, not just template patterns. Flag cases where template code was extended instead of replaced when the FRS requires a different approach.

### What Agents MUST Say

When Gate 3 fails during WRITE-TESTS phase (before IMPLEMENT):

```markdown
Gate 3: Code Quality ❌ FAIL

The automated checks found:
- TypeScript: 30 errors in test files for this epic
- ESLint: 3 errors in test files
- Build: ✅ Successful

These errors are expected in TDD - tests reference components that will be created in the IMPLEMENT phase.

**Note:** This is normal during the WRITE-TESTS → IMPLEMENT transition. The IMPLEMENT phase follows immediately to make these tests pass.

Proceeding to IMPLEMENT phase.
```

### What Agents MUST NOT Say

❌ "Gate 3 passes because Story 1 code is clean"
❌ "Conditional pass - errors are expected"
❌ "PASS with notes"
❌ "The errors don't count because TDD"

---

## Examples

### Example 1: All Gates Pass

```markdown
# Quality Gate Report ✅

## Gate 1: Functional ✅
Manual testing confirmed

## Gate 2: Security ✅
npm audit: 0 vulnerabilities

## Gate 3: Code Quality ✅
- TypeScript: 0 errors
- ESLint: 0 errors
- Build: Success

## Gate 4: Testing ✅
Tests: 15 passed, 0 failed

## Gate 5: Performance ✅
Verified by user

**Status: Ready to Commit**
```

### Example 2: Gate 3 Fails During WRITE-TESTS Phase (Expected)

```markdown
# Quality Gate Report (WRITE-TESTS Phase)

## Gate 3: Code Quality ❌ FAIL (Expected)
- TypeScript: 30 errors (test files for this epic)
- ESLint: 3 errors (test files for this epic)
- Build: ✅ Success

**Cause:** Test files reference components that will be created in IMPLEMENT phase.

**This is expected TDD behavior.** The IMPLEMENT phase follows immediately.

**Next step:** Proceed to IMPLEMENT phase to make these tests pass.
```

### Example 3: Real TypeScript Error

```markdown
# Quality Gate Report ❌

## Gate 1: Functional ✅
Manual testing confirmed

## Gate 2: Security ✅
npm audit: 0 vulnerabilities

## Gate 3: Code Quality ❌ FAIL
- TypeScript: 1 error in `dashboard/page.tsx:42`
  - Error: Property 'foo' does not exist on type 'DashboardData'
- ESLint: 0 errors
- Build: ❌ Failed

**This is a REAL error that must be fixed before committing.**

## Gate 4: Testing ❌ FAIL
Tests: 14 passed, 1 failed
- Failed: "dashboard renders metrics correctly"

## Gate 5: Performance ⏳
Not yet verified

**Status: NOT Ready to Commit** (Gates 3 & 4 failed)

**Required fixes:**
1. Fix TypeScript error in `dashboard/page.tsx:42`
2. Fix failing test after code fix
3. Re-run quality gates

Would you like help fixing these issues?
```

---

## Summary

Quality gates are binary. They pass or they fail. When they fail, agents must:
1. Report the failure honestly
2. Explain why it failed
3. Present options to the user
4. Let the user decide next steps

**Never rationalize a failure as a pass.** That undermines the entire purpose of quality gates.
