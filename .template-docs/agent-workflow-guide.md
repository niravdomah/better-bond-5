# Agent Workflow Guide

This guide explains how to use the Claude Code agent workflow system to build features using Test-Driven Development (TDD). The workflow uses nine specialized agents that guide you from requirements gathering through deployment.

---

## Quick Start

**New to the workflow?** Here's how to get started:

1. **Create a feature spec** in `documentation/your-feature.md`
2. **Run `/start`** to begin the TDD workflow
3. **Follow the prompts** - each agent guides you through its phase
4. **Approve outputs** at key checkpoints (stories, tests, PRs)

**Which command should I use?**

| Starting Point | Command | What Happens |
|----------------|---------|--------------|
| New feature | `/start` | Full workflow: INTAKE → DESIGN → SCOPE → STORIES → WRITE-TESTS → IMPLEMENT → QA |
| Interrupted workflow | `/continue` | Resumes from the last completed phase |
| Check progress | `/status` | Shows current workflow phase, epic/story progress, and design artifacts |
| Visual overview | `/dashboard` | Generates an HTML dashboard and opens it in the default browser; auto-refreshes every 10 seconds |
| Code ready for QA | `/quality-check` | Runs all 5 quality gates |

---

## The Agents

| Agent | Phase | Purpose | Key Output |
|-------|-------|---------|------------|
| **intake-agent** | INTAKE | Scans docs, gathers requirements, produces intake manifest | `generated-docs/context/intake-manifest.json` |
| **intake-brd-review-agent** | INTAKE | Reviews completeness, produces Feature Requirements Spec | `generated-docs/specs/feature-requirements.md` |
| **design-api-agent** | DESIGN | Generates OpenAPI spec from feature requirements (conditional) | `generated-docs/specs/api-spec.yaml` |
| **design-style-agent** | DESIGN | Generates CSS design tokens and style reference guide (conditional) | `generated-docs/specs/design-tokens.css`, `generated-docs/specs/design-tokens.md` |
| **design-wireframe-agent** | DESIGN | Creates ASCII wireframes for UI features (conditional) | `generated-docs/specs/wireframes/*.md` |
| **feature-planner** | SCOPE | Defines all epics with dependency map | `generated-docs/stories/_feature-overview.md` |
| **feature-planner** | STORIES | Defines stories per epic with acceptance criteria | `generated-docs/stories/epic-N-[name]/*.md` |
| **feature-planner** | REALIGN | Checks for cross-story impacts before each story | Revised story files or no-op |
| **test-generator** | WRITE-TESTS | Generates failing tests before implementation | `web/src/__tests__/integration/*.test.ts(x)` |
| **developer** | IMPLEMENT | Makes tests pass | Passing tests + source code |
| **code-reviewer** | QA | Reviews code quality, runs quality gates, commits | Review findings + commit |

### Agent Details

**INTAKE agents** (Mandatory, runs once)
- **intake-agent** — scans `documentation/` for existing specs, wireframes, API docs, and sample data. Auto-detects operating mode (existing specs, partial info, or from scratch). Produces the intake manifest that drives all DESIGN decisions.
- **intake-brd-review-agent** — reviews the intake manifest and user-provided specs against the FRS template (8 sections). Identifies coverage gaps, asks clarifying questions, and produces the canonical Feature Requirements Specification with testable R-numbered requirements.
- The orchestrator handles all user interaction between scoped calls.

**DESIGN agents** (Mandatory phase, agents conditional per manifest)
- The orchestrator reads the intake manifest and invokes up to three agents conditionally:
  - **design-api-agent** — generates OpenAPI spec (`api-spec.yaml`) when `apiSpec.generate == true`
  - **design-style-agent** — generates design tokens (`.css` + `.md`) when either token artifact needs generation
  - **design-wireframe-agent** — generates ASCII wireframes when `wireframes.generate == true`
- Agents run in order: API → Style → Wireframe. User-provided files are copied by the orchestrator when `generate == false`.
- Runs after INTAKE, before SCOPE.

**feature-planner** (Used in three phases)
- **SCOPE:** Defines ALL epics upfront with dependency map (no stories yet)
- **STORIES:** Defines stories for one epic at a time with Given/When/Then acceptance criteria
- **REALIGN:** Before each story, checks `discovered-impacts.md` for learnings from previous stories that affect the upcoming story
- Pauses for approval at each stage; commits files before handing off.

**test-generator**
- Tests MUST fail initially (this is TDD)
- Imports components that don't exist yet
- Only mocks HTTP client, never code under test
- **Tests must verify user behavior, NOT implementation details** (see CLAUDE.md for guidelines)

**developer**
- Implements ONE story at a time
- Does NOT write new tests—only makes existing tests pass
- Runs pre-flight test check (`npm test`) before transitioning to QA
- Flags discovered impacts for future stories to `discovered-impacts.md`

**code-reviewer**
- Handles the QA phase (combined review + quality gates)
- Read-only reviewer — does NOT have the Write tool
- Qualitative code review (TypeScript, React, Next.js, security, accessibility)
- Runs automated quality gates via `quality-gates.js` script
- Prompts user for manual verification in the running web app
- Routes issues by severity: Critical → pause for user fix; High/Medium → log to `discovered-impacts.md` for REALIGN
- Commits and pushes if all gates pass

---

## Workflow Diagram

```
INTAKE          intake-agent → intake-brd-review-agent
                Output: Manifest + FRS
                    │
DESIGN          design-api-agent → design-style-agent → design-wireframe-agent
                (each conditional per manifest)
                Output: API spec, design tokens, wireframes
                    │
SCOPE           feature-planner
                Output: All epics with dependency map
                    │
                ╭───┤  Per epic:
                │   │
STORIES         │   feature-planner
                │   Output: Stories with acceptance criteria
                │       │
                │       ├───╮  Per story:
                │       │   │
REALIGN         │       │   feature-planner (check discovered impacts)
                │       │       │
WRITE-TESTS     │       │   test-generator (failing tests)
                │       │       │
IMPLEMENT       │       │   developer (make tests pass)
                │       │       │
QA              │       │   code-reviewer (review + quality gates + commit)
                │       │   │
                │       ╰───╯
                ╰───╯
```

### The 5 Quality Gates

| Gate | Type | What It Checks |
|------|------|----------------|
| 1. Functional | Manual | Feature works per acceptance criteria |
| 2. Security | Automated | `npm audit`, no hardcoded secrets |
| 3. Code Quality | Automated | TypeScript, ESLint, Next.js build |
| 4. Testing | Automated | Tests pass, coverage threshold met |
| 5. Performance | Manual | Page loads < 3s, no UI freezing |

---

## Choosing Your Starting Point

**Start with `/start` (most common):**
- New features — runs the full workflow from INTAKE through QA
- The orchestrator guides you through every phase automatically

**Resume with `/continue`:**
- Workflow was interrupted mid-way
- Picks up from the last completed phase using saved workflow state

**Start with `/quality-check`:**
- Implementation complete, ready for QA
- Want to run all 5 quality gates locally before committing

---

## Example Workflows

### Example 1: Full Workflow (New Dashboard Widget)

**Scenario:** Building a portfolio value widget from scratch.

| Step | Phase | Agent | Action | Output |
|------|-------|-------|--------|--------|
| 1 | INTAKE | intake-agent | Scan docs, gather requirements | Intake manifest |
| 2 | INTAKE | intake-brd-review-agent | Review completeness, clarify gaps | Feature Requirements Spec |
| 3 | DESIGN | design-wireframe-agent | Create wireframes for 4 states | 5 wireframe files |
| 4 | SCOPE | feature-planner | Define 4 epics | Feature overview |
| 5 | STORIES | feature-planner | Plan Epic 1 stories | 4 story files |
| 6 | REALIGN | feature-planner | Check for impacts (none yet) | No-op |
| 7 | WRITE-TESTS | test-generator | Generate 14 failing tests | 1 test file |
| 8 | IMPLEMENT | developer | Implement to make tests pass | 3 source files |
| 9 | QA | code-reviewer | Review code, run quality gates, commit | All passed, committed |

[See full detailed walkthrough →](./examples/example-1-full-workflow.md)

---

### Example 2: Mid-Chain Entry (API Integration)

**Scenario:** Adding API integration to existing page. INTAKE and DESIGN already completed, stories exist.

| Step | Phase | Agent | Action |
|------|-------|-------|--------|
| 1 | REALIGN | feature-planner | Check for impacts on current story |
| 2 | WRITE-TESTS | test-generator | Generate tests from stories |
| 3 | IMPLEMENT | developer | Implement to make tests pass |
| 4 | QA | code-reviewer | Review, quality gates, commit |

**Key:** Use `/continue` to resume from the last completed phase.

[See detailed example →](./examples/example-2-mid-chain-entry.md)

---

### Example 3: Bug Fix Workflow

**Scenario:** Fixing a formatting bug in existing component.

| Step | Action |
|------|--------|
| 1 | Write a failing regression test first |
| 2 | Fix the bug (minimal change) |
| 3 | Verify test passes |
| 4 | Run `/quality-check` |
| 5 | Create PR |

**Key:** Skip planning phases for isolated bug fixes.

[See detailed example →](./examples/example-3-bug-fix.md)

---

## Override Behavior

### Skipping Agents

Agents are suggestions, not requirements. You can skip any agent:

```
# Skip wireframes
"No wireframes needed, let's go straight to planning"

# Skip code review
"Tests pass, let's go directly to quality gates"
```

### Re-running Agents

You can re-run any agent at any time:

```
# Regenerate tests after story changes
"Regenerate tests for Epic 1"

# Get another code review after changes
"Review the updated code"
```

### Custom Workflow Paths

| Scenario | Recommended Path |
|----------|------------------|
| Small bug fix | test → implement → QA |
| Backend-only feature | scope/stories → write-tests → implement → QA |
| Prototype/spike | implement only (no tests) |
| Refactoring | write-tests (new tests) → implement → QA |

---

## Troubleshooting

### Common Issues

**Q: Tests pass immediately after generation**
- Tests should FAIL initially. If they pass, implementation already exists or tests don't assert anything meaningful.
- Regenerate tests or check that components don't exist yet.

**Q: Tests are failing but seem to test the wrong things**
- Tests should verify **user-observable behavior**, not implementation details.
- Bad signs: testing CSS classes, function call counts, internal state, DOM structure.
- Good signs: testing what users see, error messages, successful workflows.
- See CLAUDE.md "Acceptance Test Quality Checklist" for full guidelines.
- Regenerate tests if needed: "Regenerate tests focusing on user behavior, not implementation details"

**Q: Agent suggests next agent but I want to do something else**
- Agent suggestions are optional. Tell it what you want to do instead.

**Q: Workflow was interrupted mid-way**
- Context files in `generated-docs/context/` preserve state
- Resume by invoking the next agent in the chain
- Example: "Continue implementing Epic 1"

**Q: Want to change stories after tests were generated**
- Modify story files in `generated-docs/stories/`
- Regenerate tests: "Regenerate tests for Epic 1 with updated acceptance criteria"

**Q: Quality gate failed**
- Review the failure reason in the output
- Fix the issue and re-run `/quality-check`
- Don't skip gates—they catch real issues

### Edge Cases

**Multiple people working on same feature:**
- Each person should work on different epics
- Context files may conflict—coordinate or clear `generated-docs/context/`

**Existing tests in codebase:**
- test-generator creates NEW test files, doesn't modify existing
- Run full test suite to ensure no conflicts

**Agent seems stuck or confused:**
- Provide clearer context: "I'm at the IMPLEMENT phase with failing tests in portfolio-widget.test.tsx"
- Reference specific files: "Please implement the PortfolioValueWidget component to pass the tests"

---

## Additional Resources

- [Example 1: Full Workflow](./examples/example-1-full-workflow.md) - Complete step-by-step walkthrough
- [Example 2: Mid-Chain Entry](./examples/example-2-mid-chain-entry.md) - Starting from existing artifacts
- [Example 3: Bug Fix](./examples/example-3-bug-fix.md) - Alternative workflow for fixes
- [CLAUDE.md](../CLAUDE.md) - Project patterns and conventions
- [Agent configurations](../.claude/agents/) - Individual agent definitions
