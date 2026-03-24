# Claude Code Session Logging - Quick Start

## What It Does

Automatically captures Claude Code sessions in markdown format for commit/PR review (works in both CLI and VSCode extension):
- One `.md` file per session with timestamp and title
- All prompts chronologically
- Session summary with tool usage and files modified
- Token usage data (when available)
- Stored in `.claude/logs/` and committed with your code

## Filename Format

```
yyyy-MM-dd_HH_mm-kebab-case-session-title-sessionid.md
```

Example: `2025-11-21_14_30-add-user-authentication-feature-abc12345.md`

## Setup (Already Done!)

The logging system is already configured. Sessions are automatically logged to:
```
.claude/logs/
```

No additional setup required!

## View Logs

```powershell
# List all sessions
.\scripts\parse-logs.ps1 -List

# Show last 5 sessions with details
.\scripts\parse-logs.ps1 -Last 5

# Show statistics
.\scripts\parse-logs.ps1 -Stats

# Search by date
.\scripts\parse-logs.ps1 -Date "2025-11-21"

# Search in content
.\scripts\parse-logs.ps1 -Search "authentication"

# Show full session content
.\scripts\parse-logs.ps1 -SessionId "abc12345" -Full
```

## Example Session Log

```markdown
# Claude Code Session

**Project:** methodology-template-demo
**Session ID:** abc123def456
**Started:** 2025-11-21 14:30:00
**Permission Mode:** default

---

## Prompt - 2025-11-21 14:30:15

Add user authentication feature with JWT tokens

---

## Prompt - 2025-11-21 14:45:22

Update login page styling

---

## Session Summary

**Ended:** 2025-11-21 15:00:30
**Total Prompts:** 2
**Tools Used:** Read, Write, Edit, Bash
**Files Modified:** 5

### Token Usage

- **Input Tokens:** 12,450
- **Output Tokens:** 8,230
- **Total Tokens:** 20,680

### Modified Files

- `./src/lib/auth.ts`
- `./src/app/login/page.tsx`
- `./src/types/user.ts`
```

## Token Usage Note

Token data is automatically parsed from transcripts when available. If token data is missing:
- Run `/context` during your session to view real-time token usage
- Token data from API responses will be captured if present in transcripts

## For Pull Requests

Session logs are stored in `.claude/logs/` and are **committed to git** for PR review. This allows reviewers to:
- See what prompts were used
- Understand the AI-assisted development process
- Review the conversation that led to changes
- Track token usage for the session

## Full Documentation

See [../LOGGING_SETUP.md](../LOGGING_SETUP.md) for complete documentation.

## Disable Logging

To disable logging temporarily, rename `.claude/settings.json` to `.claude/settings.json.disabled`
