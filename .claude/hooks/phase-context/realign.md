<!-- Source: .claude/agents/feature-planner.md (REALIGN mode) — keep in sync when agent process steps change -->

## REALIGN Phase Process

1. **Check** `generated-docs/discovered-impacts.md` for impacts affecting the upcoming story
2. **If no impacts for this story** (file empty, missing, or impacts only affect other stories): Auto-complete immediately — **no user approval needed**, no commit needed. Transition directly to TEST-DESIGN. Leave unrelated impacts in the file for later stories.
3. **If impacts exist**:
   - Present proposed revisions in conversation
   - **STOP and wait** for user approval (mandatory approval point)
   - Update the story file with approved revisions
   - Remove processed impacts from discovered-impacts.md
   - Commit:
     ```bash
     git add generated-docs/
     git commit -m "docs(realign): update story M based on implementation learnings"
     ```
4. **Transition to TEST-DESIGN**:
   ```bash
   node .claude/scripts/transition-phase.js --current --story M --to TEST-DESIGN --verify-output
   ```
5. **Proceed directly to TEST-DESIGN** (no context clearing at this boundary)

## What Happens Next
- TEST-DESIGN phase: test-designer creates specification-by-example document for BA review
- Then TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA → commit
