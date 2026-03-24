# AI-First UI Development Template

[![PR Quality Gates](https://github.com/stadium-software/stadium-8/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/stadium-software/stadium-8/actions/workflows/pr-checks.yml)

Build production-ready Next.js applications with AI-guided development.

**What is this?** A starter template that lets you build web applications by describing what you want in plain language. Claude Code AI agents handle the planning, coding, testing, and quality checks—you focus on *what* to build, not *how* to build it.

## Quick Start

### 1. Create Your Project

**Option A: GitHub UI**
- Click **"Use this template"** → **"Create a new repository"**
- Clone your new repository

**Option B: GitHub CLI**
```bash
gh repo create MY-PROJECT-NAME --template stadium-software/stadium-8 --private --clone
```

### 2. Install & Configure

```bash
cd .\MY-PROJECT-NAME\web && npm install
```

### 3. Start Developing

```bash
npm run dev
```

Open http://localhost:3000

## Building Features

### The Recommended Workflow

1. **Add your specifications to `/documentation`**
   - Create a feature spec (e.g., `my-feature.md`) describing what you want to build
   - Include your OpenAPI spec (e.g., `api.yaml`) if your feature calls backend APIs
   - See [documentation/README.md](documentation/README.md) for templates and examples

2. **Run `/start` in Claude Code**
   - The AI reads your specs and guides you through the entire development process
   - You'll approve epics and stories before implementation begins
   - Tests are written first (TDD), then code, then quality checks

### Example

```
documentation/
├── user-dashboard.md   # Your feature spec
├── api.yaml            # Your OpenAPI spec
└── sample-data.json    # Optional: example data for context
```

Then in Claude Code:
```
/start
```

The AI agents will take it from there—planning, coding, testing, and validating quality gates.

### Workflow Commands

```
/start          # Begin TDD workflow — scans documentation/ and gathers requirements
/status         # See where you are in the workflow
/continue       # Resume an interrupted workflow
/quality-check  # Validate all quality gates before committing
```

## AI Agents

This template includes specialized Claude Code agents for **Test-Driven Development**:

| Phase | Agent | Purpose |
|-------|-------|---------|
| INTAKE | intake-agent | Scan docs, gather requirements, produce intake manifest |
| INTAKE | intake-brd-review-agent | Review completeness, produce Feature Requirements Spec |
| DESIGN | design-api-agent | Design OpenAPI spec from requirements (conditional) |
| DESIGN | design-style-agent | Formalize styling into CSS design tokens (conditional) |
| DESIGN | design-wireframe-agent | Generate text-based wireframes for UI planning (conditional) |
| SCOPE | feature-planner | Define all epics with dependency map |
| STORIES | feature-planner | Define stories per epic with acceptance criteria |
| REALIGN | feature-planner | Check for cross-story impacts before each story |
| WRITE-TESTS | test-generator | Generate failing tests (TDD "Red") |
| IMPLEMENT | developer | Make tests pass (TDD "Green") |
| QA | code-reviewer | Review, quality gates, commit |

**Workflow:**

```mermaid
flowchart LR
    A[📝 Your Spec] --> IA[intake-agent]
    IA --> IB[intake-brd-review-agent]
    IB --> DA[design-api-agent]
    DA --> DS[design-style-agent]
    DS --> DW[design-wireframe-agent]
    DW --> FP1[feature-planner]
    FP1 --> FP2[feature-planner]
    FP2 --> FP3[feature-planner]
    FP3 --> C[test-generator]
    C --> D[developer]
    D --> E[code-reviewer]
    E --> F[✅ Committed]

    subgraph INTAKE
        IA
        IB
    end
    subgraph DESIGN
        DA
        DS
        DW
    end
    subgraph SCOPE
        FP1
    end
    subgraph STORIES
        FP2
    end
    subgraph REALIGN
        FP3
    end
    subgraph WRITE-TESTS
        C
    end
    subgraph IMPLEMENT
        D
    end
    subgraph QA
        E
    end
```

**Learn more:**
- [Agent Workflow Guide](.template-docs/agent-workflow-guide.md) - Complete workflow documentation
- [.claude/agents/README.md](.claude/agents/README.md) - Agent configuration details

## Quality Gates

5 automated gates (Security, Code Quality, Testing, Performance, Functional) run on pre-commit and PR. Use `/quality-check` to validate locally.

See [Quality Gates Documentation](.template-docs/Help/Quality-Gates.md) for details, checklists, and bypass procedures.

## Template Updates

This template includes a weekly sync workflow that creates PRs for infrastructure updates. Your `/web` code is never overwritten automatically.

See [Receiving Template Updates](.template-docs/Getting-Started.md#receiving-template-updates) for details, or check [CHANGELOG.md](CHANGELOG.md) for version history.

## Documentation

For deeper understanding, see [.template-docs/](.template-docs/):

- [Getting Started](.template-docs/Getting-Started.md) - Detailed setup guide
- [Help Center](.template-docs/Help/) - Authentication, RBAC, environment variables, quality gates, and more
- [Troubleshooting](.template-docs/Help/Troubleshooting.md) - Common issues & solutions
