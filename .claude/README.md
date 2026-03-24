# .claude Directory

This directory contains Claude Code configuration and extensions for this project.

## Contents

### Configuration Files

- **[settings.json](settings.json)** - Project-specific Claude Code settings
  - Hooks configuration for automatic logging
  - Custom behaviors and preferences

- **[settings.local.json](settings.local.json)** (git-ignored) - User-specific overrides
  - Use this for personal preferences that shouldn't be shared

### Logging System

- **[logging/capture-context.ps1](logging/capture-context.ps1)** - PowerShell script that captures rich context
- **[LOGGING_QUICK_START.md](LOGGING_QUICK_START.md)** - Quick reference for logging system
- **[../LOGGING_SETUP.md](../LOGGING_SETUP.md)** - Complete logging documentation

The logging system automatically captures:
- Every user prompt with timestamp and context
- Git information (repo, branch, commit, status)
- Project details and system information
- Session summaries with tool usage
- Full conversation transcripts

**Quick Start:**
```powershell
# Create log directory
New-Item -ItemType Directory -Force -Path "C:\ClaudeCodeLogs"

# View logs
.\scripts\parse-logs.ps1 -Last 10
```

See [LOGGING_QUICK_START.md](LOGGING_QUICK_START.md) for more details.

### Other Directories (Create as Needed)

- **agents/** - Custom Claude Code agents
- **commands/** - Slash commands (`.md` files)
- **hooks/** - Additional hook scripts
- **plugins/** - Custom plugins

## Documentation

- **[LOGGING_SETUP.md](../LOGGING_SETUP.md)** - Complete logging system documentation
- **[LOGGING_QUICK_START.md](LOGGING_QUICK_START.md)** - Quick reference guide

## Settings Hierarchy

Claude Code loads settings in this order (highest precedence first):

1. Enterprise managed settings (Windows: `C:\ProgramData\ClaudeCode\managed-settings.json`)
2. Command-line arguments
3. `.claude/settings.local.json` (project-local, git-ignored)
4. `.claude/settings.json` (project-shared, committed to git)
5. `~/.claude/settings.json` (user-global)

## Best Practices

### What to Commit

✅ **DO commit:**
- `settings.json` - Shared project configuration
- `logging/` - Logging scripts for the team
- `logs/*.md` - Session logs (required for traceability - see [logging/README.md](logging/README.md#git-tracking-policy))
- `agents/` - Custom agents useful for the project
- `commands/` - Project-specific slash commands
- Documentation files

❌ **DON'T commit:**
- `settings.local.json` - Personal preferences
- `.env` files with secrets
- `logs/.agent-cache*`, `logs/.active-session-*` - Temporary files (already gitignored)

### Sharing Configuration

To share settings with your team:
1. Update `settings.json` (not `settings.local.json`)
2. Commit and push
3. Team members get the settings automatically

To override for personal use:
1. Create `settings.local.json`
2. Add your overrides (this file is git-ignored)

### Example: Disable Logging Locally

Create `.claude/settings.local.json`:
```json
{
  "hooks": {}
}
```

This removes all hooks (including logging) for your local environment only.

## Resources

- **Claude Code Docs:** https://code.claude.com/docs
- **Hooks Documentation:** https://code.claude.com/docs/en/hooks.md
- **Settings Documentation:** https://code.claude.com/docs/en/settings.md
- **Project CLAUDE.md:** [../CLAUDE.md](../CLAUDE.md) - Project instructions for Claude

## Support

For issues with:
- **Logging system:** See [LOGGING_SETUP.md](../LOGGING_SETUP.md) troubleshooting section
- **Claude Code:** Use `/feedback` command or visit https://code.claude.com
- **Project setup:** See [../CLAUDE.md](../CLAUDE.md)
