<!-- Source: .claude/agents/test-designer.md — keep in sync when agent process steps change -->

## TEST-DESIGN Phase Process

1. **Read story file + FRS**: Get acceptance criteria and business rules from the story file. Cross-check against the FRS to ensure scenarios reflect **spec requirements, not existing template behavior**.
2. **Read design artifacts**: Check wireframes, API spec, design tokens for context
3. **Identify key decisions**: Surface business decisions the BA didn't explicitly specify
4. **Write specification-by-example document**: Create `generated-docs/test-design/epic-N-[slug]/story-M-[slug]-test-design.md` with:
   - Business behaviors (Given/When/Then with data tables)
   - Key decisions surfaced for BA review
   - Test scenarios mapped to acceptance criteria
   - Edge cases and boundary examples
   - Coverage matrix (acceptance criterion → scenario mapping)
5. **Return summary for user review** (Call A ends here)
6. **User reviews the test-design document** — orchestrator presents summary and asks for approval
7. **After approval, transition to WRITE-TESTS** (Call B):
   ```bash
   node .claude/scripts/transition-phase.js --current --story M --to WRITE-TESTS --verify-output
   ```
8. Proceed to WRITE-TESTS (approval gate, no context clearing at this boundary)

## What Happens Next
- WRITE-TESTS phase: test-generator reads this test-design document and creates failing tests
- Then IMPLEMENT → QA → commit
