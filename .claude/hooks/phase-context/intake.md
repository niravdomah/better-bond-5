<!-- Source: .claude/agents/intake-agent.md, .claude/agents/prototype-review-agent.md, .claude/agents/intake-brd-review-agent.md — keep in sync when agent process steps change -->

## INTAKE Phase — Gather Requirements and Produce FRS

**Purpose:** Gather project requirements from the user and produce a comprehensive Feature Requirements Specification (FRS) and intake manifest. Two or three agents run sequentially:

1. **intake-agent** — Orchestrator welcomes user and routes between "share docs" (Option A), "prototype import" (Option B), or "guided Q&A" (Option C) paths; scans `documentation/`, asks checklist questions (with project context), produces the intake manifest
2. **prototype-review-agent** (v2 only) — Exports .pen design screenshots, extracts enrichments for user accept/reject, flags prototype assumptions, cross-validates specs, pre-maps genesis→FRS sections, updates manifest
3. **intake-brd-review-agent** — Reviews requirements for completeness against the FRS template, asks clarifying questions, produces the canonical FRS

## Agent Stages and Key Files

### Stage 1: intake-agent

- **Agent:** `.claude/agents/intake-agent.md`
- **Input:** `documentation/` (read-only — user-provided specs, wireframes, sample data)
- **Output:** `generated-docs/context/intake-manifest.json`
- **Process:** Orchestrator welcome + routing → (Option A: user adds docs / Option B: prototype import / Option C: user describes project) → scan docs → return findings to orchestrator → orchestrator asks checklist questions → produce manifest → orchestrator gets approval → hand off to stage 1b (v2) or stage 2

### Stage 1b: prototype-review-agent (v2 only)

- **Agent:** `.claude/agents/prototype-review-agent.md`
- **Condition:** Only runs when `context.prototypeFormat === "v2"` in the manifest
- **Input:** `generated-docs/context/intake-manifest.json`, `documentation/genesis.md`, `documentation/project.pen` (optional), `documentation/*.yaml` (OpenAPI specs)
- **Output:** `generated-docs/prototype-screenshots/*.png`, amended `generated-docs/context/intake-manifest.json` (`artifacts.wireframes.generate = false` when screenshots exported)
- **Process:** Export .pen screenshots → extract enrichments → flag assumptions → cross-validate specs → pre-map genesis→FRS sections → orchestrator shows screenshots, presents enrichments for accept/reject, confirms assumptions → hand off to stage 2

### Stage 2: intake-brd-review-agent

- **Agent:** `.claude/agents/intake-brd-review-agent.md`
- **Input:** `documentation/`, `generated-docs/context/intake-manifest.json`, `.claude/templates/feature-requirements.md`
- **Output:** `generated-docs/specs/feature-requirements.md` (canonical FRS), amended `generated-docs/context/intake-manifest.json`
- **Process:** Read inputs → review against FRS template → return gap analysis to orchestrator → orchestrator asks clarifying questions → produce FRS → orchestrator gets approval → commit → transition to DESIGN

## Determining Current Stage After Compaction

Check these files to determine where you are:

| Manifest exists? | v2 format? | Prototype review done? | FRS exists? | Current stage |
|------------------|------------|----------------------|-------------|---------------|
| No | — | — | No | **Stage 1** — Resume intake-agent |
| Yes | Yes | No | No | **Stage 1b** — Resume prototype-review-agent |
| Yes | Yes | Yes | No | **Stage 2** — Resume intake-brd-review-agent |
| Yes | No | — | No | **Stage 2** — Resume intake-brd-review-agent |
| Yes | — | — | Yes | **INTAKE complete** |

**How to check "prototype review done":** Either `generated-docs/prototype-screenshots/` contains PNG files OR `artifacts.wireframes.generate === false` in the manifest.

**File paths to check:**
- Manifest: `generated-docs/context/intake-manifest.json`
- FRS: `generated-docs/specs/feature-requirements.md`
- Prototype screenshots: `generated-docs/prototype-screenshots/*.png`

### Resuming Stage 1 (intake-agent) — via scoped calls

No manifest exists yet. If the onboarding routing (welcome + Option A/B/C choice) hasn't happened yet, start there first (see start.md Step 3). If you cannot determine whether routing has happened (e.g. after context compaction), check `workflow-state.json` for an `intakeRoute` field or the existence of any files in `generated-docs/`; if neither provides a clue, re-ask the user which path they'd like. Otherwise, resume using the scoped-call pattern (see start.md Step 4a):
- **Call A:** Scan documentation/, return structured findings
- **Orchestrator:** Ask checklist questions via AskUserQuestion
- **Call B:** Produce manifest with user answers
- **Orchestrator:** Display the manifest summary as conversation text (MANDATORY — user cannot approve what they haven't seen), THEN call AskUserQuestion for approval — if approved, proceed directly; if changes, invoke Call C
- **Call C (conditional):** Revise manifest, re-approve

### Resuming Stage 1b (prototype-review-agent) — v2 only

Manifest exists with `context.prototypeFormat === "v2"` but prototype review hasn't completed. Resume using a single scoped call (see start.md Step 4a-v2):
- **Single call:** Export screenshots, extract enrichments, flag assumptions, cross-validate, pre-map sections
- **Orchestrator:** Show screenshots, present enrichments for accept/reject, confirm assumptions

### Resuming Stage 2 (intake-brd-review-agent) — via scoped calls

Manifest exists but no FRS yet. Resume using the up-to-3-call scoped pattern (see start.md Step 4b):
- **Call A:** Read inputs, review against FRS template, return gap analysis
- **Orchestrator:** Ask clarifying questions via AskUserQuestion
- **Call B:** Produce FRS with user answers
- **Orchestrator:** Get FRS approval
- **Call C:** Finalize (commit, transition) or revise

## What Happens Next

- DESIGN phase: Ensures all artifacts are in `generated-docs/specs/` — generates missing ones, copies user-provided ones
- Then SCOPE → STORIES → per-story cycle
