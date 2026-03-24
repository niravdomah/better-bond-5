# AI Agent Guide: Building Features with TDD

This guide explains how to use Claude Code's specialized agents to build features using Test-Driven Development (TDD).

## Overview

This template uses a **4-agent workflow**:

```
Spec → feature-planner → test-generator → [Implement] → code-reviewer
            PLAN              RED            GREEN              QA
```

## Available Agents

| Agent | Phase | Purpose |
|-------|-------|---------|
| **feature-planner** | PLAN | Breaks specs into epics, stories, and acceptance tests |
| **test-generator** | RED | Converts acceptance tests into executable test code |
| **code-reviewer** | QA | Reviews code quality, security, and validates all quality gates before PR |

## The Workflow

### Step 1: Plan the Feature (PLAN)
Start with a spec and use the feature-planner to break it down.

```
Plan the user authentication feature based on the spec
```

The feature-planner will:
1. **Propose epics** → wait for your approval
2. **Propose stories per epic** → wait for your approval
3. **Write acceptance tests** for each story

This is interactive - you approve at each stage.

### Step 2: Generate Tests (RED)
Use the test-generator to convert acceptance tests into code.

```
Generate tests for the Sign Up Form story
```

The test-generator will:
- Convert Given/When/Then acceptance tests into Vitest tests
- Include accessibility tests
- Create failing tests that define expected behavior

### Step 3: Implement (GREEN)
Write code to make the tests pass. Claude Code handles this directly.

```
Implement the Sign Up Form to make the tests pass
```

### Step 4: QA Phase (QA)
Get a code review to catch issues before PR.

```
Review the code for the Sign Up Form
```

The code-reviewer will:
- Check code quality and patterns
- Identify potential improvements
- Ensure security best practices

### Step 5: Quality Gates
Run all quality gates before creating a PR.

```
/quality-check
```

The code-reviewer will also:
- Run all 5 quality gates
- Generate a PR-ready report
- Provide remediation steps for failures

## The 5 Quality Gates

| Gate | Type | What It Checks |
|------|------|----------------|
| 1. Functional | Manual | Feature works as expected |
| 2. Security | Automated | No vulnerabilities, no secrets |
| 3. Code Quality | Automated | TypeScript, ESLint, build pass |
| 4. Testing | Automated | Vitest tests pass with coverage |
| 5. Performance | Manual | No regressions |

## Quick Start Example

**You:** "Plan a payments feature based on this spec: users need to view payment history and filter by date"

**Claude Code (feature-planner):**
```
## Proposed Epics

1. **Epic 1: Payment List** - Display payment history in a table
2. **Epic 2: Date Filtering** - Filter payments by date range

Please review and approve the epics and their order.
```

**You:** "Approved, let's start with Epic 1"

**Claude Code (feature-planner):**
```
## Epic 1: Payment List - Proposed Stories

1. **Payment Table** - Display payments with date, amount, status
2. **Empty State** - Show message when no payments exist
3. **Loading State** - Show skeleton while fetching

Please review and approve the stories.
```

**You:** "Approved, write the acceptance tests"

**Claude Code (feature-planner):** Writes Given/When/Then acceptance tests for each story

**You:** "Generate tests for the Payment Table story"

**Claude Code (test-generator):** Creates failing tests in `web/src/__tests__/integration/`

**You:** "Implement it to make the tests pass"

**Claude Code:** Implements the feature

**You:** "Review the code"

**Claude Code (code-reviewer):** Reviews and suggests improvements

**You:** `/quality-check`

**Claude Code (code-reviewer):** Runs all gates, confirms ready for PR

## Prompt Templates

### Plan Feature
```
Plan the [FEATURE NAME] feature based on [spec/requirements]
```

### Generate Tests
```
Generate tests for the [STORY NAME] story
```

### Implement Feature
```
Implement the [STORY NAME] to make the tests pass
```

### Code Review
```
Review the code for [STORY NAME]
```

### Quality Check
```
/quality-check
```

## Common Questions

**Q: Can I skip the planning phase?**
A: For simple features, yes. For complex features, the feature-planner ensures you have well-defined stories and acceptance tests before coding.

**Q: Can I skip writing tests first?**
A: You can, but TDD ensures your implementation meets requirements and catches issues early.

**Q: What if I need help with design/layout?**
A: Just describe what you want. Claude Code can suggest layouts, use Shadcn UI components, and follow best practices.

**Q: Why does the feature-planner pause for approval?**
A: To ensure you're aligned on scope and priorities before investing time in detailed planning or implementation.

## Getting Help

1. Check the project documentation: [CLAUDE.md](../CLAUDE.md)
2. Ask Claude Code: "Can you explain [CONCEPT] in the context of this project?"
3. Run `/quality-check` to see what gates are failing
