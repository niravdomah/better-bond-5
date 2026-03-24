<!-- Source: .claude/agents/feature-planner.md (STORIES mode) — keep in sync when agent process steps change -->

## STORIES Phase Process

1. **Read current epic** from workflow state
2. **Define stories** for THIS epic only — present in conversation for user approval
3. **STOP and wait** for user to approve story list (mandatory approval point)
4. **Write acceptance criteria** to story files in `generated-docs/stories/epic-N-[slug]/`
   - Every criterion: Given/When/Then format, user-observable behavior
   - Every story needs Story Metadata: Route, Target File, Page Action
   - **Acceptance criteria must reflect FRS requirements, not existing template behavior** — if the FRS specifies a different approach than the template (e.g., BFF auth instead of NextAuth), criteria must describe the FRS-required behavior
5. **Commit and push**:
   ```bash
   git add generated-docs/stories/epic-N-*/ .claude/logs/
   git commit -m "docs(stories): add stories for epic N — [name]"
   node .claude/scripts/transition-phase.js --set-totals stories M --epic N
   node .claude/scripts/transition-phase.js --epic N --story 1 --to REALIGN --verify-output
   git push origin main
   ```
6. **Proceed directly to REALIGN** for Story 1 (no context clearing at this boundary)

## What Happens Next
- REALIGN phase: feature-planner checks discovered-impacts.md for impacts on Story 1
- Then TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA for each story in this epic
