# Claude Code Agents

This directory contains specialized Claude Code agents that support a **Test-Driven Development (TDD)** workflow for building features in this template repository.

## TDD Workflow Overview

```
INTAKE (once) → DESIGN (once) → SCOPE (epics only) → [STORIES → [REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA] per story] per epic
```

**Expanded view:**
```
[intake-agent] → [prototype-review-agent (v2 only)] → [intake-brd-review-agent] → [design-api-agent] → [design-style-agent] → [design-wireframe-agent] → [type-generator-agent] → feature-planner → feature-planner → feature-planner → test-designer → test-generator → developer → code-reviewer
                           INTAKE                                                                                DESIGN (conditional per manifest)                                    SCOPE           STORIES           REALIGN          TEST-DESIGN      WRITE-TESTS    IMPLEMENT       QA
                      (2-3 agents, once)                                                                       (up to 4 agents, mandatory, once)                                   (all epics)       (per epic)       (per story)        (per story)      (per story)   (per story)   (per story)
```

| Phase | Agent | Description |
|-------|-------|-------------|
| **INTAKE** | intake-agent | Onboarding routing (share docs, prototype import, or guided Q&A), scan docs, gather basics, produce intake manifest (once) |
| **INTAKE** | prototype-review-agent | (v2 only) Export .pen screenshots, extract enrichments, flag assumptions, cross-validate specs, pre-map genesis→FRS (once) |
| **INTAKE** | intake-brd-review-agent | Review requirements completeness, produce FRS (once) |
| **DESIGN** | design-api-agent | Generate OpenAPI spec from feature requirements (conditional per manifest) |
| **DESIGN** | design-style-agent | Generate CSS design tokens and style reference guide (conditional per manifest) |
| **DESIGN** | design-wireframe-agent | Generate text-based wireframes for UI screens (conditional per manifest) |
| **DESIGN** | type-generator-agent | Generate TypeScript types and typed endpoint functions from OpenAPI spec (conditional — when spec exists) |
| **SCOPE** | feature-planner | Define ALL epics upfront (no stories yet) |
| **STORIES** | feature-planner | Define stories for the current epic only |
| **REALIGN** | feature-planner | Revise upcoming story based on discovered impacts (per story) |
| **TEST-DESIGN** | test-designer | Design specification-by-example test scenarios for BA review (per story) |
| **WRITE-TESTS** | test-generator | Write failing tests before implementation (per story) |
| **IMPLEMENT** | developer | Implement code to make tests pass (per story) |
| **QA** | code-reviewer | Review code quality, run quality gates, commit (per story) |

---

## Available Agents

### 1. Intake Agent

**File:** [intake-agent.md](intake-agent.md)

**Purpose:** First agent in the INTAKE phase. The orchestrator welcomes the user and routes between "share docs" (Option A), "prototype import" (Option B), or "guided Q&A" (Option C) paths before invoking this agent. Scans `documentation/`, gathers project basics via a checklist, and produces the intake manifest.

**When to use:**
- Always runs first when starting a new feature via `/start`
- Automatically invoked by the orchestrator

**Operating modes (auto-detected):**
- **Mode 1 — Existing specs:** Summarizes findings from `documentation/`, quick confirmation
- **Mode 2 — Partial information:** Identifies what exists, flags gaps, asks checklist questions
- **Mode 3 — Starting from scratch:** User provided a project description via guided Q&A (Option C); checklist questions asked with that context

**Key outputs:**
- `generated-docs/context/intake-manifest.json`

---

### 2a. Prototype Review Agent (v2 only)

**File:** [prototype-review-agent.md](prototype-review-agent.md)

**Purpose:** Reviews v2 prototype artifacts — exports .pen design screenshots, extracts domain enrichments for user accept/reject, flags prototype-scoped assumptions, cross-validates genesis data structures against OpenAPI specs, and pre-maps genesis sections to FRS sections. Keeps the BRD review agent clean and format-agnostic.

**When to use:**
- Only for v2 prototype imports (when `context.prototypeFormat === "v2"` in the manifest)
- Runs between intake-agent and intake-brd-review-agent
- Automatically invoked by the orchestrator

**Key outputs:**
- `generated-docs/prototype-screenshots/*.png` (if .pen file exists)
- `generated-docs/context/intake-manifest.json` (sets `artifacts.wireframes.generate = false` when screenshots exported)
- Structured review return (enrichments, assumptions, mappings)

---

### 2b. Intake BRD Review Agent

**File:** [intake-brd-review-agent.md](intake-brd-review-agent.md)

**Purpose:** Reviews requirements for completeness against the FRS template, asks clarifying questions, and produces the canonical Feature Requirements Specification. Final agent in the INTAKE phase (2 of 2 for v1, 3 of 3 for v2).

**When to use:**
- Runs after intake-agent (v1) or after prototype-review-agent (v2) completes
- Automatically invoked by the orchestrator

**Operating modes (auto-detected):**
- **Mode A — BRD/spec exists:** Reviews against FRS template, asks targeted clarifying questions
- **Mode B — No BRD/spec:** Walks user through full requirements conversation guided by template sections

**Key outputs:**
- `generated-docs/specs/feature-requirements.md`
- `generated-docs/context/intake-manifest.json` (amendments)

---

### 3. Design API Agent

**File:** [design-api-agent.md](design-api-agent.md)

**Purpose:** Designs a complete OpenAPI specification from the Feature Requirements Specification. Analyzes functional requirements and data model to identify needed endpoints.

**When to use:**
- Runs during DESIGN phase when `manifest.artifacts.apiSpec.generate == true`
- When the feature requires API endpoints and no spec exists

**Key outputs:**
- `generated-docs/specs/api-spec.yaml`

---

### 3b. Design Style Agent

**File:** [design-style-agent.md](design-style-agent.md)

**Purpose:** Formalizes styling and branding requirements into complete CSS design tokens (`:root`/`.dark` blocks in oklch, replacing Shadcn defaults in globals.css) and a style reference guide for guidance CSS cannot express (typography, spacing, component selection, layout, motion, accessibility).

**When to use:**
- Runs during DESIGN phase when `manifest.artifacts.designTokensCss.generate == true` or `manifest.artifacts.designTokensMd.generate == true`
- When the feature has branding or styling requirements

**Key outputs:**
- `generated-docs/specs/design-tokens.css`
- `generated-docs/specs/design-tokens.md`

---

### 3c. Design Wireframe Agent

**File:** [design-wireframe-agent.md](design-wireframe-agent.md)

**Purpose:** Generates simple text-based wireframes from the Feature Requirements Specification. Creates ASCII/markdown layouts for each screen before story planning begins. References user-provided wireframes and the generated API spec when available.

**When to use:**
- Runs during DESIGN phase when `manifest.artifacts.wireframes.generate == true`
- When the feature involves UI components

**Key outputs:**
- `generated-docs/specs/wireframes/_overview.md`
- `generated-docs/specs/wireframes/screen-N-[name].md`

---

### 3d. Type Generator Agent

**File:** [type-generator-agent.md](type-generator-agent.md)

**Purpose:** Generates TypeScript interfaces and typed API endpoint functions from the canonical OpenAPI spec. Eliminates redundant type inference during IMPLEMENT and ensures consistency across all stories and test files.

**When to use:**
- Runs during DESIGN Step 6 when an `api-spec.yaml` exists (generated or user-provided)
- Also re-runs during `/api-mock-refresh` when schema changes are detected

**Key outputs:**
- `web/src/types/api-generated.ts`
- `web/src/lib/api/endpoints.ts`

---

### 4. Feature Planner

**File:** [feature-planner.md](feature-planner.md)

**Purpose:** Transforms feature specifications into structured implementation plans through collaborative refinement. Creates epics, user stories, and acceptance criteria. Automatically references wireframes if available.

**When to use:**
- Starting a new feature from a specification
- Breaking down complex requirements into implementable stories
- After INTAKE and DESIGN phases complete

**Invocation:**
```
Plan the user authentication feature based on the spec
```

**Key outputs:**
- `generated-docs/stories/_feature-overview.md`
- `generated-docs/stories/epic-N-[name]/story-N-[name].md`

---

### 5. Test Designer

**File:** [test-designer.md](test-designer.md)

**Purpose:** Produces a specification-by-example document for each story before tests are written. Surfaces business decisions the BA didn't specify, lets BAs review behavior using data tables (not code), and bridges the gap between natural-language requirements and AI-generated tests.

**When to use:**
- After REALIGN phase completes for the current story
- Before test-generator writes executable tests
- Automatically invoked by the orchestrator

**Key outputs:**
- `generated-docs/test-design/epic-N-[slug]/story-M-[slug]-test-design.md`

---

### 6. Test Generator

**File:** [test-generator.md](test-generator.md)

**Purpose:** Generates comprehensive Vitest + React Testing Library tests BEFORE implementation. Creates failing tests that define acceptance criteria as executable code.

**When to use:**
- Immediately after feature-planner completes an epic
- Before ANY implementation code is written
- When defining what a component/feature should do

**Invocation:**
```
Generate tests for Epic 1: Basic Auth
```

**Key outputs:**
- `web/src/__tests__/integration/[feature].test.tsx`

---

### 7. Developer

**File:** [developer.md](developer.md)

**Purpose:** Implements exactly one user story at a time. Reads story metadata (route, target file, page action) to know where to write code. Makes failing tests pass using App Router, Shadcn UI, and the project's API client.

**When to use:**
- After test-generator has created failing tests (ready for IMPLEMENT phase)
- Automatically invoked by the orchestrator

**Key behaviors:**
- Implements exactly ONE story at a time
- Locates and makes failing tests pass
- Runs pre-flight test check (`npm test`) before transitioning to QA
- Flags discovered impacts for future stories
- Follows project patterns (App Router, Shadcn UI, API client)

---

### 8. Code Reviewer

**File:** [code-reviewer.md](code-reviewer.md)

**Purpose:** Reviews code changes for quality, security, and adherence to project patterns. Prompts user for manual verification in the web app. Routes issues by severity for resolution.

**When to use:**
- After implementing a feature (IMPLEMENT phase complete)
- Before creating a PR
- As part of the QA phase

**Invocation:**
```
Review the code changes for the portfolio dashboard
```

**What it checks:**
- TypeScript & React quality
- Next.js 16 patterns
- Security (XSS, secrets, RBAC)
- Project patterns (API client, types, Shadcn UI)
- Testing coverage
- Accessibility
- Manual verification (user tests in browser)

**Issue resolution:**
- Critical issues → pause, user fixes (with optional Claude assistance), re-review
- High/Medium issues → logged for fix epic (via REALIGN)

---

---

## Workflow Recommendations

### Starting a New Feature

1. **INTAKE (Mandatory):** Orchestrator welcomes user and routes (share docs, prototype import, or guided Q&A), then runs intake-agent, prototype-review-agent (v2 only), and intake-brd-review-agent via scoped calls
   - Onboarding: welcome message → routing question → (Option A: user adds docs / Option B: prototype import / Option C: project description prompt)
   - Each agent uses scoped calls: analyze → orchestrator asks questions → produce artifact → orchestrator approves → finalize
   - For v2 prototype imports: prototype-review-agent runs between intake-agent and BRD review — exports screenshots, surfaces enrichments, flags assumptions
   - Orchestrator handles all user interaction via AskUserQuestion (with free-text exception for project description)
   - Approve manifest → [v2: review screenshots, accept/reject enrichments, confirm assumptions] → approve FRS → **mandatory /clear + /continue**

2. **DESIGN (Mandatory, multi-agent):** Orchestrator reads intake manifest, launches agents in parallel (API + Style + Wireframe Call A simultaneously) via scoped calls
   - Each agent: produce artifact → orchestrator approves → commit/revise
   - Wireframe agent has 3 calls (screen list → wireframes → commit)
   - **mandatory /clear + /continue** after all DESIGN agents complete

3. **SCOPE:** Invoke `feature-planner` via 2 scoped calls
   - Call A: propose epics → orchestrator approves → Call B: write + commit
   - **mandatory /clear + /continue**

4. **STORIES:** Invoke `feature-planner` via 2 scoped calls
   - Call A: propose stories → orchestrator approves → Call B: write + commit
   - Proceeds directly to REALIGN

5. **Per-story cycle:** REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA
   - All phases use scoped calls; orchestrator handles user interaction between calls
   - IMPLEMENT: 2 developer calls (implement, then quality gates)
   - QA: 3 code-reviewer calls (review, gates + checklist, commit) with orchestrator manual verification
   - After QA manual verification → **mandatory /clear + /continue**

6. **Epic completion:** After last story's QA, code-reviewer presents epic review
   - **Mandatory /clear + /continue** before starting next epic

7. **Repeat:** Next epic's STORIES phase, or feature complete

### Context Management

Context clearing happens at 5 mandatory boundaries (INTAKE approval, DESIGN complete, epic list approval, story QA completion, epic completion). Between these boundaries, phases transition automatically. A post-compaction hook (`inject-phase-context.ps1`) restores workflow instructions if auto-compaction fires mid-workflow.

### Quick Quality Check

Before committing:
```
/quality-check
```

### Reviewing Existing Code

For code review without full TDD workflow:
```
Review the authentication module for security issues
```

---

## Context Directory

The `generated-docs/context/` directory is used for agent-to-agent communication. Files here are temporary and gitignored.

| File | Created By | Used By |
|------|------------|---------|
| `intake-manifest.json` | intake-agent (created), intake-brd-review-agent (amended) | DESIGN orchestrator, feature-planner |
| `workflow-state.json` | transition scripts | all agents |
| `review-findings.json` | code-reviewer | code-reviewer (QA phase) |
| `quality-gate-status.json` | code-reviewer | (final output) |

---

## Workflow State Management

### Transition Scripts

The workflow uses scripts to track and validate state:

| Script | Purpose |
|--------|---------|
| `transition-phase.js` | Manages phase transitions with validation |
| `validate-phase-output.js` | Validates artifacts exist for a phase |
| `detect-workflow-state.js` | Detects state from artifacts (read-only) |

### Script Execution Verification (CRITICAL)

**Agents MUST verify script execution succeeded before proceeding.**

When running transition scripts, always check the JSON output:

```bash
# Run the transition
node .claude/scripts/transition-phase.js --current --to WRITE-TESTS

# Expected success output:
# { "status": "ok", "message": "Transitioned Epic 1 from PLAN to WRITE-TESTS", ... }

# Error output (DO NOT PROCEED):
# { "status": "error", "message": "Invalid transition...", ... }
```

**Verification rules:**
1. `"status": "ok"` = Success, proceed to next step
2. `"status": "error"` = **STOP** and report the error to the user
3. `"status": "warning"` = Proceed with caution, inform user of the warning

### Validation Flags

Use these flags for additional safety:

```bash
# Check prerequisites before transitioning
node .claude/scripts/transition-phase.js --epic 1 --to WRITE-TESTS --validate

# Verify the FROM phase created expected outputs
node .claude/scripts/transition-phase.js --current --to IMPLEMENT --verify-output
```

### Repair Function

If workflow state is lost or corrupted:

```bash
node .claude/scripts/transition-phase.js --repair
```

The repair function provides a **confidence level** (high/medium/low):
- **High confidence:** Artifacts clearly indicate state
- **Medium confidence:** Some assumptions made - verify with user
- **Low confidence:** Many assumptions - require user confirmation before proceeding

---

## Creating Custom Agents

Use the template file [_agent-template.md](_agent-template.md) to create new agents.

Key requirements:
1. Add YAML frontmatter with `name`, `description`, `model`, and `tools`
2. Document clear purpose and when to use
3. Define step-by-step workflow
4. Include DO/DON'T guidelines
5. Provide example prompts

---

## Related Documentation

- [Agent Workflow Guide](../../.template-docs/agent-workflow-guide.md) - Complete workflow documentation with examples
- [Project README](../../README.md) - Project overview and setup
- [CLAUDE.md](../../CLAUDE.md) - Claude Code configuration for this project
- [Testing Strategy](../../CLAUDE.md#testing-strategy) - Testing patterns and conventions
