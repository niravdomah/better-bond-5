# Feature Specifications

This folder is where you describe **what you want to build**.

## How It Works

1. **You write a spec** - Describe your feature in plain language (see template below)
2. **Add your API spec** - Include your OpenAPI YAML file so the planner knows what endpoints exist
3. **Run `/start`** - Claude Code reads your spec from this folder
4. **AI agents take over** - Planning, coding, testing, and quality checks happen automatically

## Quick Start

1. Copy the template below into a new file (e.g., `my-feature.md`)
2. Fill in the sections with your requirements
3. **Add your OpenAPI spec** (e.g., `api.yaml` or `openapi.yaml`) to this folder
4. Run `/start` in Claude Code

## Spec Template

Create a new `.md` file in this folder with the following structure:

```markdown
# Feature: [Your Feature Name]

## Overview
[1-2 sentences describing what this feature does and why it's needed]

## User Stories

### As a [type of user], I want to [do something] so that [benefit]
- Acceptance criteria 1
- Acceptance criteria 2

### As a [type of user], I want to [do something else] so that [benefit]
- Acceptance criteria 1
- Acceptance criteria 2

## Requirements

### Must Have
- [ ] Requirement 1
- [ ] Requirement 2

### Nice to Have
- [ ] Optional requirement 1

## UI/UX Notes (if applicable)
[Describe any specific UI requirements, layouts, or user flows]

## Technical Notes (optional)
[Any technical constraints or preferences - leave blank if unsure]
```

## Example Spec

Here's a simple example:

```markdown
# Feature: User Profile Page

## Overview
Allow users to view and edit their profile information.

## User Stories

### As a logged-in user, I want to view my profile so that I can see my account details
- Display user's name, email, and avatar
- Show account creation date
- Show current role/permissions

### As a logged-in user, I want to edit my profile so that I can update my information
- Allow editing name and avatar
- Email changes require verification
- Show success message after saving

## Requirements

### Must Have
- [ ] Profile page accessible from navigation menu
- [ ] Display current user information
- [ ] Edit form with validation
- [ ] Save changes to backend API

### Nice to Have
- [ ] Avatar upload functionality
- [ ] Profile completion percentage

## UI/UX Notes
- Use a card layout for profile sections
- Edit mode should be inline (not a separate page)
```

## API Specification

If your feature involves backend API calls, **include your OpenAPI spec** in this folder:

- Place your OpenAPI 3.0+ YAML file here (e.g., `api.yaml`, `openapi.yaml`)
- The feature planner will read it and reference actual endpoints in stories
- This prevents the AI from inventing endpoints that don't exist

**Why this matters:** Without an API spec, the planner will guess at endpoint names and structures, leading to implementation errors and rework.

Example structure:
```
documentation/
├── my-feature.md      # Your feature spec
├── api.yaml           # Your OpenAPI spec
└── sample-data.json   # Optional: example data
```

## Tips for Writing Good Specs

- **Be specific** - "Users can filter by date" is better than "Users can search"
- **Think about edge cases** - What happens when something goes wrong?
- **Include examples** - Sample data helps clarify requirements
- **Keep it simple** - Start small, you can always add more features later
- **Include your API spec** - Prevents the planner from inventing endpoints

## Working from a Prototype

If you used a prototyping tool (such as Claude Project Planner) to build a signed-off mockup, you can place its output documents here and skip writing a spec from scratch.

**What to include:**

Place the prototype output directly in this folder, or in a subdirectory named `prototype-[name]/`:

```
documentation/
├── prototype-dashboard/              # One prototype's docs in a subdirectory
│   ├── prototype-requirements.md     # Formal requirements (14 sections)
│   ├── analysis-summary.md           # Numbered FR/NFR requirements
│   ├── design-brief.md              # Design decisions and view specs
│   ├── architecture-design.md        # Component structure and data design
│   ├── user-verification-tasks.md    # Manual test scripts
│   └── quality-checklist.md          # Post-build validation
├── business-requirements.md          # Project-level: goals, roles, purpose
├── design-language.md                # Project-level: brand colors, typography
├── tailwind.config.js                # Project-level: Tailwind config
└── README.md                         # This file
```

Project-level files (`business-requirements.md`, `design-language.md`, `tailwind.config.js`) can sit at the top level. Per-prototype files go in their subdirectory.

**What happens when you run `/start`:**

The INTAKE agents will detect the prototype documents automatically, confirm key details with you (roles, styling, data source), and produce the Feature Requirements Specification. Most checklist questions will be pre-filled from your prototype docs — you just confirm or adjust.

If you have multiple prototype subdirectories, the agent will ask which one to work with first.

## What Happens Next?

After you run `/start`, the AI workflow will:

1. **INTAKE** - Gather requirements and produce the Feature Requirements Specification
2. **DESIGN** - Generate missing artifacts, copy user-provided ones
3. **SCOPE** - Break your spec into epics
4. **STORIES** - Define stories for each epic
5. **WRITE-TESTS** - Generate test cases for each story
6. **IMPLEMENT** - Write the code to pass those tests
7. **QA** - Review code, run quality gates, and commit

You'll be asked for approval at key checkpoints along the way.

## Need Help?

- Run `/status` to see your workflow progress
- Check [Getting Started](../.template-docs/Getting-Started.md) for setup help
- Ask Claude Code: "How do I write a good feature spec?"
