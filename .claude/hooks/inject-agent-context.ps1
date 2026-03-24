# inject-agent-context.ps1
# SubagentStart hook: reinforces workflow state in subagent sessions.
# Fires when developer, test-generator, code-reviewer, feature-planner, or design-wireframe-agent starts.
#
# Injects: current epic/story/phase, story file path, test file path (~5-10 lines).
# Lightweight - just state coordinates so the subagent knows what to work on.
#
# Output: JSON with hookSpecificOutput.additionalContext
# Fail-safe: exits 0 with no output if state file missing or no active workflow.

$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$stateFile = Join-Path $projectRoot 'generated-docs\context\workflow-state.json'

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

# --- Build context ---
$isGlobalPhase = $state.currentPhase -eq 'INTAKE'
$context = @"
## Workflow State
- Feature: $($state.featureName)
- Epic: $(if ($isGlobalPhase) { 'N/A (requirements gathering)' } else { "$($state.currentEpic) of $($state.totalEpics)" })
- Story: $(if ($isGlobalPhase) { 'N/A (requirements gathering)' } elseif ($state.currentStory) { $state.currentStory } else { 'N/A' })
- Phase: $($state.currentPhase)
- Spec: $($state.specPath)
"@

if ($storyFile) {
    $context += "`n- Story file: $storyFile"
}
if ($testFile) {
    $context += "`n- Test file: $testFile"
}

# --- Output JSON ---
$output = @{
    hookSpecificOutput = @{
        hookEventName = 'SubagentStart'
        additionalContext = $context
    }
} | ConvertTo-Json -Depth 3

Write-Output $output
exit 0
