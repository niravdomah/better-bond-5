<!-- Source: .claude/agents/test-generator.md — keep in sync when agent process steps change -->

## WRITE-TESTS Phase Process

1. **Read test-design document** (primary input): Get BA-reviewed test scenarios and Coverage-for-WRITE-TESTS mapping from `generated-docs/test-design/epic-N-[slug]/story-M-[slug]-test-design.md`. Generate tests from these examples, not from raw story ACs.
2. **Read story file + FRS** (secondary input): Get story metadata (Route, Target File, Page Action) and AC-N identifiers from `generated-docs/stories/epic-N-[slug]/story-M-[slug].md` — include metadata in test file header comment; Check relevant FRS sections. **Tests must validate spec-required behavior, not existing template behavior.** If the FRS specifies a different approach than the template (e.g., BFF auth instead of NextAuth), write tests for the FRS-required approach.3. **Map test-design examples to test scenarios**: Each example → one or more test cases. Add `// AC-N` comment above each `it()`/`test()` block referencing which ACs it covers.
4. **Generate test file**: Write to `web/src/__tests__/integration/epic-N-story-M-[slug].test.tsx`
   - Import REAL components (will fail until implemented — that's the point)
   - Only mock the HTTP client (`vi.mock('@/lib/api/client')`)
   - Assert user-observable behavior, not implementation details
   - Include accessibility test (vitest-axe)
5. **Verify tests fail**: Run `cd web && npm test -- --testPathPattern="epic-N-story-M"`
   - Acceptable: `Cannot find module`, assertion errors
   - Unacceptable: tests pass, tests skipped
6. **Do NOT commit** — developer agent commits tests + implementation together
7. **Transition to IMPLEMENT**:
   ```bash
   node .claude/scripts/transition-phase.js --current --story M --to IMPLEMENT --verify-output
   ```

## What Happens Next
- IMPLEMENT phase: developer agent reads tests and makes them pass
- Then QA → commit → next story's REALIGN
