---
description: Initialize project - installs dependencies, verifies setup
model: haiku
---

You are helping a developer set up this AI-driven development template.

## Phase 1: Check Prerequisites

Run these two checks **in parallel** (two separate Bash calls in a single response):

```bash
# Call 1: Check if dependencies are installed
test -d web/node_modules && echo "installed" || echo "missing"

# Call 2: Check if git preferences exist
test -f .claude/preferences.json && echo "configured" || echo "missing"
```

Use the results to determine what Phase 2 needs to do: `needsInstall` and `needsPreferences`.

## Phase 2: Install + Configure (parallel where possible)

Run installation and configuration concurrently. The key insight is that `npm install` is slow (~30-60s) and needs no user interaction, while git preferences needs user interaction but no npm. Overlap them.

### If both are needed:

1. **Start npm install in the background** — run `npm install` in `/web` with `run_in_background: true`
2. **Ask the git preferences question** (foreground, while npm runs):
   - Use `AskUserQuestion` with a single question:
     - "How should Claude handle git commits and pushes?" — Options:
       - "Auto-approve both (recommended)"
         Fastest workflow — Claude commits and pushes without prompting. You can always review changes in git history.
       - "Auto-approve commits only"
         Claude commits freely but asks before each push to the remote.
       - "Auto-approve pushes only"
         Claude asks before each commit but pushes approved commits automatically.
       - "Always ask"
         Maximum control — Claude asks for approval before every commit and push.
   - Map their answer to flags and run the **existing** init script via Bash (the script is already in the repo at `.claude/scripts/init-preferences.js` — do NOT recreate it):
     | Answer | `--autoApproveCommit` | `--autoApprovePush` |
     |---|---|---|
     | Auto-approve both | `true` | `true` |
     | Auto-approve commits only | `true` | `false` |
     | Auto-approve pushes only | `false` | `true` |
     | Always ask | `false` | `false` |
     ```bash
     node .claude/scripts/init-preferences.js --autoApproveCommit <true|false> --autoApprovePush <true|false>
     ```
   - **Do NOT recreate or rewrite the script.** It already exists. Just run it with `node`.
   - **Do NOT use the `Write` tool or `cat >` heredoc to create any files in `.claude/`.** The `node` command above is auto-approved by the bash-permission-checker hook; writing files directly would trigger a permission prompt.
3. **Wait for npm install to complete** — check the background task output before proceeding to Phase 3

### If only npm install is needed:

- Run `npm install` in `/web` (foreground, wait for completion)
- Mention: "Git preferences already configured."

### If only git preferences are needed:

- Mention: "Dependencies already installed."
- Ask the git preferences question and run the init script (same flow as above)

### If neither is needed:

- Mention: "Dependencies installed and git preferences configured — skipping to verification."

**Note:** `git pull` and `git add` are always auto-approved. `git push --force` and `git commit --no-verify` are always blocked regardless of preferences.

## Phase 3: Verify Setup

Run all three checks **in parallel** (three separate Bash calls in a single response):

```bash
# Each as a separate parallel Bash call — use --prefix to stay in project root
npm --prefix web exec -- tsc -p web/tsconfig.json --noEmit   # TypeScript compiles
npm --prefix web run lint                                     # ESLint works (warnings are OK)
npm --prefix web run build                                    # Build succeeds
```

**IMPORTANT:** Do NOT use `cd web && ...` — this changes the persisted working directory and breaks subsequent commands that expect the project root. Use `npm --prefix web run` for npm scripts (it sets CWD to the prefix directory automatically). For `npm exec`, the CWD stays at the project root — pass explicit paths to the tool (e.g., `tsc -p web/tsconfig.json`).

## Phase 4: Display Status

Show a summary:

```
Project Setup Complete!

[x] Dependencies installed
[x] Git preferences configured
[x] TypeScript configured
[x] ESLint configured
[x] Build successful

Next Steps:
  npm run dev    → Start development server
  /start         → Start building a feature
  /quality-check → Run quality gates before PR
```

Then, **return control to the caller.**

## Error Handling

- **npm install fails:** Check Node version, network, suggest fixes
- **TypeScript errors:** Note them but don't block - user may need to fix code
- **Build fails:** Show the error, offer to help diagnose
- **Missing /web directory:** This template requires the /web folder - check if they're in the right directory
