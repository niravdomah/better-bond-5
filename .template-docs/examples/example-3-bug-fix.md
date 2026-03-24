# Example 3: Bug Fix Workflow - Alternative Path

This example demonstrates an alternative workflow path for fixing bugs, which differs from the feature development workflow.

> **Status:** This example is planned but not yet written. See [Example 1](./example-1-full-workflow.md) for a complete walkthrough of the standard workflow.

---

## Scenario

**What We're Fixing:**
A bug where the portfolio widget shows incorrect percentage formatting for negative values (displays `-0.45%` instead of `−0.45%` with proper minus sign).

**Why This Example:**
- Shows the bug fix workflow (different from feature development)
- Demonstrates writing a failing test first (regression test)
- Shows how to skip planning phases for small fixes

---

## Bug Fix Workflow vs Feature Workflow

| Aspect | Feature Workflow | Bug Fix Workflow |
|--------|------------------|------------------|
| Planning | Create epics/stories | Skip (bug report is the spec) |
| Tests | Generate from acceptance criteria | Write regression test first |
| Implementation | Make all tests pass | Fix the specific issue |
| Commit | After approval | Direct to main after verification |

---

## Bug Fix Steps

### Step 1: Write a Failing Test (Regression Test)

Before fixing the bug, write a test that reproduces it:

```typescript
it('should display negative percentage with proper minus sign', async () => {
  // This test should FAIL with current code
  vi.mocked(portfolioApi.getPortfolioSummary).mockResolvedValue({
    ...mockPortfolioData,
    dailyChangePercent: -0.45,
  });

  render(<PortfolioValueWidget portfolioId="123" />);

  await waitFor(() => {
    // Expect proper minus sign (U+2212), not hyphen-minus (U+002D)
    expect(screen.getByText(/−0\.45%/)).toBeInTheDocument();
  });
});
```

### Step 2: Fix the Bug

Make the minimal change to fix the issue.

### Step 3: Verify Test Passes

Run the test to confirm the fix works.

### Step 4: Run Quality Gates

Even for bug fixes, run `/quality-check` before committing.

---

## When to Use Bug Fix Workflow

- Single, isolated bugs with clear reproduction steps
- No new features or behavior changes
- Quick turnaround needed

## When to Use Full Workflow Instead

- Bug fix requires significant refactoring
- Multiple related bugs need to be fixed together
- Fix involves adding new components or API endpoints

---

## Detailed Walkthrough

*Coming soon - this example will be expanded with a complete step-by-step guide.*

---

*See also:*
- [Example 1: Full Workflow](./example-1-full-workflow.md) - Complete workflow from start to finish
- [Example 2: Mid-Chain Entry](./example-2-mid-chain-entry.md) - Starting from an existing plan
