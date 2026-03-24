# Example 2: Mid-Chain Entry - Adding API Integration to Existing Page

This example demonstrates entering the workflow mid-chain when you already have wireframes or stories, and just need to generate tests and implement.

> **Status:** This example is planned but not yet written. See [Example 1](./example-1-full-workflow.md) for a complete walkthrough.

---

## Scenario

**What We're Building:**
Adding API integration to an existing settings page that already has:
- Wireframes designed externally (Figma)
- Basic component structure in place
- No tests yet

**Why This Example:**
- Shows how to skip the DESIGN phase
- Demonstrates entering at the PLAN or WRITE-TESTS phase
- Common scenario when adding features to existing pages

---

## Key Differences from Full Workflow

| Phase | Full Workflow | Mid-Chain Entry |
|-------|---------------|-----------------|
| DESIGN | Create wireframes | Skip (already exist) |
| PLAN | Create epics and stories | Start here OR skip if stories exist |
| WRITE-TESTS | Generate failing tests | Start here if stories exist |
| IMPLEMENT | Make tests pass | Same |
| QA | Code review + Quality gates | Same |

---

## Starting Mid-Chain

### If you have wireframes but no stories:

```
Plan stories for the settings API integration based on the existing wireframes
```

### If you already have stories:

```
Generate tests for the settings API integration stories
```

### If you already have tests:

```
Implement the settings API integration to make the failing tests pass
```

---

## Detailed Walkthrough

*Coming soon - this example will be expanded with a complete step-by-step guide.*

---

*See also:*
- [Example 1: Full Workflow](./example-1-full-workflow.md) - Complete workflow from start to finish
- [Example 3: Bug Fix Workflow](./example-3-bug-fix.md) - Alternative workflow for bug fixes
