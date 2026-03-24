---
description: Resume interrupted TDD workflow
---

You are helping a developer resume the TDD workflow from where it was interrupted.

**Read and follow all rules in [orchestrator-rules.md](../shared/orchestrator-rules.md) — they are mandatory.**

## Dispatcher Pattern (CRITICAL)

`/continue` uses a **dispatcher pattern** to work around a Claude Code bug where hook and permission dispatch ceases mid-response after approximately 4 tool calls. The parent orchestrator is limited to **2–3 tool calls maximum** before delegating everything to a coordinator subagent.

**Architecture:**
1. **Parent** runs 1 Bash call to collect workflow state
2. **Parent** launches 1 coordinator subagent (general-purpose) with the state JSON
3. **Coordinator** handles all file reads, TodoWrite reconstruction, and work agent launches in its own fresh dispatch context

**Parent orchestrator rules:**
- **NEVER** read files, run additional scripts, or call TodoWrite directly
- **ONLY** collect state (Bash), handle repair if needed (Bash), launch coordinator (Agent), and handle AskUserQuestion on coordinator return
- After user responds to AskUserQuestion → new turn with fresh hooks → safe to launch another coordinator

## Workflow Reminder

The TDD workflow has four stages:

0. **Requirements gathering**: INTAKE (intake-agent → [prototype-review-agent, v2 only] → intake-brd-review-agent)
1. **One-time setup**: DESIGN (mandatory) → SCOPE (define all epics, no stories yet)
2. **Per-epic**: STORIES (define stories for the current epic only)
3. **Per-story iteration**: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA → commit → (next story)

After QA passes for a story:

- If more stories in epic → REALIGN for next story
- If no more stories but more epics → STORIES for next epic
- If no more stories and no more epics → Feature complete!

## Step 1: Validate Workflow State

Collect enriched workflow data with a single script call:

```bash
node .claude/scripts/collect-dashboard-data.js --format=json
```

### If `status: "no_state"`:

**Automatically attempt to repair the state first:**

```bash
node .claude/scripts/transition-phase.js --repair
```

If repair succeeds, show the user the detected state and ask them to confirm before proceeding.

If repair fails (no artifacts found), ask the user:

> "No workflow state or artifacts found. Would you like to start fresh with `/start`, or describe the current state so I can help you continue?"

**Important:** After repair, check the **confidence level** in the output:

- `"confidence": "high"` - State is reliable, show summary and proceed
- `"confidence": "medium"` - Show the `detected` and `assumed` arrays, ask user to confirm
- `"confidence": "low"` - **REQUIRE** user to verify before proceeding, show warning prominently

After repair succeeds, re-run `collect-dashboard-data.js --format=json` to get the enriched data.

### If `status: "ok"` (state exists):

Display a brief summary:

```
Resuming: Epic [N], Story [M], Phase: [phase]
```

Then proceed directly to Step 2.

## Step 2: Launch Coordinator

**Immediately** launch a `general-purpose` coordinator subagent. Do NOT read files, reconstruct TodoWrite, or make any additional tool calls first.

Build the coordinator prompt from three parts:

1. **Base instructions** (always included — see below)
2. **State JSON** from Step 1
3. **Phase-specific instructions** for the current phase (see Phase Sections below)

### Base Coordinator Prompt

Always include this at the top of the coordinator prompt:

```
You are a workflow coordinator for the TDD workflow, delegated by the parent orchestrator to handle /continue resumption.

## Your Tasks (in order)

1. **Reconstruct TodoWrite progress display:**
   Run: node .claude/scripts/generate-todo-list.js
   Parse the JSON output and call TodoWrite with the resulting array.

2. **Read the shared orchestrator rules:**
   Read .claude/shared/orchestrator-rules.md for scoped call patterns, commit policy, and dashboard update policy.

3. **Execute the phase-specific instructions** provided below.

4. **Return results** to the parent orchestrator.

## Critical Rules

- Do NOT use AskUserQuestion — it silently auto-resolves in subagents. When you have content that needs user approval, return it as text in your response with the prefix "NEEDS_APPROVAL:" on its own line, followed by the content. The parent orchestrator will present it to the user.
- When launching work agents, include a reminder to update workflow state via transition-phase.js.
- Follow all rules in orchestrator-rules.md — especially scoped call patterns, voice guidelines, commit policy, and the FRS-Over-Template Rule.
- Fire dashboard updates (node .claude/scripts/generate-dashboard-html.js --collect) at workflow milestones per the Dashboard Update Policy.
- Verify all script JSON output: "status": "ok" = proceed, "status": "error" = STOP and return the error.
- When launching WRITE-TESTS, IMPLEMENT, or TEST-DESIGN agents, include the FRS-over-template reminder from orchestrator-rules.md in the prompt.
```

### State JSON Block

Include the raw JSON from `collect-dashboard-data.js`:

```
## Current Workflow State

[paste JSON here]
```

### Phase-Specific Instructions

Based on the current phase from the state JSON, append the matching section below to the coordinator prompt.

---

#### INTAKE

```
## Phase: INTAKE

INTAKE has two or three sequential agents depending on prototype format. Determine which one to resume based on artifacts:

1. Check if generated-docs/context/intake-manifest.json exists:
   - No → Recover onboarding context (see below), then resume with intake-agent
   - Yes → Check step 2

2. If the manifest has context.prototypeFormat === "v2", check if prototype review has completed:
   - Check if generated-docs/prototype-screenshots/ has PNG files OR artifacts.wireframes.generate === false in the manifest
   - Neither is true → Resume with prototype-review-agent (it was interrupted between intake-agent and BRD review)
   - Either is true → Prototype review is done, check step 3

3. Check if generated-docs/specs/feature-requirements.md exists:
   - No → Resume with intake-brd-review-agent
   - Yes → INTAKE is complete. Inform user and transition to DESIGN.

### Recovering onboarding context (no manifest yet)

Step 1 — Infer onboardingPath from documentation/:
- If documentation/prototype-src/ contains subdirectories → "prototype"
- Else if documentation/ contains substantive files (not just .gitkeep) → "docs"
- Else → "qa"

Step 2 — Recover projectDescription:
- If "docs" or "prototype" → null (docs serve as description)
- If "qa" → Return to parent with: "NEEDS_APPROVAL:" followed by the question: "We're picking up where we left off on requirements. I don't have the project description from last session — could you give me the elevator pitch again?"

Step 3 — Use the scoped call patterns from orchestrator-rules.md. Call A (scan) is idempotent. Pass recovered onboardingPath and projectDescription into Call B.

After the agent completes:
- If intake-agent finished AND context.prototypeFormat === "v2" → invoke prototype-review-agent first, then intake-brd-review-agent
- If intake-agent finished AND NOT v2 → invoke intake-brd-review-agent directly
- If prototype-review-agent finished → pass accepted enrichments, confirmed assumptions, and genesis→FRS mapping to intake-brd-review-agent Call A as additional context
- If intake-brd-review-agent finished → fire dashboard update, then return with message instructing user to /clear then /continue (clearing boundary #1)
```

---

#### DESIGN

```
## Phase: DESIGN

DESIGN is a multi-agent phase with parallel Call A execution. Read the full DESIGN Execution Model in orchestrator-rules.md.

1. Read the intake manifest: generated-docs/context/intake-manifest.json

2. Check which artifacts with generate == true are still missing. Use the artifact-to-agent mapping in orchestrator-rules.md to determine output paths. Check whether each agent's expected output file exists on disk. **E6 wireframe skip:** If artifacts.wireframes.generate === false (set by prototype-review-agent when .pen screenshots exist), do NOT include design-wireframe-agent — the .pen screenshots serve as wireframes.

3. For user-provided files that need copying (generate == false + userProvided set): use the copy script:
   node .claude/scripts/copy-with-header.js --from "<path>" --to "generated-docs/specs/<target>"

4. Determine resumption strategy:
   a. No outputs exist → Follow full parallel execution model (launch all Call A in parallel)
   b. Some outputs exist → Launch Call A only for agents whose output is missing. Also check for web/src/types/api-generated.ts if api-spec.yaml exists.
   c. All agent outputs exist but dependents haven't run → Launch mock-setup-agent and/or type-generator-agent as needed
   d. All outputs exist, transition not run → DESIGN is complete. Run finalize step.

5. If all artifacts exist and transition was already run → inform user, state should be SCOPE.

For Call A results that need user approval (API spec, design tokens, screen list):
Return with "NEEDS_APPROVAL:" followed by the summary for each agent that produced output. Include which agent produced each summary so the parent knows what approval is for.

For autonomous agents (mock-setup-agent, type-generator-agent): handle their full flow internally and report completion.
```

---

#### SCOPE

```
## Phase: SCOPE

Use the SCOPE scoped-call pattern from orchestrator-rules.md.

Launch feature-planner Call A:
"This is Call A — Propose Epics. You are in SCOPE mode. Read the FRS at generated-docs/specs/feature-requirements.md and propose an epic breakdown. Return the epic list with descriptions and dependency map. Do NOT write any files. Do NOT commit. Do NOT use AskUserQuestion."

Return with "NEEDS_APPROVAL:" followed by the epic list.
```

---

#### STORIES

```
## Phase: STORIES

Current epic: [N]

Use the STORIES scoped-call pattern from orchestrator-rules.md.

Launch feature-planner Call A:
"This is Call A — Propose Stories. You are in STORIES mode for Epic [N]. Read the FRS and epic overview. Propose stories for this epic. Return the story list. Do NOT write story files. Do NOT commit."

Return with "NEEDS_APPROVAL:" followed by the story list.
```

---

#### REALIGN

```
## Phase: REALIGN

Current epic: [N], Current story: [M]

Launch feature-planner Call A:
"This is Call A — Check Impacts. You are in REALIGN mode for Epic [N], Story [M]. Read discovered-impacts.md. If no impacts exist, return 'No impacts — auto-completed.' If impacts exist, analyze them and return proposed revisions."

If agent returns "No impacts — auto-completed":
- Run the state transition yourself: node .claude/scripts/transition-phase.js --current --story [M] --to TEST-DESIGN --verify-output
- Fire dashboard update
- Proceed directly to TEST-DESIGN (execute the TEST-DESIGN instructions below)

If agent returns with proposed revisions:
- Return with "NEEDS_APPROVAL:" followed by the proposed revisions
```

---

#### TEST-DESIGN

```
## Phase: TEST-DESIGN

Current epic: [N], Current story: [M]
Story file: [path from state]

This phase requires user approval before proceeding.

Launch test-designer Call A:
"This is Call A — Design test scenarios for Epic [N], Story [M]. Story file: [path]. Produce a specification-by-example document for BA review. You MUST follow the Required Template defined in your agent instructions — use Setup/Input/Expected tables (NOT Given/When/Then), and include ALL required sections: Story Summary, Review Purpose, Business Behaviors Identified, Key Decisions Surfaced by AI, Test Scenarios / Review Examples, Edge and Alternate Examples, Out of Scope, Coverage for WRITE-TESTS (AC → example mapping), and Handoff Notes for WRITE-TESTS. Write the document to generated-docs/test-design/. Return a summary listing scenario titles, counts (main examples, edge examples, BA decisions required), and any key ambiguities. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

After it returns:
- Fire dashboard update
- Read the full generated test-design document from generated-docs/test-design/ and return with "NEEDS_APPROVAL:" followed by:
  1. A clickable markdown link to the full document file (e.g., `[epic-N-story-M-title.md](generated-docs/test-design/epic-N-story-M-title.md)`)
  2. The COMPLETE document contents (not just a summary). The user needs to review every scenario table and decision to make an informed approval.
- Only proceed to WRITE-TESTS after user approves
```

---

#### WRITE-TESTS

```
## Phase: WRITE-TESTS

Current epic: [N], Current story: [M]
Story file: [path from state]

This phase is fully autonomous. Handle everything internally.

Launch test-generator:
"Generate tests for Epic [N], Story [M]. Story file: [path]. Test design: [path to test-design doc in generated-docs/test-design/]. Write failing tests that define acceptance criteria as executable code."

After it returns:
- Fire dashboard update
- Proceed directly to IMPLEMENT (execute the IMPLEMENT instructions below)
```

---

#### IMPLEMENT

```
## Phase: IMPLEMENT

Current epic: [N], Current story: [M]

This phase is fully autonomous. Handle everything internally.

Step 1: Run npm test in web/ to identify failing tests for the current story. Capture the output.

Step 2: Launch developer Call A:
"This is Call A — Implement. Read the story at [path] and tests at [path]. Here are the current failing tests: [paste output]. Write code to make all failing tests pass. Do NOT run quality gates in this call."

Step 3: Launch developer Call B:
"This is Call B — Pre-flight Test Check. Run npm test to verify all tests pass. Fix any failures. Do NOT run lint, build, or test:quality. Do NOT commit."

After Call B returns:
- Fire dashboard update
- Proceed directly to QA (execute the QA instructions below)
```

---

#### QA

```
## Phase: QA

Current epic: [N], Current story: [M]

QA has 3 calls with a manual verification checkpoint between Call B and Call C.

Launch code-reviewer Call A:
"This is Call A — code review only. Do NOT run quality gates or commit."

Launch code-reviewer Call B:
"This is Call B — run quality gates and return results. Also read the story file and return the manual verification checklist as text. Do NOT commit."

After Call B returns:
Check if Call B's response indicates a non-routable component (Route: N/A).

If NON-ROUTABLE: Display Call B's component-only note to the user, then proceed directly to Call C (auto-approve). The commit should note "Manual verification: auto-skipped (component not yet reachable in the app)". Do NOT return NEEDS_APPROVAL — skip straight to Call C.

If ROUTABLE: Return with "NEEDS_APPROVAL:" followed by:
1. The quality gate results (in plain, non-technical language)
2. The manual verification checklist
3. The instruction: "Have you verified [Story Name] in the browser? Options: All tests pass / Issues found / Skip for now"
```

**Handling "Issues found" (QA fix cycle):**

When the user selects "Issues found" after manual verification, the parent orchestrator must delegate fixes to a coordinator — NEVER fix issues directly (this triggers the hook-dispatch bug that the dispatcher pattern exists to prevent).

See the **QA Fix Cycle** section in orchestrator-rules.md for the full coordinator prompt and flow. In summary:

1. `AskUserQuestion`: ask user to describe the issues → **fresh turn**
2. Launch coordinator: developer fixes → code-reviewer Call A + Call B → returns NEEDS_APPROVAL with updated results
3. Present results → `AskUserQuestion` for re-verification → **fresh turn**
4. If "Issues found" again → repeat (each cycle gets fresh hooks)
5. If passed/skipped → launch coordinator for Call C as normal

---

#### COMPLETE

```
## Phase: COMPLETE

Check the next action from the state data:
- More stories in epic → Proceed to REALIGN for next story (execute REALIGN instructions)
- No more stories but more epics → Proceed to STORIES for next epic (execute STORIES instructions)
- No more stories and no more epics → Return with: "Feature complete! All epics and stories have been implemented and passed QA."
```

## Step 3: Handle Coordinator Return

### If the response contains "NEEDS_APPROVAL:"

The coordinator completed Call A and needs user approval.

1. Extract and display the content after "NEEDS_APPROVAL:" as regular conversation text
2. Use `AskUserQuestion` with the appropriate options for the phase (see orchestrator-rules.md)
3. After user responds → **new turn with fresh hooks**
4. Launch a **new coordinator** for the follow-up work. Include in its prompt:
   - The base coordinator instructions (same as Step 2)
   - The user's approval decision and any feedback
   - Instructions for what to do next (Call B, revisions, etc.)
   - For QA Call C after manual verification: `"Launch code-reviewer Call C: 'The user confirmed manual verification. Status: [passed|auto-skipped|skipped]. [If deferred stories were verified: Also mark stories N, M as deferred-passed.] Proceed to commit and transition to COMPLETE. Do NOT run quality gates again.' After it returns, fire dashboard update. Display its return message — it contains the /clear + /continue instruction. STOP after displaying it."`
   - For QA "Issues found": follow the **QA Fix Cycle** in orchestrator-rules.md. Use `AskUserQuestion` to get the issue description (fresh turn), then launch a fix-cycle coordinator that delegates to developer + code-reviewer Call A + Call B, returning NEEDS_APPROVAL for re-verification. **Never fix issues directly from the parent orchestrator.**

### If the response does NOT contain "NEEDS_APPROVAL:"

The coordinator handled an autonomous phase or a clearing boundary.

1. Display the coordinator's summary to the user
2. If the coordinator indicates a **clearing boundary** (end of INTAKE, DESIGN, SCOPE, or story QA): instruct user to `/clear` then `/continue` and **STOP**
3. If the coordinator completed an autonomous phase and there's a next phase: the coordinator should have already proceeded to it. If it didn't (e.g., it ran out of context), launch a new coordinator for the next phase.

## Script Execution Verification

**All transition scripts output JSON. Always verify the result before proceeding** (see [orchestrator-rules.md § Script Execution Verification](../shared/orchestrator-rules.md#script-execution-verification) for the full rules):

1. `"status": "ok"` = Success, proceed to next step
2. `"status": "error"` = **STOP**, report the error to the user
3. `"status": "warning"` = Proceed with caution, inform user

**Troubleshooting:**
- Check current state: `node .claude/scripts/transition-phase.js --show`
- Validate artifacts: `node .claude/scripts/validate-phase-output.js --phase <PHASE> --epic <N>`
- Repair if needed: `node .claude/scripts/transition-phase.js --repair`

## Error Handling

- **State file missing:** Use `--repair` to reconstruct from artifacts
- **State appears wrong:** Ask user to confirm or correct
- **Script fails:** Ask user to describe current state manually
- **Invalid transition:** Show allowed transitions and ask user what to do

## DO

- Always validate state at the start of the session
- Auto-proceed on high confidence state (no confirmation needed)
- Delegate to coordinator immediately after state validation
- Keep parent tool calls to 2-3 maximum before coordinator launch
- Use scoped calls for ALL interactive agents (not just IMPLEMENT and QA)

## DON'T

- Auto-approve anything on behalf of the user
- Read files or run scripts from the parent (coordinator handles this)
- Skip state validation
- Trust artifact detection over the state file
- Proceed if the user says the state is wrong
- Stop for context clearing at non-boundary phase transitions

## Related Commands

- `/start` - Start TDD workflow from the beginning
- `/status` - Show current progress without resuming
- `/quality-check` - Validate all 5 quality gates
