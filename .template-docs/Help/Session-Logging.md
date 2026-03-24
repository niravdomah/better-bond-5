# Session Logging

Automatically log Claude Code sessions in markdown format for commit and PR review.

---

## Overview

| What's Logged | Where | Format |
|---------------|-------|--------|
| All prompts | `.claude/logs/` | Markdown |
| Session metadata | Per-session file | Human-readable |
| Token usage | Session summary | When available |

**No setup required** - logging activates automatically in both CLI and VSCode extension.

---

## How It Works

1. **Session Start** - Creates markdown file with session header
2. **Each Prompt** - Appends prompt with timestamp
3. **Session End** - Adds summary with token usage and modified files

### File Naming

```
.claude/logs/2025-11-21_14_30-add-user-authentication-abc12345.md
```

Format: `yyyy-MM-dd_HH_mm-kebab-case-title-sessionid.md`

---

## Viewing Logs

### Using the Parser Script

```powershell
# List all sessions
.\scripts\parse-logs.ps1 -List

# View last 5 sessions
.\scripts\parse-logs.ps1 -Last 5

# Search in content
.\scripts\parse-logs.ps1 -Search "authentication"

# View statistics
.\scripts\parse-logs.ps1 -Stats
```

### Reading Directly

Logs are markdown - view in any editor or GitHub:

```markdown
# Claude Code Session

**Project:** my-project
**Session ID:** abc123def456
**Started:** 2025-11-21 14:30:00

---

## Prompt - 2025-11-21 14:30:15

Add user authentication feature with JWT tokens

---

## Session Summary

**Total Prompts:** 5
**Tools Used:** Read, Write, Edit, Bash
**Files Modified:** 8
**Total Tokens:** 25,430
```

---

## PR Workflow

### Before Committing

```powershell
# Review what sessions were logged
.\scripts\parse-logs.ps1 -List
```

### In Your Commit

```bash
git add .claude/logs/
git commit -m "Add authentication feature"
```

### During PR Review

Reviewers can:
- Read session logs directly on GitHub
- See which prompts led to changes
- Review token usage

---

## Configuration

### Disabling Logging

**Temporarily:** Rename `.claude/settings.json` to `.claude/settings.json.disabled`

**Permanently:** Remove the `hooks` section from `.claude/settings.json`

### Adjusting Timeouts

Edit `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "powershell ...",
        "timeout": 15
      }]
    }]
  }
}
```

---

## Troubleshooting

### No Logs Created

1. **Check hooks configured** - `Get-Content .claude\settings.json`
2. **Check PowerShell policy** - `Get-ExecutionPolicy` (needs `RemoteSigned`)
3. **Verify logs directory exists** - `.claude/logs/` should be present

### Logs Missing Token Data

Normal - token data only available if included in transcript. Use `/context` during session for real-time view.

### Parser Script Errors

```powershell
# Create logs directory if missing
New-Item -ItemType Directory -Force -Path ".claude\logs"
```

---

## Privacy Notes

**Logged:** Prompts, session metadata, tools used, file paths, token usage

**Not logged:** File contents, API keys, git/system info

**Before committing:** Review logs for sensitive information in prompts.

---

## Architecture

| Component | Purpose |
|-----------|---------|
| `.claude/logging/capture-context.ps1` | Captures session data |
| `.claude/settings.json` | Hook configuration |
| `scripts/parse-logs.ps1` | Log viewer and search |
| `.claude/logs/` | Log storage (committed to git) |

---

**Need help?** Ask Claude Code about session logging!
