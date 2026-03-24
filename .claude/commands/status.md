---
description: Show current workflow progress - displays which phase you're in and what's completed
model: haiku
---

You are showing a developer their current position in the TDD workflow. This is display-only - do not take any action.

## Step 1: Collect and Display Status

Run the data collection script with text output:

```bash
node .claude/scripts/collect-dashboard-data.js --format=text
```

Display the script's output **as-is** to the user. The script produces pre-formatted terminal output including:

- Feature name and current phase
- Requirements summary (from INTAKE onward)
- Design agent progress (from DESIGN onward)
- Epic and story progress table (from SCOPE onward)
- Design artifacts status
- Current position and suggested next action
- Available commands

## Error Handling

If the script returns `"No workflow state found"`:
- Display that message
- Suggest `/start` to begin the TDD workflow

If the script fails to run:
- Check if the script exists: `.claude/scripts/collect-dashboard-data.js`
- Report the error and suggest `node .claude/scripts/transition-phase.js --show` as a fallback

## Phase Descriptions

If the user needs clarification, explain phases in plain language:

| Phase | Level | Description |
|-------|-------|-------------|
| INTAKE | Feature | Gathering requirements and producing the Feature Requirements Specification (mandatory, once) |
| DESIGN | Feature | Generating missing artifacts and copying user-provided ones (mandatory, once) |
| SCOPE | Feature | Breaking down the feature into epics (no stories yet) |
| STORIES | Epic | Defining stories and acceptance criteria for the current epic |
| REALIGN | Story | Reviewing discovered impacts before the current story (auto-completes if none) |
| TEST-DESIGN | Story | Designing specification-by-example test scenarios for BA review |
| WRITE-TESTS | Story | Generating executable tests for the current story |
| IMPLEMENT | Story | Writing code to make the current story's tests pass |
| QA | Story | Code review, quality gates, and committing the current story |
| COMPLETE | Story | Story complete, advancing to next story or next epic |
| PENDING | Story | Story not yet started |

**Workflow (4 stages):**
1. INTAKE (once) → DESIGN (once) → SCOPE (epics only)
2. Per-Epic: STORIES (define stories for current epic)
3. Per-Story: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA → commit

## DO

- Display the script output as-is (no reformatting needed)
- Keep output concise
- Always suggest next action (`/continue` or `/start`)

## DON'T

- Take any action (this is display-only)
- Run tests (that's for `/continue` to do)
- Resume or launch agents
- Show raw JSON to the user
- Reformat the script's text output — it's already formatted

## Related Commands

- `/continue` - Resume workflow from current position
- `/start` - Start TDD workflow from beginning
- `/dashboard` - Open visual dashboard
- `/quality-check` - Run all quality gates
