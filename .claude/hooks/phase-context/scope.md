<!-- Source: .claude/agents/feature-planner.md (SCOPE mode) — keep in sync when agent process steps change -->

## SCOPE Phase Process

1. **Read feature spec** from `generated-docs/specs/feature-requirements.md` (canonical FRS from INTAKE) — **the FRS is the source of truth for all epic and story definitions, not existing template code**
2. **Check for wireframes** in `generated-docs/specs/wireframes/` and OpenAPI specs in `generated-docs/specs/`
3. **Call A: Define ALL epics** (not stories yet) — return to orchestrator for user approval
4. **Orchestrator uses AskUserQuestion** to get epic list approval
5. **Call B: Write** `generated-docs/stories/_feature-overview.md` with approved epics
6. **Update CLAUDE.md** Project Overview section with feature name and planned epics
7. **Commit and push**:
   ```bash
   git add generated-docs/stories/_feature-overview.md CLAUDE.md .claude/logs/
   git commit -m "docs(scope): define epics for [feature-name]"
   git push origin main
   node .claude/scripts/transition-phase.js --set-totals epics N
   node .claude/scripts/transition-phase.js --epic 1 --to STORIES --verify-output
   ```
8. **After epic list approval**: This is a mandatory context-clearing boundary — instruct `/clear` + `/continue`

## What Happens Next
- STORIES phase: feature-planner defines stories for Epic 1
- Then per-story cycle: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA
