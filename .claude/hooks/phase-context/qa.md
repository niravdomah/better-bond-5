<!-- Source: .claude/agents/code-reviewer.md — keep in sync when agent process steps change -->

## QA Phase Process

1. **Part 1 — Qualitative code review**: Review changed files against checklist (TypeScript, React, security, project patterns, testing, accessibility). **Verify implementation matches FRS requirements, not just template patterns** — flag cases where template code was extended instead of replaced when the FRS requires a different approach. Classify issues by severity (Critical/High/Suggestions).
   - Critical issues → STOP, present to user for fixing
   - High/Medium → log to discovered-impacts.md
   - Suggestions → log only, don't block
2. **Part 2 — Automated quality gates**: Run `cd web && node ../.claude/scripts/quality-gates.js --auto-fix --json`. Parse and report results. Do NOT proceed if gates fail.
3. **Part 3 — Manual verification**: Check the story's Route metadata. If routable: present acceptance criteria checklist (in plain, non-technical language) and use AskUserQuestion for pass/fail/skip. If Route is `N/A` (component only): auto-skip browser testing and proceed directly to commit.
   - **If "Issues found"**: The orchestrator must NEVER fix issues directly — delegate to a QA fix-cycle coordinator (see orchestrator-rules.md § QA Fix Cycle). The coordinator launches developer + code-reviewer Call A + Call B, returns NEEDS_APPROVAL for re-verification.
4. **Part 4 — Commit and push**:
   ```bash
   git add web/src/__tests__/ web/src/ .claude/logs/
   git commit -m "feat(epic-N): story M — [title]"
   git push origin main
   ```
5. **Transition to COMPLETE**:
   ```bash
   node .claude/scripts/transition-phase.js --current --story M --to COMPLETE --verify-output
   ```
6. **If last story in epic**: Present epic completion review (summary + user approval)
7. **Mandatory context-clearing boundary**: Instruct the user to run `/clear` then `/continue`. Applies after every completed story. Skip only if the feature is complete (no more epics).

## What Happens Next
- Transition script determines: more stories → REALIGN for next story, more epics → STORIES for next epic, done → feature complete
