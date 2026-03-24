# Quality Gates

This template implements automated quality gates to ensure code quality, security, and test coverage.

---

## Overview

| Gate | What It Checks | Auto % | Tools | Manual Review Required |
|------|----------------|--------|-------|------------------------|
| **1. Functional** | Features work as specified | 0% | — | UX validation, workflow testing, edge cases |
| **2. Security** | No vulnerabilities or secrets | 80% | npm audit, TruffleHog, security-validator.js | POPIA compliance review |
| **3. Code Quality** | TypeScript, ESLint, Prettier, build | 100% | Husky, ESLint, Prettier, TypeScript | None |
| **4. Testing** | All tests pass | 100% | Vitest, React Testing Library | None |
| **5. Performance** | Lighthouse scores meet thresholds | 70% | Lighthouse CI | Real device testing, slow network |

> **Note:** Automation supplements but does not replace human review. Even fully automated gates benefit from code review.

---

## When Gates Run

### Timeline Overview

```
Developer Workflow:

  Code Change → Pre-commit → Approval → Push to Main
       │            │            │
       │            │            │
       ▼            ▼            ▼
    (local)    Gate 2, 3, 4    Gate 1-5
               (automated)    (verified)
```

### Pre-commit (Local)

Runs **before** code is committed:

| Gate | Checks |
|------|--------|
| Gate 2: Security | Secrets detection (via lint-staged) |
| Gate 3: Code Quality | TypeScript, ESLint, Prettier |
| Gate 4: Testing | (Optional - can run `npm test` manually) |

**Blocking:** Commit is rejected if checks fail.

### Before Committing to Main

Verify **before pushing to main**:

| Gate | Checks |
|------|--------|
| Gate 1: Functional | Manual verification by user |
| Gate 2: Security | npm audit, TruffleHog, security-validator.js |
| Gate 3: Code Quality | TypeScript, ESLint, Prettier, build |
| Gate 4: Testing | Vitest tests pass, coverage |
| Gate 5: Performance | Manual verification (if applicable) |

**Blocking:** Do not push to main if any required checks fail.

### Manual Review (Human)

Required **before approving commits**:

| Gate | Manual Checks |
|------|---------------|
| Gate 1: Functional | UX validation, workflow testing, edge cases |
| Gate 2: Security | POPIA compliance review |
| Gate 5: Performance | Real device testing, slow network testing |

**Blocking:** User should not approve until manual checks are complete.

---

## Gate 1: Functional

### Purpose
Verify that features work as specified and meet user requirements.

### Automated Checks (0%)
- No automated functional testing configured
- Integration tests run as part of Gate 4 (Testing)

### Manual Review Required (100%)
- UX validation (design matches specifications)
- User workflow completeness
- Edge case handling
- Accessibility compliance
- Cross-browser compatibility

### How to Pass
```bash
# Run integration tests
npm test
```

**Manual testing is required to verify functional requirements.**

---

## Gate 2: Security

### Purpose
Prevent vulnerabilities and secrets from being committed.

### Automated Checks (80%)
- **npm audit**: Scans dependencies for known vulnerabilities
- **TruffleHog**: Scans for hardcoded secrets (API keys, tokens, passwords)
- **security-validator.js**: Validates security patterns (RBAC, input validation, XSS prevention, POPIA)
- **Hardcoded secrets regex**: Catches common secret patterns in code

### Manual Review Required (20%)
- **POPIA compliance**: Consent mechanisms, data retention policies, third-party sharing
- **Authentication flow review**: Session management, token handling
- **Authorization logic**: Role-based access control correctness

### How to Pass
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Run security validator
node .github/scripts/security-validator.js

# Check for secrets (manual review)
git diff | grep -E '(password|secret|api[_-]?key|token)'
```

### Security Validator Checks
The `security-validator.js` script validates:
- RBAC implementation in protected routes
- Input validation on user-facing forms
- XSS prevention in rendered content
- SQL injection prevention patterns
- Authentication configuration
- **POPIA: PII Logging** - Detects personal information in console.log/logger calls
- **POPIA: PII Field Handling** - Detects unencrypted PII in localStorage/cookies

**POPIA Environment Variables:**
```bash
# Set severity: error (blocks PR), warning (advisory), off (disabled)
SECURITY_POPIA_LOGGING_SEVERITY=warning   # Default: warning
SECURITY_POPIA_FIELDS_SEVERITY=warning    # Default: warning
```

**Pre-commit + GitHub Actions enforce automated security checks.**

---

## Gate 3: Code Quality

### Purpose
Maintain consistent code quality and catch errors early.

### Automated Checks (100%)
- **TypeScript**: Strict compilation with no errors (`tsc --noEmit`)
- **ESLint**: Code linting with Next.js rules
- **Prettier**: Consistent code formatting
- **Production build**: Verifies build succeeds (`npm run build`)

### Manual Review Required
None - this gate is fully automated.

### How to Pass
```bash
# TypeScript check
npx tsc --noEmit

# ESLint check
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code
npm run format

# Verify formatting
npm run format:check

# Test production build
npm run build
```

**Pre-commit hooks block commits that fail TypeScript or lint-staged checks.**

---

## Gate 4: Testing

### Purpose
Ensure all tests pass and coverage requirements are met before merging.

### Automated Checks (100%)
- **Vitest**: All unit and integration tests must pass
- **React Testing Library**: Component tests with user-centric queries
- **Coverage validation**: Minimum coverage thresholds enforced
- **Multi-version Node testing**: Tests run on Node 20 and Node 22 in CI

### Manual Review Required
None - this gate is fully automated.

### How to Pass
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- path/to/test.test.tsx
```

### Coverage Requirements
Coverage reports are generated and uploaded as artifacts in GitHub Actions. Review coverage trends to ensure new code is properly tested.

**All tests must pass before committing to main.**

---

## Gate 5: Performance

### Purpose
Ensure the application meets performance, accessibility, and best practices standards.

### Automated Checks (70%)
- **Lighthouse CI**: Automated performance audits
- **Performance score**: Minimum 80% required
- **Accessibility score**: Minimum 90% required
- **Best practices score**: Minimum 80% required

### Manual Review Required (30%)
- **Real device testing**: Mobile phones, tablets with varying capabilities
- **Slow network testing**: 3G, throttled connections
- **Different browsers**: Safari, Firefox, Edge compatibility
- **Memory and CPU profiling**: For complex interactions

### Lighthouse CI Thresholds
```javascript
// From lighthouserc.js
{
  'categories:performance': ['error', { minScore: 0.8 }],    // 80%
  'categories:accessibility': ['error', { minScore: 0.9 }],  // 90%
  'categories:best-practices': ['error', { minScore: 0.8 }]  // 80%
}
```

### How to Pass
```bash
# Build production version first
npm run build

# Start production server
npm start

# Run Lighthouse CI (in another terminal)
npx lhci autorun
```

### Performance Reports
Lighthouse reports can be generated locally. Review reports to identify optimization opportunities.

**Performance thresholds must be met before committing to main.**

---

## Manual Review Checklists

### Gate 1: Functional Review Checklist

Use this checklist when reviewing changes that add or modify features:

**UX Consistency**
- [ ] UI matches design specifications/mockups
- [ ] Consistent styling with existing components
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Loading states displayed appropriately
- [ ] Error states are user-friendly and actionable

**User Workflow Completeness**
- [ ] All user flows complete from start to finish
- [ ] Navigation is intuitive and logical
- [ ] Form submissions provide appropriate feedback
- [ ] Success/failure messages are clear
- [ ] User can recover from errors without data loss

**Edge Case Handling**
- [ ] Empty states handled gracefully
- [ ] Long text/content doesn't break layout
- [ ] Special characters handled correctly
- [ ] Concurrent user actions handled (if applicable)
- [ ] Offline/poor connectivity behavior tested

**Accessibility**
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus states are visible
- [ ] Screen reader compatibility (ARIA labels present)
- [ ] Color contrast meets WCAG standards
- [ ] Form inputs have associated labels

### Gate 2: POPIA Compliance Checklist

Use this checklist when reviewing changes that handle personal information.

> **Note:** Items marked with 🤖 are now partially automated by `security-validator.js`. Review automated findings and verify edge cases manually.

**PII Handling**
- [ ] Personal data collected only when necessary (data minimization)
- [ ] PII fields identified and documented (name, email, ID numbers, etc.)
- [ ] Sensitive data encrypted at rest and in transit
- [ ] 🤖 PII not logged or exposed in error messages *(automated: POPIA PII Logging check)*
- [ ] 🤖 Personal data not stored in localStorage/sessionStorage unencrypted *(automated: POPIA PII Field Handling check)*
- [ ] 🤖 SA ID numbers validated and masked when displayed *(automated: SA ID handling check)*

**Consent Mechanisms**
- [ ] Clear consent obtained before collecting personal data
- [ ] Consent is specific, informed, and freely given
- [ ] Users can withdraw consent easily
- [ ] Purpose of data collection clearly communicated
- [ ] Marketing/analytics consent separate from essential consent

**Data Retention**
- [ ] Data retention periods defined and documented
- [ ] Automatic deletion/anonymization after retention period
- [ ] No indefinite storage of personal data
- [ ] Backup data included in retention policies

**User Data Rights**
- [ ] Users can access their personal data (data portability)
- [ ] Users can request data correction
- [ ] Users can request data deletion (right to be forgotten)
- [ ] Data export available in portable format (JSON/CSV)
- [ ] Account deletion removes all associated PII

**Third-Party Data Sharing**
- [ ] Third-party data processors identified and documented
- [ ] Data processing agreements in place
- [ ] Cross-border data transfers comply with regulations
- [ ] Users informed of third-party data sharing

### Gate 5: Real Device Testing Checklist

Use this checklist for performance-critical changes or major releases:

**Mobile Device Testing**
- [ ] iPhone (Safari) - latest iOS version
- [ ] iPhone (Safari) - iOS version minus 1
- [ ] Android phone (Chrome) - latest Android version
- [ ] Android phone (Chrome) - mid-range device tested
- [ ] Touch interactions work correctly (tap, swipe, pinch)

**Tablet Testing**
- [ ] iPad (Safari) - landscape and portrait orientation
- [ ] Android tablet (Chrome) - if applicable to user base
- [ ] Layout adapts correctly to tablet screen sizes
- [ ] Touch targets are appropriately sized (min 44x44px)

**Network Condition Testing**
- [ ] Fast 3G simulation (DevTools throttling)
- [ ] Slow 3G simulation - app remains usable
- [ ] Offline mode - graceful degradation
- [ ] Connection recovery - app resumes correctly
- [ ] Large payload handling on slow connections

**Browser Compatibility**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] No console errors in any browser

**Performance Profiling**
- [ ] Memory usage stable (no leaks during navigation)
- [ ] CPU usage reasonable during interactions
- [ ] Animations run at 60fps
- [ ] Time to Interactive under 3 seconds
- [ ] No layout shifts after initial render (CLS < 0.1)

### When Manual Review is Required

Not all changes require full manual review checklists. Use this guide to determine the appropriate level of review:

**Full Manual Review Required**
- New features or major functionality changes
- Changes to authentication or authorization logic
- Any code handling personal/sensitive data
- UI redesigns or significant UX changes
- Performance-critical code paths
- Major dependency updates

**Partial Manual Review (Selected Checklists)**
- Bug fixes affecting user-facing features → Gate 1 (relevant sections only)
- Security-related bug fixes → Gate 2 checklist
- Performance optimizations → Gate 5 checklist

**Automated Review Sufficient**
- Documentation updates (no code changes)
- Minor code refactoring (no behavior change)
- Test additions or improvements
- Dependency patches (non-breaking)
- Code style/formatting fixes

**Always Required Regardless of Change Type**
- All automated checks must pass
- Commit message clearly explains the change

---

## Pre-Commit Hooks

Pre-commit hooks enforce Gates 2, 3, and 4 locally **before** code is committed:

1. TypeScript compilation check
2. lint-staged (ESLint + Prettier on staged files)
3. Secrets detection

**Blocking:** Commit is rejected if checks fail.

**Bypassing:** For emergencies only, use `git commit --no-verify`. See [Bypass Procedures](#bypass-procedures-for-emergencies) for requirements.

---

## GitHub Actions (CI/CD)

### On Push to Main

GitHub Actions can be configured to run the following checks:

1. **Install dependencies**
2. **TypeScript check** (`npx tsc --noEmit`)
3. **ESLint** (`npm run lint`)
4. **Prettier check** (`npm run format:check`)
5. **Build** (`npm run build`)
6. **Tests** (`npm test`)

---

## Running All Gates Locally

### Manual Check

```bash
cd web

# 1. Security
npm audit

# 2. Code Quality
npx tsc --noEmit
npm run lint
npm run format:check
npm run build

# 3. Testing
npm test
```

### Using Claude Code

```bash
# In Claude Code chat:
/quality-check
```

This runs all automated gates and generates a report.

---

## Fixing Common Issues

### TypeScript Errors

```bash
# See all errors
npx tsc --noEmit

# Common fixes:
# - Add type annotations
# - Fix type mismatches
# - Add missing return types
```

### ESLint Errors

```bash
# Auto-fix what's possible
npm run lint:fix

# Manual review remaining issues
npm run lint
```

### Build Failures

```bash
# Clear cache and rebuild
rm -rf .next
npm run build

# Check for:
# - Import errors
# - Missing dependencies
# - Type issues
```

### Test Failures

```bash
# Run specific test
npm test -- path/to/test.test.tsx

# Run with verbose output
npm test -- --verbose

# Run in watch mode for debugging
npm run test:watch
```

---

## Best Practices

### Do's

- **Run quality checks locally** before pushing
- **Fix issues immediately** (don't accumulate tech debt)
- **Write tests** for new features
- **Keep dependencies updated**
- **Review gate failures** in CI logs

### Don'ts

- **Don't bypass pre-commit hooks** habitually
- **Don't ignore TypeScript errors** with `@ts-ignore`
- **Don't skip writing tests**
- **Don't commit unformatted code**
- **Don't push failing code to main**

---

## Bypass Procedures for Emergencies

Quality gate bypasses should be rare exceptions, not regular practice. This section documents when bypasses are acceptable and the required follow-up actions.

### When Bypass is Acceptable

**Production Hotfixes (Gate 1, 3, 4, 5 only)**
- Critical bug affecting production users
- Revenue-impacting issues requiring immediate resolution
- Service outage or severe performance degradation
- Time-sensitive regulatory compliance fixes

**Conditions for Acceptable Bypass:**
- Issue is verified as critical/blocking
- Fix has been tested locally (at minimum)
- Senior developer or team lead has approved
- Bypass is documented with tracking issue

### When Bypass is NEVER Acceptable

**Gate 2: Security — NO EXCEPTIONS**

Security gate bypass is never acceptable because:
- Secrets committed to git history are extremely difficult to remove
- Vulnerabilities in dependencies can be exploited immediately after deploy
- POPIA/privacy violations carry legal and financial penalties
- Security issues compound—one bypass creates a false baseline

> **Note:** Even if you bypass pre-commit hooks locally with `--no-verify`, GitHub Actions (if configured) will still catch security issues. Security enforcement should be maintained—local bypass only delays the inevitable failure.

**Specific scenarios where security bypass is forbidden:**
- "The secret is only for testing" → Use environment variables
- "We'll rotate the key later" → Rotate first, then commit
- "The vulnerability doesn't affect us" → Document as acceptable risk, don't bypass
- "It's blocking deployment" → Fix the security issue first

**Other Never-Bypass Scenarios:**
- Bypassing to meet arbitrary deadlines
- Bypassing because "it works on my machine"
- Repeated bypasses for the same issue
- Bypassing without approval or documentation

### Bypass Decision Matrix

| Scenario | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 5 |
|----------|--------|--------|--------|--------|--------|
| Production outage | ⚠️ Maybe | ❌ Never | ⚠️ Maybe | ⚠️ Maybe | ⚠️ Maybe |
| Revenue-critical bug | ⚠️ Maybe | ❌ Never | ⚠️ Maybe | ⚠️ Maybe | ⚠️ Maybe |
| Deadline pressure | ❌ Never | ❌ Never | ❌ Never | ❌ Never | ❌ Never |
| Flaky test (known issue) | N/A | ❌ Never | N/A | ⚠️ Maybe | ⚠️ Maybe |
| Third-party service down | ⚠️ Maybe | ❌ Never | N/A | ⚠️ Maybe | ⚠️ Maybe |

**Legend:** ⚠️ Maybe = Requires approval + documentation | ❌ Never = No exceptions

### Pre-Commit Hook Bypass (`--no-verify`)

The `--no-verify` flag skips all [pre-commit hooks](#pre-commit-hooks) (Gates 2, 3, and 4).

```bash
# Skip pre-commit hooks (emergency only!)
git commit --no-verify -m "HOTFIX: [description of critical issue]"
```

**What Still Runs:**
- GitHub Actions checks on push (if configured)
- You should still run checks manually before pushing

**Required Follow-Up Actions:**

1. **Immediately after bypass commit:**
   ```bash
   # Create tracking issue or add to commit message
   git commit --amend -m "HOTFIX: [description]

   BYPASS: Pre-commit hooks skipped due to [reason]
   TRACKING: [issue number or 'to be created']
   APPROVED BY: [name of approver]"
   ```

2. **Within 1 hour:**
   - Create GitHub issue documenting the bypass
   - Tag issue with `bypass` and `tech-debt` labels
   - Assign to yourself

3. **Within 24 hours (next business day):**
   - Run all skipped checks locally and fix any issues
   - Create follow-up commit to address any problems found
   - Close tracking issue with reference to fix commit

**Issue Template for Bypass Tracking:**
```markdown
## Pre-Commit Bypass Record

**Date:** [date]
**Commit:** [commit hash]
**Bypassed by:** [your name]
**Approved by:** [approver name]

### Reason for Bypass
[Explain the emergency that required bypass]

### Gates Skipped
- [ ] Gate 2: Security (secrets detection)
- [ ] Gate 3: Code Quality (TypeScript, ESLint, Prettier)
- [ ] Gate 4: Testing (if applicable)

### Follow-Up Status
- [ ] Ran skipped checks locally
- [ ] Fixed any issues found
- [ ] Follow-up commit created: [hash]
```

### Post-Bypass Requirements

All bypasses require follow-up actions within defined SLAs. Failure to complete follow-up actions may result in reverted changes.

**Required Actions After Any Bypass:**

| Action | SLA | Owner |
|--------|-----|-------|
| Create tracking issue | Within 1 hour | Developer who bypassed |
| Notify team lead | Within 1 hour | Developer who bypassed |
| Run all skipped checks locally | Within 24 hours | Developer who bypassed |
| Create fix commit (if issues found) | Within 24 hours | Developer who bypassed |
| Close tracking issue | Within 48 hours | Developer who bypassed |

**Tracking Issue Requirements:**

Every bypass must have a GitHub issue containing:
- Date and time of bypass
- Commit hash(es) affected
- Gates/checks that were skipped
- Reason for bypass (specific emergency)
- Name of approver
- Follow-up action status

**Labels for Bypass Issues:**
- `bypass` - Required for all bypass tracking issues
- `tech-debt` - If bypass introduced known issues
- `security` - If any security checks were skipped
- `hotfix` - If bypass was for production emergency

**Consequences of Incomplete Follow-Up:**
- Unresolved bypass issues flagged in weekly team review
- Repeat offenders may lose bypass privileges
- Patterns of bypasses indicate process problems to address

---

**Need more help?** Type `/quality-check` in Claude Code or ask for specific guidance!
