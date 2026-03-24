# Claude Code Session Logging

Automatic session logging captures your Claude Code conversations as markdown files for review, documentation, and team collaboration.

## Quick Start

**No setup required** - logging is automatic for all Claude Code sessions in this project.

### Find Your Logs

```
.claude/logs/YYYY-MM-DD_HH-mmZ-description-SESSIONID.md
```

Example: `.claude/logs/2025-12-04_14-30Z-implement-user-auth-a1b2c3d4.md`

### What Gets Logged

- All user prompts with timestamps
- All AI responses with model info
- Tools used during the session
- Files modified
- Token usage (when `/context` is run)
- Subagent (Task tool) activity

## Features

### Real-Time Logging

Every interaction is logged immediately:

- Prompts appear as they're submitted
- Responses appear when Claude finishes
- No waiting until session ends

### Automatic /clear Recovery

Unlike other logging systems, sessions cleared with `/clear` are **automatically recovered**:

1. Run `/clear` to reset your session
2. Start a new session
3. The previous session is automatically captured from the transcript

### Sensitive Data Protection

Sensitive data is automatically redacted before writing to logs:

- API keys and tokens
- Passwords and secrets
- Credit card numbers
- Connection strings
- Private keys

## Session Lifecycle

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Session Start  │────▶│    Prompts &    │────▶│  Session End    │
│                 │     │    Responses    │     │                 │
│  Creates file   │     │  Appended live  │     │  Adds summary   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Session End Options

| Action           | Effect                       | Best For        |
| ---------------- | ---------------------------- | --------------- |
| Exit Claude Code | Full summary added           | Normal workflow |
| `/clear`         | Auto-recovered on next start | Fresh start at clearing boundaries |
| Auto-compaction  | Hooks restore workflow state  | Automatic (no action needed) |

## Log File Format

### Header

```markdown
# Implement user authentication (2025-12-04 14:30Z)

**Project:** my-project
**Session ID:** a1b2c3d4-e5f6-7890-abcd-ef1234567890
**Started:** 2025-12-04 14:30Z
**Permission Mode:** default
```

### Conversation

```markdown
_**User: John Smith (2025-12-04 14:30Z)**_

Can you help me implement user authentication?

_**Agent (model claude-sonnet-4-20250514)**_

I'll help you implement user authentication. Let me start by...

_Tools used: Read, Edit, Bash_

---
```

### Session Summary

```markdown
## Session Summary

**Ended:** 2025-12-04 15:45Z
**Total Prompts:** 12
**Tools Used:** Read, Edit, Write, Bash, Glob
**Files Modified:** 8

### Token Usage

- **Model:** claude-sonnet-4-20250514
- **Tokens Used:** 48.9k / 200.0k (24%)

### Modified Files

- ./src/lib/auth.ts
- ./src/app/login/page.tsx
- ./src/proxy.ts
```

## Use Cases

### Code Review

Review AI-assisted changes before committing:

```bash
# View today's sessions
ls .claude/logs/*2025-12-08*
```

### Team Collaboration

Share session logs to show:

- What changes were made
- Why decisions were made
- What tools were used

### Documentation

Session logs serve as documentation for:

- Feature implementations
- Bug fixes
- Refactoring decisions

### Debugging

When something goes wrong:

- Review the conversation flow
- See what files were modified
- Check tool execution sequence

## Configuration

### Hook Settings

Hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [...],
    "SessionStart": [...],
    "SessionEnd": [...],
    "Stop": [...],
    ...
  }
}
```

### Customization

Edit `.claude/logging/capture-context.ps1` to customize:

- File naming conventions
- Timestamp formats
- What data is captured
- Sensitive data patterns

## Troubleshooting

### No Logs Created

1. **Check hooks exist** in `.claude/settings.json`
2. **Verify PowerShell** can run scripts
3. **Check directory** `.claude/logs/` exists

### Missing Content

- **No responses?** Check the `Stop` hook is configured
- **No summary?** Exit Claude Code properly (summaries are added on exit or auto-compaction)
- **No tokens?** Run `/context` during your session

### Incomplete Recovery

If a `/clear` session isn't fully recovered:

- The next session's `SessionStart` hook handles recovery
- Check for orphaned `.jsonl` transcripts in the Claude projects folder

## Technical Details

### Transcript Location

Claude Code stores transcripts at:

```
~/.claude/projects/<project-hash>/<session-id>.jsonl
```

### Log Storage

Session logs are stored at:

```
<project>/.claude/logs/<timestamp>-<description>-<session-id>.md
```

### Performance

- Hooks timeout after 10-30 seconds
- Response logging has 2-second delay for transcript completion
- Subagent cache prevents race conditions

## Related Documentation

- [.claude/logging/README.md](../.claude/logging/README.md) - Technical implementation details
- [.claude/settings.json](../.claude/settings.json) - Hook configuration
