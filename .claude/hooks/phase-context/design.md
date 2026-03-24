<!-- Source: .claude/agents/design-api-agent.md, .claude/agents/design-style-agent.md, .claude/agents/design-wireframe-agent.md — keep in sync when agent process steps change -->

## DESIGN Phase — Generate Derived Artifacts

**Purpose:** Generate derived artifacts (API spec, design tokens, wireframes) from the Feature Requirements Specification produced during INTAKE. The orchestrator reads the intake manifest and invokes agents conditionally — only when their artifact needs generation.

**Execution model:** Parallel Call A (API, Style, Wireframe launch simultaneously), sequential approvals, then parallel Call B. See [orchestrator-rules.md § DESIGN Execution Model](../../shared/orchestrator-rules.md#design-execution-model--parallel-call-a).

## Agent Stages and Key Files

### Stage 1: design-api-agent

- **Agent:** `.claude/agents/design-api-agent.md`
- **Input:** `generated-docs/specs/feature-requirements.md`, `generated-docs/context/intake-manifest.json` (roles, data source), user-provided API material (if any)
- **Output:** `generated-docs/specs/api-spec.yaml`
- **Process:** Call A: read FRS and manifest, design OpenAPI spec, return summary → Orchestrator: get approval → Call B: commit or revise
- **Runs when:** `manifest.artifacts.apiSpec.generate == true`

### Stage 2: design-style-agent

- **Agent:** `.claude/agents/design-style-agent.md`
- **Input:** `generated-docs/specs/feature-requirements.md`, `generated-docs/context/intake-manifest.json` (styling notes), `web/src/app/globals.css` (current token names), user-provided style material (if any)
- **Output:** `generated-docs/specs/design-tokens.css`, `generated-docs/specs/design-tokens.md`
- **Process:** Call A: read FRS, manifest, and current tokens, design complete CSS token values (defaults + overrides) and style guide, return summary → Orchestrator: get approval → Call B: integrate into globals.css (add @import at top, remove Shadcn default :root/.dark blocks), commit or revise
- **Runs when:** `manifest.artifacts.designTokensCss.generate == true` OR `manifest.artifacts.designTokensMd.generate == true`

### Stage 3: design-wireframe-agent

- **Agent:** `.claude/agents/design-wireframe-agent.md`
- **Input:** `generated-docs/specs/feature-requirements.md`, user-provided wireframes from `documentation/wireframes/` (if any), `generated-docs/specs/api-spec.yaml` (if generated)
- **Output:** `generated-docs/specs/wireframes/`
- **Process:** Call A: read FRS, return screen list → Orchestrator: approve screen list → Call B: generate wireframes, return summary → Orchestrator: approve wireframes → Call C: commit
- **Runs when:** `manifest.artifacts.wireframes.generate == true`

### Orchestrator copy logic

When an artifact has `generate == false` but `userProvided != null`, the orchestrator copies the user-provided file using the copy script:
```bash
node .claude/scripts/copy-with-header.js --from "<userProvided-path>" --to "generated-docs/specs/<target-filename>"
```
No agent is invoked for that artifact.

## Determining Resumption State After Compaction

Check which agent outputs exist on disk to determine what still needs to run. Agents run in parallel (not sequentially), so any combination of outputs may be present.

**File paths to check:**
- Manifest: `generated-docs/context/intake-manifest.json`
- API spec: `generated-docs/specs/api-spec.yaml`
- CSS tokens: `generated-docs/specs/design-tokens.css`
- Style guide: `generated-docs/specs/design-tokens.md`
- Wireframes: `generated-docs/specs/wireframes/_overview.md`
- Mock handlers: `web/src/mocks/handlers.ts`

**Resumption logic:** Launch Call A in parallel for all agents whose output is missing. See [continue.md § DESIGN phase](../../commands/continue.md) step 4 for the full decision tree.

## What Happens Next

- After all DESIGN agents complete (or all copies done), the orchestrator transitions to SCOPE
- SCOPE phase: feature-planner reads all artifacts from `generated-docs/specs/` and defines epics
- Then STORIES → per-story cycle
