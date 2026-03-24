# Shared Orchestrator Rules

These rules apply to both `/start` and `/continue` orchestrators. Both commands MUST follow everything in this file.

## Voice (mandatory)

You're a knowledgeable colleague pairing with the user. Use "I" and "we" — never refer to agents in the third person ("The intake-agent has scanned...", "The agent detected..."). When relaying what a subagent found, speak as if *you* found it: "I've gone through your docs" not "The intake-agent has scanned your documentation." Lead with what's solid, frame gaps as next steps not problems, and match the user's energy. No robot voice ("Processing complete. 3 artifacts detected."), no servile openers ("I'd be happy to help!"), no walls of text when a sentence will do. See [tone-guide.md](../agents/tone-guide.md) for full examples.

**Plain language (mandatory):** Our users are most often non-developers. All user-facing text — including acceptance criteria checklists, manual verification prompts, quality gate summaries, and status updates — must be free of technical jargon. Say "the app builds correctly" not "TypeScript compilation succeeded with zero diagnostics." Say "all automated checks passed" not "Gate 3 (ESLint + tsc) exited 0." When presenting acceptance criteria for manual testing, rephrase any developer-oriented language into what the user would actually see or do in the browser (e.g., "You should see a loading spinner while data loads" not "Verify the isLoading state renders the Skeleton component").

## User Questions (mandatory)

`AskUserQuestion` does NOT work inside Task subagents — it auto-resolves silently. Therefore, when a subagent returns with an unanswered question or needs user input relayed, YOU (the orchestrator) must use `AskUserQuestion` to present it to the user. Never relay questions as plain text output. This applies to all approval requests, clarifications, and choices throughout the workflow.

**Open-ended prompt exception:** When ONLY a free-text response is required (e.g., a project description or elevator pitch during INTAKE onboarding), use a plain-text prompt instead of `AskUserQuestion`. This avoids forcing the user to pick from predefined options when the answer is inherently open-ended.

## User Approval Policy (CRITICAL)

**NEVER auto-approve on behalf of the user.** When an agent returns with work that needs approval:

1. **STOP** and output the proposed content as **regular conversation text** so the user can read it
2. **Then** use `AskUserQuestion` to get explicit approval — never rely on plain text questions for the approval prompt itself
3. **Only proceed** after receiving actual user confirmation via `AskUserQuestion`

**Steps 1 and 2 are separate actions.** The content display (step 1) is regular text output. The approval prompt (step 2) is an `AskUserQuestion` call. Never combine them — the user must see the content before the approval prompt appears.

**Examples of what NOT to do:**
- "The feature-planner proposed 3 epics. Let me continue..." (auto-approving)
- "Epics look good, proceeding to stories..." (auto-approving)
- Spawning another Task to auto-approve
- Writing a question as plain text and hoping the user responds
- Calling `AskUserQuestion` with "Does this look right?" **without first outputting what "this" refers to** — the user sees only the question with no content to review

**Examples of correct behavior:**
- Output the summary/content as regular text, **then** call `AskUserQuestion`: "Does this breakdown look right?"
- Wait for the user to respond via the `AskUserQuestion` prompt
- Only then continue to the next phase

**Fallback if agent return is empty or unclear:** If a subagent returns without a clear summary but wrote a file (e.g., the intake manifest), read that file and construct the summary yourself before calling `AskUserQuestion`. The user must always see concrete content before approving.

## Context Management Policy

Context clearing happens at **5 mandatory boundaries** where significant work completes and the next chunk is independent. The user must run `/clear` then `/continue` at each.

| # | Boundary | Handled by |
|---|----------|------------|
| 1 | INTAKE complete (FRS and manifest produced) | Orchestrator instructs the user |
| 2 | DESIGN complete (all artifacts generated/copied) | Orchestrator instructs the user |
| 3 | Epic list approval (SCOPE complete) | Orchestrator instructs the user |
| 4 | Story QA complete | Code-reviewer return message (display and stop) |
| 5 | Epic completion (last story in epic) | Code-reviewer return message (display and stop) |

**Boundaries #1-3:** You (the orchestrator) instruct the user to run `/clear` then `/continue`.

**Boundaries #4-5:** The code-reviewer's return message already contains the clearing instruction. Display it to the user and **STOP** — do not launch the next agent. The user's `/clear` + `/continue` handles resumption.

**All other phase transitions proceed directly** — launch the next agent without stopping. This includes: STORIES → REALIGN, REALIGN → TEST-DESIGN, WRITE-TESTS → IMPLEMENT, IMPLEMENT → QA. Note: TEST-DESIGN → WRITE-TESTS has an **approval gate** (user reviews the test-design document) but is **not** a context-clearing boundary.

**Post-compaction safety net:** If auto-compaction fires, the `inject-phase-context.ps1` hook automatically restores workflow state and phase-specific instructions via `additionalContext`. This covers both the orchestrator and subagent sessions.

## Dashboard Update Policy

The HTML dashboard (`generated-docs/dashboard.html`) is regenerated at workflow milestones. The browser auto-refreshes every 10 seconds via `<meta http-equiv="refresh">`, so users see updates automatically if the dashboard is open. These updates are **non-blocking** — a failure must never halt the workflow.

### When to update

| Trigger | When | How |
|---------|------|-----|
| End of INTAKE | After BRD agent returns (boundary #1) | Fire-and-forget before `/clear` instruction |
| During DESIGN | After each agent completes (via `--design-agent complete`) | Fire-and-forget inline |
| End of DESIGN | After all agents complete (boundary #2) | Fire-and-forget before `/clear` instruction |
| End of SCOPE | After epic list approved (boundary #3) | Fire-and-forget before `/clear` instruction |
| End of STORIES | After story list approved and written | Fire-and-forget inline |
| After REALIGN | After transition to TEST-DESIGN | Fire-and-forget inline |
| After TEST-DESIGN | After test-designer returns | Fire-and-forget inline |
| After WRITE-TESTS | After test-generator returns | Fire-and-forget inline |
| After IMPLEMENT | After developer Call B returns | Fire-and-forget inline |
| After QA pass | After code-reviewer returns (boundaries #4-5) | Fire-and-forget before displaying return message |

### How to fire

Run the generator script directly — no subagent needed:

```bash
node .claude/scripts/generate-dashboard-html.js --collect
```

This is a single synchronous command (~100ms) that reads workflow state and writes the HTML file. If it fails, log a warning but do not throw. The workflow continues regardless.

**The `/dashboard` command (user-triggered) is the exception** — it also opens the HTML in the browser. See `.claude/commands/dashboard.md`.

## Git Push Authorization (mandatory)

Agents are explicitly authorized to run `git push origin main` at designated workflow milestones. These pushes are a required part of the workflow — they back up completed work to the remote and must not be skipped, deferred, or gated behind additional confirmation. The user has already approved the underlying work (FRS, epics, stories, implementation) via `AskUserQuestion` before the push runs.

**Designated push points** (agents that include `git push origin main` in their instructions):
- `intake-brd-review-agent` Call C — after INTAKE finalize
- `feature-planner` SCOPE Call B — after epic list approved
- `feature-planner` STORIES Call B — after story list approved
- `code-reviewer` Call C — after QA passes

When an agent's instructions say to push, **execute the push command directly**. Do not add warnings, ask for confirmation, or skip it. If the push fails (e.g., no remote configured, authentication error), report the error to the user but do not retry — let them resolve it.

## Scoped Call Pattern

All interactive agents are invoked using scoped calls — multiple focused Task invocations separated by orchestrator-driven `AskUserQuestion` prompts. Agents return structured results; the orchestrator handles all user communication.

**Key rules for every scoped call:**
- Tell the agent which call it is (e.g., "This is Call A — scan only")
- Tell the agent what NOT to do (e.g., "Do NOT commit. Do NOT use AskUserQuestion.")
- After the agent returns, the orchestrator owns the next step (display results, ask user, launch next call)

**Per-phase call patterns:**

| Agent | Phase | Calls | Orchestrator Interaction Points |
|-------|-------|-------|-------------------------------|
| intake-agent | INTAKE | A (scan) + B (manifest) + C (revise, conditional) | Onboarding routing + optional project description + 3 checklist Qs + optional spec-completeness Q + optional wireframe Q + approval |
| prototype-review-agent | INTAKE (v2 only) | 1 (single call) | Screenshots display + enrichment accept/reject + assumption confirmation |
| intake-brd-review-agent | INTAKE | A (gap analysis) + B (produce FRS) + C (finalize) | 0-8 clarifying Qs + approval |
| design-api-agent | DESIGN | A (design spec) + B (commit/revise) | 1 approval |
| mock-setup-agent | DESIGN | A (handlers) + B (infrastructure) | 0 (fully autonomous) |
| type-generator-agent | DESIGN | 1 (single, autonomous) | 0 (fully autonomous) |
| design-style-agent | DESIGN | A (design tokens) + B (commit/revise) | 1 approval |
| design-wireframe-agent | DESIGN | A (screen list) + B (wireframes) + C (commit) | 2 approvals |
| feature-planner (SCOPE) | SCOPE | A (propose epics) + B (write/commit) | 1 approval |
| feature-planner (STORIES) | STORIES | A (propose stories) + B (write/commit) | 1 approval |
| feature-planner (REALIGN) | REALIGN | A (check/propose) + B (apply, conditional) | 0 or 1 approval |
| test-designer | TEST-DESIGN | A (design) + B (transition/revise) | 1 approval |
| test-generator | WRITE-TESTS | 1 (single, unsplit) | 0 (fully autonomous) |
| developer | IMPLEMENT | A (implement) + B (pre-flight test check) | 0 (fully autonomous) |
| code-reviewer | QA | A (review) + B (gates + checklist) + C (commit) | 1 manual verification |

## DESIGN Artifact-to-Agent Mapping

For each artifact in the intake manifest, apply this decision logic:

**If `artifact.generate == true`:** Invoke the corresponding agent using scoped calls. If `artifact.userProvided` is also set, include it in the agent prompt as reference input.

**Else if `artifact.userProvided != null` (but `generate == false`):** Copy the user-provided file to `generated-docs/specs/` with a `# Source: <original-path>` header prepended, using the copy script:
```bash
node .claude/scripts/copy-with-header.js --from "<userProvided-path>" --to "generated-docs/specs/<target-filename>"
```
No agent invocation needed.

**Else (generate == false, no userProvided):** Skip — this artifact is not needed.

| Manifest artifact(s) | Agent | Output path |
|----------------------|-------|-------------|
| `apiSpec` | `design-api-agent` | `generated-docs/specs/api-spec.yaml` |
| `apiSpec.mockHandlers` | `mock-setup-agent` | `web/src/mocks/` + `web/.env.local` |
| `apiSpec` (when spec exists) | `type-generator-agent` | `web/src/types/api-generated.ts` + `web/src/lib/api/endpoints.ts` |
| `designTokensCss` + `designTokensMd` | `design-style-agent` | `generated-docs/specs/design-tokens.css` + `generated-docs/specs/design-tokens.md` |
| `wireframes` | `design-wireframe-agent` | `generated-docs/specs/wireframes/` |

**`mockHandlers` special case:** Run `mock-setup-agent` after `design-api-agent` completes (or after copying the user's complete spec) when `artifacts.apiSpec.mockHandlers == true`. This agent is fully autonomous — no approval needed.

**`type-generator-agent` special case:** Run `type-generator-agent` after `design-api-agent` completes (or after copying the user's complete spec) whenever an `api-spec.yaml` exists. This agent is fully autonomous — no approval needed. It generates TypeScript types and typed endpoint functions from the spec.

**Special case — design-style-agent:** `designTokensCss` and `designTokensMd` both map to the same agent. Invoke `design-style-agent` **once** if either has `generate == true`. The agent reads both manifest entries internally. If one has `generate == false` with `userProvided` set, copy that file using the copy script before invoking the agent for the other:
```bash
node .claude/scripts/copy-with-header.js --from "<userProvided-path>" --to "generated-docs/specs/<target-filename>"
```

## DESIGN Execution Model — Parallel Call A

DESIGN agents are launched in parallel where dependencies allow. The only hard ordering constraint is: `mock-setup-agent` must run after `design-api-agent` (it reads `api-spec.yaml`). All other agents read only from INTAKE outputs (FRS + manifest) and have no cross-dependencies.

### Step 1 — Determine which agents need to run

Read the intake manifest and apply the artifact-to-agent mapping above. Build three lists:

- **`agentsToRun`**: agents where `generate == true` — any combination of: `design-api-agent`, `design-style-agent`, `design-wireframe-agent`. **E6 wireframe skip:** If `artifacts.wireframes.generate == false` (set by prototype-review-agent when .pen screenshots exist), do NOT include `design-wireframe-agent` — the .pen screenshots serve as wireframes.
- **`filesToCopy`**: artifacts where `generate == false` and `userProvided != null`. **P9 multi-spec:** When `artifacts.apiSpec.userProvided` is an array, copy each spec file individually.
- **`mockNeeded`**: boolean — `artifacts.apiSpec.mockHandlers == true`

**Register expected agents for dashboard tracking:**

After determining which agents will run, call `--design-agent set` with the full lists:

```bash
node .claude/scripts/transition-phase.js --design-agent set "<agentsToRun comma-separated>" --autonomous "<autonomous agents comma-separated>"
```

Only include agents that actually need to run. Example:
```bash
node .claude/scripts/transition-phase.js --design-agent set "design-api-agent,design-style-agent" --autonomous "mock-setup-agent,type-generator-agent"
```

### Step 2 — Copy user-provided files first

Run `copy-with-header.js` for each entry in `filesToCopy`. This must complete before launching agents that might reference copied files.

### Step 3 — Launch all Call A invocations in parallel

For every agent in `agentsToRun`, launch its Call A as a parallel `Agent` invocation **in a single tool-use message**. Use the Call A prompts defined in the DESIGN Scoped Calls section below — no changes to agent prompts are needed.

If only 1 or 2 agents need to run, launch whatever is needed simultaneously. Even a single agent is launched the same way — the model is the same regardless of count.

### Step 4 — Collect results and present approvals sequentially

Once **all** parallel agents have returned, present summaries and collect approvals in this fixed order (skipping agents that didn't run):

1. API spec
2. Design tokens + style guide
3. Screen list (wireframes)

For each: display the summary as regular text, then call `AskUserQuestion` for approval.

**Revision loops:** If the user requests changes to one agent's output, re-launch only that agent's Call A with the feedback. The other agents' approved results are held in conversation context — they do not need to re-run. After the revised agent returns, re-present its summary and re-ask approval. Only move to the next agent's approval after the current one is approved.

### Step 5 — Launch post-approval Call B invocations

Once all approvals are collected, launch Call B for `design-api-agent` and `design-style-agent` **in parallel** (they write to different files — no conflicts):

- API Call B writes to `generated-docs/specs/api-spec.yaml`
- Style Call B writes to `generated-docs/specs/design-tokens.*` and `web/src/app/globals.css`

**After each Call B returns**, mark the agent as complete and fire a dashboard refresh:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "design-api-agent"
node .claude/scripts/transition-phase.js --design-agent complete "design-style-agent"
```

**Dashboard update (fire-and-forget):** After each `--design-agent complete` call above, run `node .claude/scripts/generate-dashboard-html.js --collect`. See [Dashboard Update Policy](#dashboard-update-policy).

**Do NOT include `design-wireframe-agent` in this batch** — it has a multi-step flow (Call B generates wireframes → another approval → Call C commits).

### Step 6 — Handle wireframe Call B and mock-setup-agent

After the parallel Call B batch completes:

- **If `mockNeeded` and `api-spec.yaml` now exists on disk:** Launch `mock-setup-agent` Call A. Since mock-setup is fully autonomous (no approvals), it can run **in the foreground while wireframe approval is being collected** — launch mock Call A, then immediately launch wireframe Call B without waiting for mock to finish.
- **If `api-spec.yaml` exists on disk:** Launch `type-generator-agent` (single autonomous call). This can run **in parallel** with mock-setup-agent and wireframe Call B — it reads `api-spec.yaml` (read-only) and writes to `web/src/types/api-generated.ts` + `web/src/lib/api/endpoints.ts`, which have no file conflicts with either agent.
- **Launch `design-wireframe-agent` Call B** with the approved screen list. When it returns, present the wireframe summary, collect approval, then launch Call C (commit).

All three write to completely different file paths — no conflicts:
- type-generator-agent → `web/src/types/api-generated.ts`, `web/src/lib/api/endpoints.ts`
- mock-setup-agent → `web/src/mocks/`, `web/.env.local`
- wireframe agent → `generated-docs/specs/wireframes/`

**After each autonomous agent returns**, mark it complete:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "mock-setup-agent" --autonomous
node .claude/scripts/transition-phase.js --design-agent complete "type-generator-agent" --autonomous
```

**After wireframe Call C returns**, mark wireframes complete:
```bash
node .claude/scripts/transition-phase.js --design-agent complete "design-wireframe-agent"
```

**Dashboard update (fire-and-forget):** After each `--design-agent complete` call above, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After wireframe Call C returns, mock-setup-agent has completed both its calls, and type-generator-agent has returned, proceed to Finalize DESIGN.

### Step 7 — Finalize DESIGN

See the [Finalize DESIGN](#finalize-design) section below (unchanged).

## Per-Phase Scoped Call Prompts

These are the full call prompts for each phase. Both `/start` and `/continue` reference these when invoking agents.

### DESIGN Scoped Calls

**design-api-agent (2 calls):**

Call A: `"This is Call A — Design the API Spec. Read the FRS and manifest, design a complete OpenAPI specification, and write it to generated-docs/specs/api-spec.yaml. Return a human-readable summary of endpoints and models. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display summary. Adjust the approval question based on `context.dataSource`:
- **If `api-in-development`:** `AskUserQuestion`: "Here's the API spec — endpoints from your backend team are marked as user-provided, and any gaps I filled for mock coverage are marked as inferred. You can run `/api-status` at any time to see endpoint provenance, mock status, and drift detection. Any corrections before we proceed?" Options: "Looks good" / "I have corrections"
- **Otherwise:** `AskUserQuestion`: "How does this API design look?" Options: "Looks good" / "I have changes"

Call B (approved): `"This is Call B — Commit. The user approved the API spec. Commit and return completion message. Do NOT use AskUserQuestion."`
Call B (changes): `"This is Call B — Revise. Apply these changes: [feedback]. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

**mock-setup-agent (2 calls — fully autonomous, no approval needed):**

Only invoke when `artifacts.apiSpec.mockHandlers == true`.

Call A: `"This is Call A — Generate Handlers. Read generated-docs/specs/api-spec.yaml and generated-docs/context/intake-manifest.json. Load sample data if context.sampleData is set. Generate web/src/mocks/handlers.ts with realistic mock data. Write generated-docs/context/mock-data-context.md documenting data conventions. Save a copy of the spec to generated-docs/context/mock-spec-snapshot.yaml. Do NOT set up browser infrastructure yet. Do NOT commit. Do NOT use AskUserQuestion."`

Call B: `"This is Call B — Infrastructure Setup. Create web/src/mocks/browser.ts, web/src/components/MockProvider.tsx. Modify web/src/app/layout.tsx to conditionally render MockProvider when NEXT_PUBLIC_USE_MOCK_API is true. Add NEXT_PUBLIC_USE_MOCK_API=true to web/.env.local. Run: cd web && npx msw init public/ --save. Do NOT commit. Do NOT use AskUserQuestion."`

After Call B returns, proceed directly to the next DESIGN artifact (no user interaction required).

**design-style-agent (2 calls):**

Call A: `"This is Call A — Design Tokens + Style Guide. Read the FRS, manifest, and styling notes. Formalize into CSS design tokens and a style reference guide. Write to generated-docs/specs/. Return a summary. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display summary. `AskUserQuestion`: "How do the design tokens and style guide look?" Options: "Looks good" / "I have changes"

Call B (approved): `"This is Call B — Commit. The user approved the design tokens and style guide. Integrate the CSS tokens into globals.css (add @import at top, remove Shadcn default :root/.dark blocks), commit, and return completion message. Do NOT use AskUserQuestion."`
Call B (changes): `"This is Call B — Revise. Apply these changes: [feedback]. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

**design-wireframe-agent (3 calls):**

Call A: `"This is Call A — Screen List Only. Read the FRS and identify all screens needed. [IF prototype source exists: Also read the prototype source at documentation/prototype-src/ to derive the screen list from the actual React page components and routing structure. Cross-reference with the FRS to ensure coverage.] Return the proposed screen list with descriptions. Do NOT generate wireframes yet. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display screen list. `AskUserQuestion`: "Does this screen list cover everything?" Options: "Looks good, go ahead" / "I have changes"

If "I have changes": collect feedback, re-launch Call A with the feedback included.

Call B: `"This is Call B — Generate Wireframes. Here is the approved screen list: [paste]. [IF prototype source exists: Use the React component structure at documentation/prototype-src/ as the primary layout reference — read each page component and its children to produce wireframes that accurately reflect the prototype's layout, interactions, and data display patterns.] Generate text-based wireframes for each screen, write files to generated-docs/specs/wireframes/. Return a summary. Do NOT commit. Do NOT use AskUserQuestion."`

Orchestrator: Display wireframe summary. `AskUserQuestion`: "How do the wireframes look?" Options: "Looks good" / "I have changes"

If "I have changes": collect feedback. `"This is Call B — Revise Wireframes. The user wants these changes: [feedback]. Update the wireframe files accordingly. Return updated summary. Do NOT commit. Do NOT use AskUserQuestion."` Then re-approve.

Call C: `"This is Call C — Commit. The user approved the wireframes. Commit all wireframe files and return completion message. Do NOT use AskUserQuestion."`

**Prototype source conditional:** The `[IF prototype source exists: ...]` clauses in Call A and Call B above are conditional. Before invoking the wireframe agent, check the intake manifest for `context.prototypeSource`. If it exists, include the bracketed text in your prompt (removing the brackets and the IF prefix). If it does not exist, omit the bracketed text entirely.

**Parallel execution:** Follow the [DESIGN Execution Model — Parallel Call A](#design-execution-model--parallel-call-a) section above for the launch sequence. Do NOT run agents sequentially — launch all Call A invocations in a single tool-use message, then handle approvals and Call B invocations as described in the execution model.

### Finalize DESIGN

After all agents complete (or all copies are done):

1. If any files were copied (not generated by agents), commit them:
   ```bash
   git add generated-docs/specs/ .claude/logs/ && git commit -m "chore(design): copy user-provided artifacts to specs"
   ```
2. Transition state from DESIGN to SCOPE:
   ```bash
   node .claude/scripts/transition-phase.js --to SCOPE --verify-output
   ```

**If no artifacts needed generation AND no files needed copying:** Print a confirmation ("No DESIGN artifacts needed — all skipped per manifest.") and transition directly to SCOPE.

**Dashboard update (fire-and-forget):** Before instructing the user to clear, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the finalized DESIGN state.

This is **clearing boundary #2**. Instruct user to `/clear` then `/continue`.

### SCOPE (2 scoped calls)

**Call A — Propose Epics:**

Launch `feature-planner` with prompt:
> "This is Call A — Propose Epics. You are in SCOPE mode. Read the FRS at [spec path] and propose an epic breakdown. Return the epic list with descriptions and dependency map. Do NOT write any files. Do NOT commit. Do NOT use AskUserQuestion."

**Orchestrator:** Display the epic list. Use `AskUserQuestion`:
- "Does this breakdown look right?"
- Options: "Looks good" / "I'd restructure"

If "I'd restructure": collect feedback, re-launch Call A with the feedback included.

**Call B — Write + Commit:**

> "This is Call B — Write and Commit. The user approved this epic breakdown: [paste approved list]. Write _feature-overview.md, update CLAUDE.md Project Overview section. Commit and push. Run the state transition."

After Call B returns:

**Dashboard update (fire-and-forget):** Fire a background dashboard refresh per the [Dashboard Update Policy](#dashboard-update-policy). This captures the new epic structure.

This is **clearing boundary #3**. Instruct user to `/clear` then `/continue`.

### STORIES (2 scoped calls)

**Call A — Propose Stories:**

Launch `feature-planner` with prompt:
> "This is Call A — Propose Stories. You are in STORIES mode for Epic [N]. Read the FRS and epic overview. Propose stories for this epic with descriptions. Return the story list. Do NOT write story files. Do NOT commit."

**Orchestrator:** Display the story list. Use `AskUserQuestion`:
- "Does this look right for Epic [N]?"
- Options: "Looks good" / "I'd change things"

If changes: collect feedback, re-launch Call A.

**Call B — Write Acceptance Criteria + Commit:**

> "This is Call B — Write Stories and Commit. The user approved these stories: [paste approved list]. Write story files with full acceptance criteria, create _epic-overview.md. Commit and push. Run the state transition."

After Call B returns:

**Dashboard update (fire-and-forget):** Fire a background dashboard refresh per the [Dashboard Update Policy](#dashboard-update-policy). This captures the newly defined stories.

Proceed directly to REALIGN for the first story (not a clearing boundary).

### REALIGN (1-2 scoped calls)

**Call A — Check Impacts:**

Launch `feature-planner` with prompt:
> "This is Call A — Check Impacts. You are in REALIGN mode for Epic [N], Story [M]. Read discovered-impacts.md. If no impacts exist, return 'No impacts — auto-completed.' If impacts exist, analyze them and return proposed revisions to the story."

**Orchestrator:**
- If "No impacts — auto-completed": run the state transition yourself, then proceed directly to TEST-DESIGN (no user interaction):
  ```bash
  node .claude/scripts/transition-phase.js --current --story M --to TEST-DESIGN --verify-output
  ```
- If revisions proposed: display them, use `AskUserQuestion`:
  - "Does this revision make sense?"
  - Options: "Yes, looks good" / "I'd change it"

**Call B — Apply Revisions (only if impacts existed and were approved):**

> "This is Call B — Apply Revisions. Apply these approved revisions: [paste]. Update the story file, clear processed impacts, commit. Run the state transition."

**Dashboard update (fire-and-forget):** After REALIGN completes (whether auto-completed or after Call B), regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the current story's phase progression.

After REALIGN completes, proceed directly to TEST-DESIGN.

### TEST-DESIGN (2 scoped calls)

**Call A — Design Test Scenarios:**

Launch `test-designer` with prompt:
> "This is Call A — Design Test Scenarios for Epic [N], Story [M]. Story file: [path]. Produce a specification-by-example document for BA review and downstream test generation. You MUST follow the Required Template defined in your agent instructions — use Setup/Input/Expected tables (NOT Given/When/Then), and include ALL required sections: Story Summary, Review Purpose, Business Behaviors Identified, Key Decisions Surfaced by AI, Test Scenarios / Review Examples, Edge and Alternate Examples, Out of Scope, Coverage for WRITE-TESTS (AC → example mapping), and Handoff Notes for WRITE-TESTS. Write the document to generated-docs/test-design/. Return a summary listing scenario titles, counts (main examples, edge examples, BA decisions required), and any key ambiguities. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

**Orchestrator:** Read the full generated test-design document from `generated-docs/test-design/` and display its complete contents to the user (not just the agent's summary). Always include a clickable markdown link to the full document file (e.g., `[epic-N-story-M-title.md](generated-docs/test-design/epic-N-story-M-title.md)`) so the user can open it directly. The user needs to review every scenario table and decision to make an informed approval. Use `AskUserQuestion`:
- "How does this test design look for [Story Name]?"
- Options: "Looks good" / "I have changes"

If "I have changes": collect feedback, re-launch Call A with feedback:
> "This is Call A — Revise Test Design for Epic [N], Story [M]. Story file: [path]. Apply these changes: [feedback]. Update the test-design document at [test-design path]. Return updated summary. Do NOT run the transition script. Do NOT commit. Do NOT use AskUserQuestion."

Then re-read the full updated document, present it to the user, and re-ask approval.

**Call B — Transition (after approval):**

> "This is Call B — Transition. The user approved the test design for Epic [N], Story [M]. Run the transition script to move to WRITE-TESTS. Do NOT use AskUserQuestion."

**Dashboard update (fire-and-forget):** After Call B returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After Call B returns, proceed directly to WRITE-TESTS.

### WRITE-TESTS (single call — fully autonomous)

Launch `test-generator` with prompt:
> "Generate tests for Epic [N], Story [M]. Story file: [path]. Test design: [path to test-design doc in generated-docs/test-design/]. Write failing tests that define acceptance criteria as executable code."

**Dashboard update (fire-and-forget):** After the test-generator returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After it returns, proceed directly to IMPLEMENT.

### IMPLEMENT (2 scoped calls)

Before invoking `developer`, run `npm test` in `/web` to identify failing tests for the current story. Show the user which tests are failing and include the output when handing off.

**Call A — Implement:**

> "This is Call A — Implement. Read the story at [path] and tests at [path]. Here are the current failing tests: [paste output]. Write code to make all failing tests pass. Do NOT run quality gates in this call."

**Call B — Pre-flight Test Check:**

> "This is Call B — Pre-flight Test Check. Run `npm test` to verify all tests pass. Fix any failures. Do NOT run lint, build, or test:quality — the code-reviewer handles the full canonical quality gate suite during QA. Do NOT commit."

**Dashboard update (fire-and-forget):** After developer Call B returns, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy).

After Call B returns, proceed directly to QA.

### QA (3 scoped calls)

**Call A — Code Review:**

Launch `code-reviewer`:
> "This is Call A — code review only. Do NOT run quality gates or commit."

**Call B — Quality Gates:**

Launch `code-reviewer`:
> "This is Call B — run quality gates and return results. Also read the story file and return the manual verification checklist as text in your response. Do NOT commit. Just return the gate results and the checklist."

**Orchestrator — Manual Verification:**

After Call B returns:
1. Display the quality gate results to the user (in plain, non-technical language)
2. Check if Call B's response indicates a **non-routable component** (Route: `N/A`)

**If non-routable (component only):**
3. Display Call B's component-only note to the user
4. Auto-proceed to Call C with verification status `auto-skipped` — do NOT ask the user to verify in the browser (they can't reach the component yet)

**If routable:**
3. Display the manual verification checklist from Call B's response (including any deferred verification items from earlier stories)
4. Use `AskUserQuestion` directly:
   - "Have you verified [Story Name] in the browser?"
   - Options: "All tests pass" / "Issues found" / "Skip for now"
5. If "All tests pass" or "Skip for now": proceed to Call C
6. If "Issues found": follow the **QA Fix Cycle** below

#### QA Fix Cycle (Issues Found)

**CRITICAL:** The orchestrator must NEVER fix issues directly — this triggers the hook-dispatch bug. Always delegate to a coordinator subagent.

When the user selects "Issues found":

1. Use `AskUserQuestion`: "What did you find? Describe the issues so I can fix them."
2. After user responds → **new turn with fresh hooks** → launch a **new coordinator** with prompt:

   ```
   You are a QA fix-cycle coordinator. The user found issues during manual verification.

   ## Issues Reported
   [paste user's description]

   ## Current State
   [paste state JSON]

   ## Your Tasks
   1. Launch developer agent to fix the reported issues:
      "Fix these issues in Epic [N], Story [M]: [issues]. Do NOT run quality gates. Do NOT commit. Do NOT use AskUserQuestion."
   2. After the developer returns, launch code-reviewer Call A:
      "This is Call A — code review only. Do NOT run quality gates or commit."
   3. After Call A returns, launch code-reviewer Call B:
      "This is Call B — run quality gates and return results. Also read the story file and return the manual verification checklist as text. Do NOT commit."
   4. Return with "NEEDS_APPROVAL:" followed by the updated gate results, the manual verification checklist, and: "Have you re-verified [Story Name] in the browser? Options: All tests pass / Issues found / Skip for now"

   Follow all rules in orchestrator-rules.md — especially scoped call patterns and voice guidelines.
   Do NOT use AskUserQuestion — return NEEDS_APPROVAL instead.
   Do NOT commit or run transition scripts.
   ```

3. When the fix coordinator returns with NEEDS_APPROVAL → display results → use `AskUserQuestion` with the same options as before
4. If user selects "Issues found" again → repeat from step 1 (each cycle gets a fresh turn with fresh hooks)
5. If "All tests pass" or "Skip for now" → proceed to Call C, noting that a fix cycle occurred (see below)

**Call C — Commit:**

Pass the verification status into Call C so it can record it in workflow state. **Adjust the prompt based on whether a QA fix cycle occurred:**

If **no fix cycle** occurred (user confirmed on first attempt or auto-skipped):

> "The user confirmed manual verification. Status: [passed|auto-skipped|skipped]. [If deferred stories were included in the checklist and the user confirmed: Also mark stories N, M as deferred-passed.] IMPORTANT: Before staging, run `node .claude/scripts/transition-phase.js --pre-complete-checks --current --story M` (replacing M with the story number) to auto-check all acceptance criteria in the story file. Then proceed to commit and transition to COMPLETE. Do NOT run quality gates again — they already passed before manual verification."

If a **fix cycle occurred** (code was changed during QA):

> "The user confirmed manual verification after a QA fix cycle. Status: [passed|skipped]. [If deferred stories were included in the checklist and the user confirmed: Also mark stories N, M as deferred-passed.] IMPORTANT: Before staging, run `node .claude/scripts/transition-phase.js --pre-complete-checks --current --story M` (replacing M with the story number) to auto-check all acceptance criteria in the story file. Code was changed during the fix cycle, so you MUST re-run all quality gates before committing. If any gate fails, fix the issue and re-run until all gates pass. Then proceed to commit and transition to COMPLETE."

**After Call C returns:**

**Dashboard update (fire-and-forget):** Before displaying the code-reviewer's return message, regenerate the HTML dashboard per the [Dashboard Update Policy](#dashboard-update-policy). This captures the completed story's final state.

Display its return message and **STOP**. The message contains the `/clear` + `/continue` instruction. Do not launch the next agent.

## COMPLETE — Next Step Routing

After a story's QA phase commits and the user runs `/clear` + `/continue`, the transition script determines what's next:

- More stories in epic → Proceed to REALIGN for next story
- No more stories but more epics → Proceed to STORIES for next epic
- No more stories and no more epics → Display success message - feature complete!

## TodoWrite Progress Display

After initializing or validating workflow state, display the TodoWrite progress list:

```bash
node .claude/scripts/generate-todo-list.js
```

Parse the JSON output and call `TodoWrite` with the resulting array. This gives the user an immediate visual of the workflow phases.

**After each agent completes and returns to you**, re-run this script and update TodoWrite to reflect the new state. This keeps the progress display current throughout the workflow.

**`/continue` dispatcher note:** When using the dispatcher pattern, the coordinator subagent handles TodoWrite reconstruction — the parent orchestrator must NOT call TodoWrite directly (to stay within the 2–3 tool call limit).

## Script Execution Verification

**All transition scripts output JSON. Always verify the result before proceeding:**

1. `"status": "ok"` = Success, proceed to next step
2. `"status": "error"` = **STOP**, report the error to the user
3. `"status": "warning"` = Proceed with caution, inform user

**Troubleshooting:**
- Check current state: `node .claude/scripts/transition-phase.js --show`
- Validate artifacts: `node .claude/scripts/validate-phase-output.js --phase <PHASE> --epic <N>`
- Repair if needed: `node .claude/scripts/transition-phase.js --repair`

## FRS-Over-Template Rule (CRITICAL)

The FRS (`generated-docs/specs/feature-requirements.md`) and story acceptance criteria are the **sole source of truth** for how features should be implemented. This repository was scaffolded from a starter template that includes default implementations (NextAuth, demo login pages, placeholder layouts, etc.) that may **conflict** with spec requirements.

**Before every WRITE-TESTS and IMPLEMENT invocation**, include this reminder in the agent prompt:

> "IMPORTANT: The FRS and story acceptance criteria override any pre-existing template code in the repo. If the spec requires a different approach than what the template provides (e.g., BFF auth instead of NextAuth), you must replace the template code — not extend it. Read the story and FRS requirements before looking at existing code."

**Why this exists:** In an earlier session, the developer agent built on the existing NextAuth template instead of implementing BFF auth as the FRS required (`R1: The Next.js app does not render a custom login page`). This caused multiple QA fix cycles. Template code is a starting point, not a constraint.

## Commit Policy

**IMPORTANT:** To avoid loss of work, create commits at every logical point:

- After INTAKE phase completes (FRS and manifest produced)
- After SCOPE phase completes (epics defined)
- After STORIES phase completes for each epic
- After each story's QA phase passes (commit includes tests + implementation)
- After creating multiple files (e.g., after every 2-3 wireframes)
- Before handing off to another agent

Each story is committed AFTER its QA phase passes, not after IMPLEMENT.

### Commit Message Format (Conventional Commits)

All commit messages MUST follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Description** must be lowercase, imperative mood ("add", not "added" or "adds"), and not end with a period.

**Allowed types:**

| Type | When to use |
|------|-------------|
| `feat` | New user-facing functionality (story implementation) |
| `fix` | Bug fix (story implementation when the story is a bug fix) |
| `docs` | Documentation-only changes (INTAKE, DESIGN, SCOPE, STORIES, REALIGN artifacts) |
| `refactor` | Code restructuring with no behavior change |
| `test` | Adding or updating tests only |
| `chore` | Housekeeping — copying artifacts, config changes, dependency updates |

**Scope conventions by workflow phase:**

| Phase | Scope | Example |
|-------|-------|---------|
| INTAKE | `intake` | `docs(intake): produce feature requirements specification` |
| DESIGN | `design` | `docs(design): generate OpenAPI spec for dashboard` |
| SCOPE | `scope` | `docs(scope): define epics for dashboard` |
| STORIES | `stories` | `docs(stories): add stories for epic 1 — user management` |
| REALIGN | `realign` | `docs(realign): update story 2 based on implementation learnings` |
| QA (story commit) | `epic-N` | `feat(epic-1): story 2 — add user profile page` |

**Story commits (QA phase)** use `feat`, `fix`, or `refactor` depending on the story's nature, with the epic as scope:

```
feat(epic-1): story 2 — add user profile page

- Implemented: profile card, avatar upload, edit form
- Tests: all passing
- Quality gates: all passing
- Manual verification: passed | auto-skipped (component only) | skipped

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Breaking changes** are indicated by appending `!` after the scope or by adding a `BREAKING CHANGE:` footer:

```
feat(epic-2)!: story 3 — replace legacy auth with OAuth2
```