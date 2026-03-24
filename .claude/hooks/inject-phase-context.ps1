# inject-phase-context.ps1
# Post-compaction hook: restores workflow instructions after auto-compaction.
# Fires via SessionStart (matcher: "compact") in the orchestrator session.
# Subagent compaction is unlikely due to scoped calls (Layer 2) and is not relied upon.
#
# Reads workflow-state.json and injects:
#   Tier 1 - Workflow coordinates (always)
#   Tier 2 - Orchestration rules (not in CLAUDE.md, lost on compaction)
#   Tier 3 - Recency reinforcement (observed drift points)
#   Phase-specific process steps from phase-context/*.md
#
# Output: JSON with hookSpecificOutput.additionalContext
# Fail-safe: exits 0 with no output if state file missing or no active workflow.

$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$stateFile = Join-Path $projectRoot 'generated-docs\context\workflow-state.json'
$phaseContextDir = Join-Path $PSScriptRoot 'phase-context'

# --- Fail gracefully if no active workflow ---
if (-not (Test-Path $stateFile)) {
    exit 0
}

try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
} catch {
    exit 0
}

if (-not $state.currentPhase -or $state.currentPhase -eq 'COMPLETE' -or $state.featureComplete) {
    exit 0
}

# --- Locate story and test files from filesystem ---
$storyFile = $null
$testFile = $null
$storiesDir = Join-Path $projectRoot 'generated-docs\stories'

if ($state.currentEpic) {
    $epicDirs = Get-ChildItem -Path $storiesDir -Directory -Filter "epic-$($state.currentEpic)-*" 2>$null
    if ($epicDirs -and $epicDirs.Count -gt 0) {
        $epicDir = $epicDirs[0].FullName
        if ($state.currentStory) {
            $storyFiles = Get-ChildItem -Path $epicDir -File -Filter "story-$($state.currentStory)-*.md" 2>$null
            if ($storyFiles -and $storyFiles.Count -gt 0) {
                $storyFile = $storyFiles[0].FullName -replace [regex]::Escape($projectRoot + '\'), '' -replace '\\', '/'
            }
            $testDir = Join-Path $projectRoot 'web\src\__tests__\integration'
            $testFiles = Get-ChildItem -Path $testDir -File -Filter "epic-$($state.currentEpic)-story-$($state.currentStory)-*" 2>$null
            if ($testFiles -and $testFiles.Count -gt 0) {
                $testFile = $testFiles[0].FullName -replace [regex]::Escape($projectRoot + '\'), '' -replace '\\', '/'
            }
        }
    }
}

# --- Tier 1: Workflow coordinates ---
$coordinates = @"
## Current Workflow Position
- Epic: $($state.currentEpic) of $($state.totalEpics)
- Story: $(if ($state.currentStory) { $state.currentStory } else { 'N/A (epic-level phase)' })
- Phase: $($state.currentPhase)
- Feature: $($state.featureName)
"@

if ($storyFile) {
    $coordinates += "`n- Story file: $storyFile"
}
if ($testFile) {
    $coordinates += "`n- Test file: $testFile"
}

# --- Tier 2: Orchestration rules (not in CLAUDE.md, lost on compaction) ---
$orchestration = @"

## Orchestration Rules (post-compaction recovery)

### Scoped Call Pattern
- IMPLEMENT phase: Use 2 developer calls: (A) implement code, (B) run quality gates
- QA phase: Use 2 code-reviewer calls: (A) code review, (B) gates + manual verification + commit

### Mandatory Context-Clearing Boundaries
After these 4 pause points, instruct the user to run /clear then /continue:
1. After wireframe approval (DESIGN complete)
2. After epic list approval (SCOPE complete)
3. After manual verification passes (each story's QA complete)
4. After epic completion review (epic complete)
All other phase transitions proceed directly without clearing.

### User Approval Policy
Only stop for user input at: (1) clarifying questions, (2) wireframe/epic/story approval, (3) REALIGN revision approval (when impacts exist), (4) QA critical issues, (5) QA manual verification, (6) epic completion review.
Never auto-approve on behalf of the user.
"@

# --- Tier 3: Recency reinforcement (observed drift points) ---
$reinforcement = @"

## Quality Reminders
- Run ALL 4 quality gates in sequence: npm test, npm run test:quality, npm run lint, npm run build
- Always commit with .claude/logs/ included
"@

# --- Phase-specific snippet ---
$phaseSnippet = ''
# Map phase names to snippet filenames
$phaseMap = @{
    'DESIGN'      = 'design'
    'SCOPE'       = 'scope'
    'STORIES'     = 'stories'
    'REALIGN'     = 'realign'
    'WRITE-TESTS' = 'write-tests'
    'IMPLEMENT'   = 'implement'
    'QA'          = 'qa'
}

$snippetName = $phaseMap[$state.currentPhase]
if ($snippetName) {
    $snippetFile = Join-Path $phaseContextDir "$snippetName.md"
    if (Test-Path $snippetFile) {
        $phaseSnippet = "`n" + (Get-Content $snippetFile -Raw).TrimEnd()
    }
}

# --- Build final context ---
$context = ($coordinates + $orchestration + $reinforcement + $phaseSnippet).TrimEnd()

# --- Output JSON ---
$output = @{
    hookSpecificOutput = @{
        hookEventName = 'SessionStart'
        additionalContext = $context
    }
} | ConvertTo-Json -Depth 3

Write-Output $output
exit 0
