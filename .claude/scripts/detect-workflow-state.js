#!/usr/bin/env node
/**
 * detect-workflow-state.js
 * Detects TDD workflow state by scanning artifacts (no test execution)
 * Usage: node .claude/scripts/detect-workflow-state.js [json|human]
 *
 * Workflow Structure (4 Stages):
 *   Stage 1: INTAKE (gather requirements, produce FRS) → DESIGN (once) → SCOPE (define epics only)
 *   Stage 2: Per-Epic: STORIES (define stories for current epic)
 *   Stage 3: Per-Story: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA
 */

const fs = require('fs');
const path = require('path');
const helpers = require('./lib/workflow-helpers');

const format = process.argv[2] || 'json';

// ============================================================================
// ERROR HANDLING
// ============================================================================

function outputError(error, code, details = {}) {
  if (format === 'json') {
    console.log(JSON.stringify({
      error: code,
      message: error.message || String(error),
      details,
      suggestion: getSuggestion(code)
    }, null, 2));
  } else {
    console.error(`Error [${code}]: ${error.message || error}`);
    if (details.path) console.error(`  Path: ${details.path}`);
    console.error(`  Suggestion: ${getSuggestion(code)}`);
  }
  process.exit(1);
}

function getSuggestion(code) {
  const suggestions = {
    'no_spec': 'Create a feature spec in documentation/ (not README.md)',
    'permission_denied': 'Check file/directory permissions',
    'invalid_structure': 'Ensure generated-docs/stories/ directory exists',
    'parse_error': 'Check for syntax errors in JSON config files',
    'unknown': 'Try running /start to initialize the workflow'
  };
  return suggestions[code] || suggestions['unknown'];
}

// Wrap entire script in try/catch for unexpected errors
try {
  main();
} catch (error) {
  // Determine error type
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    outputError(error, 'permission_denied', { path: error.path });
  } else if (error.code === 'ENOENT') {
    outputError(error, 'invalid_structure', { path: error.path });
  } else if (error instanceof SyntaxError) {
    outputError(error, 'parse_error');
  } else {
    outputError(error, 'unknown', { stack: error.stack });
  }
}

function main() {
  // ============================================================================
  // DETECTION
  // ============================================================================

  // Find feature spec
  const specFiles = helpers.findFiles('documentation', '*.md')
    .filter(f => !f.endsWith('README.md'));
  const spec = specFiles[0] || null;

  // Detect INTAKE phase artifacts
  const intakeManifestPath = 'generated-docs/context/intake-manifest.json';
  const frsPath = 'generated-docs/specs/feature-requirements.md';
  const hasIntakeManifest = fs.existsSync(intakeManifestPath);
  const hasFRS = fs.existsSync(frsPath);

  // INTAKE phase state:
  //   No manifest, no FRS → INTAKE not started (intake-agent needed)
  //   Manifest exists, no FRS → intake-agent done, brd-review-agent needed
  //   Manifest exists, FRS exists → INTAKE complete
  let intakePhase = 'not_started';
  if (hasIntakeManifest && hasFRS) {
    intakePhase = 'complete';
  } else if (hasIntakeManifest) {
    intakePhase = 'manifest_only';
  }

  // Detect DESIGN phase artifacts
  const wireframeCount = helpers.findFilesRecursive('generated-docs/specs/wireframes', '*.md').length;
  const hasApiSpec = fs.existsSync('generated-docs/specs/api-spec.yaml');
  const hasDesignTokensCss = fs.existsSync('generated-docs/specs/design-tokens.css');
  const hasDesignTokensMd = fs.existsSync('generated-docs/specs/design-tokens.md');

  // Find epic directories
  const storiesDir = 'generated-docs/stories';
  let epicDirs = [];

  if (fs.existsSync(storiesDir)) {
    const entries = fs.readdirSync(storiesDir);
    epicDirs = entries
      .filter(d => d.startsWith('epic-'))
      .map(d => path.join(storiesDir, d))
      .filter(d => {
        try {
          return fs.statSync(d).isDirectory();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        // Sort by epic number
        const numA = parseInt(path.basename(a).match(/epic-(\d+)/)?.[1] || '0');
        const numB = parseInt(path.basename(b).match(/epic-(\d+)/)?.[1] || '0');
        return numA - numB;
      });
  }

  // Build epic status array
  const epics = [];
  let firstIncomplete = null;
  let firstIncompletePhase = null;
  let firstIncompleteStory = null;
  let firstIncompleteStoryNum = null;
  let previousEpicComplete = false;

  for (let i = 0; i < epicDirs.length; i++) {
    const epicPath = epicDirs[i];
    const epicName = path.basename(epicPath);
    const epicNumMatch = epicName.match(/epic-(\d+)/);
    const epicNum = epicNumMatch ? epicNumMatch[1] : '0';

    // Check artifacts
    const hasOverview = fs.existsSync(path.join(epicPath, '_epic-overview.md'));
    const storyCount = helpers.findFiles(epicPath, 'story-*.md').length;

    // Get detailed story states (uses shared helper)
    const storyStates = helpers.getStoryStates(epicPath, epicNum);

    // Find test files for this epic
    const testDir = 'web/src/__tests__/integration';
    let testCount = 0;
    if (fs.existsSync(testDir)) {
      try {
        const testFiles = fs.readdirSync(testDir).filter(f =>
          f.includes(`epic-${epicNum}`) && (f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
        );
        testCount = testFiles.length;
      } catch {
        // Can't read test dir
      }
    }

    // Check QA status (uses shared helper)
    const qaComplete = helpers.checkQAComplete(epicNum);

    // Count acceptance tests (uses shared helper — scoped to AC section)
    const acceptance = helpers.countEpicAC(epicPath);

    // Check for discovered impacts affecting this epic (uses shared helper)
    const impacts = helpers.getDiscoveredImpactsForEpic(epicNum);

    // Determine phase based on new 4-stage workflow
    let phase;
    let currentStory = null;
    let currentStoryPhase = null;

    if (!hasOverview || storyCount === 0) {
      // No stories defined yet - needs STORIES phase
      phase = 'STORIES';
    } else {
      // Has stories - check story-level progress
      const incompleteStory = storyStates.find(s => s.phase !== 'COMPLETE');

      if (!incompleteStory) {
        // All stories complete
        phase = 'COMPLETE';
      } else {
        // Find the current story and its phase
        currentStory = incompleteStory;

        // Check if REALIGN is needed for this story
        // (findFirstIncompleteStory returns raw phase; REALIGN override happens here)
        if (impacts.hasImpactsForEpic && incompleteStory.phase === 'TEST-DESIGN') {
          phase = 'REALIGN';
          currentStoryPhase = 'REALIGN';
        } else {
          phase = incompleteStory.phase;
          currentStoryPhase = incompleteStory.phase;
        }
      }
    }

    // Track first incomplete epic/story
    if (!firstIncomplete && phase !== 'COMPLETE') {
      firstIncomplete = epicName;
      firstIncompletePhase = phase;
      if (currentStory) {
        firstIncompleteStory = currentStory.name;
        firstIncompleteStoryNum = currentStory.number;
      }
    }

    // Track if this epic is complete for the next iteration
    previousEpicComplete = (phase === 'COMPLETE');

    epics.push({
      name: epicName,
      epicNum: parseInt(epicNum),
      phase,
      stories: storyCount,
      storyStates: storyStates.map(s => ({
        name: s.name,
        number: s.number,
        phase: s.phase
      })),
      currentStory: currentStory ? currentStory.number : null,
      currentStoryPhase,
      tests: testCount,
      qaComplete,
      acceptance,
      discoveredImpacts: impacts.impactCount
    });
  }

  // ============================================================================
  // OUTPUT
  // ============================================================================

  if (format === 'json') {
    // No spec is only an error if INTAKE is already complete (post-INTAKE phases need a spec)
    if (!spec && intakePhase === 'complete') {
      console.log(JSON.stringify({
        error: 'no_spec',
        message: 'No feature spec found in documentation/',
        suggestion: getSuggestion('no_spec')
      }, null, 2));
      process.exit(1);
    }

    // Determine action based on 4-stage workflow (INTAKE → DESIGN → SCOPE → implementation)
    // Check if DESIGN artifacts are still needed (based on manifest)
    let designIncomplete = false;
    if (intakePhase === 'complete' && hasIntakeManifest) {
      const manifestContent = helpers.readIntakeManifest();
      if (manifestContent) {
        const arts = manifestContent.artifacts || {};
        if ((arts.apiSpec && (arts.apiSpec.generate || arts.apiSpec.userProvided)) && !hasApiSpec) designIncomplete = true;
        if ((arts.designTokensCss && (arts.designTokensCss.generate || arts.designTokensCss.userProvided)) && !hasDesignTokensCss) designIncomplete = true;
        if ((arts.designTokensMd && (arts.designTokensMd.generate || arts.designTokensMd.userProvided)) && !hasDesignTokensMd) designIncomplete = true;
        if ((arts.wireframes && (arts.wireframes.generate || arts.wireframes.userProvided)) && wireframeCount === 0) designIncomplete = true;
      }
    }

    let action;
    if (intakePhase !== 'complete') {
      // INTAKE not finished — determine which agent stage
      if (intakePhase === 'not_started') {
        action = 'run_intake_agent';
      } else {
        action = 'run_brd_review_agent';
      }
    } else if (designIncomplete) {
      action = 'run_design_agents';
    } else if (!firstIncomplete) {
      action = 'all_complete';
    } else if (firstIncompletePhase === 'STORIES') {
      action = 'define_stories';
    } else if (firstIncompletePhase === 'REALIGN') {
      action = 'realign_needed';
    } else if (firstIncompletePhase === 'TEST-DESIGN') {
      action = 'run_test_designer';
    } else if (firstIncompletePhase === 'WRITE-TESTS') {
      action = 'generate_tests';
    } else if (firstIncompletePhase === 'IMPLEMENT') {
      action = 'implement_story';
    } else if (firstIncompletePhase === 'QA') {
      action = 'qa_story';
    } else {
      action = 'proceed';
    }

    const output = {
      spec,
      intake: {
        phase: intakePhase,
        hasManifest: hasIntakeManifest,
        hasFRS: hasFRS
      },
      design: {
        apiSpec: hasApiSpec,
        designTokensCss: hasDesignTokensCss,
        designTokensMd: hasDesignTokensMd,
        wireframes: wireframeCount
      },
      epics,
      resume: {
        epic: firstIncomplete || 'none',
        epicNum: firstIncomplete ? parseInt(firstIncomplete.match(/epic-(\d+)/)?.[1] || '0') : null,
        story: firstIncompleteStory || null,
        storyNum: firstIncompleteStoryNum || null,
        phase: intakePhase !== 'complete' ? 'INTAKE' : (designIncomplete ? 'DESIGN' : (firstIncompletePhase || 'ALL_COMPLETE')),
        action
      }
    };

    console.log(JSON.stringify(output, null, 2));
  } else {
    // Human-readable output
    console.log('=== Workflow State ===');
    console.log(`Spec: ${spec || 'NOT FOUND'}`);
    console.log(`INTAKE: ${intakePhase} (manifest: ${hasIntakeManifest ? 'yes' : 'no'}, FRS: ${hasFRS ? 'yes' : 'no'})`);
    console.log(`DESIGN: API spec: ${hasApiSpec ? 'yes' : 'no'}, CSS tokens: ${hasDesignTokensCss ? 'yes' : 'no'}, Style guide: ${hasDesignTokensMd ? 'yes' : 'no'}, Wireframes: ${wireframeCount}`);
    console.log('');
    console.log('=== Epics ===');
    for (const epic of epics) {
      const storyInfo = epic.currentStory ? ` → Story ${epic.currentStory} (${epic.currentStoryPhase})` : '';
      console.log(`  ${epic.name} (${epic.phase})${storyInfo}`);
      if (epic.storyStates && epic.storyStates.length > 0) {
        for (const story of epic.storyStates) {
          const marker = story.phase === 'COMPLETE' ? '✓' : story.phase === epic.currentStoryPhase ? '►' : '○';
          console.log(`    ${marker} ${story.name} (${story.phase})`);
        }
      }
    }
    console.log('');
    console.log('=== Resume Point ===');
    console.log(`Epic: ${firstIncomplete || 'All complete'}`);
    if (firstIncompleteStory) {
      console.log(`Story: ${firstIncompleteStory} (Story ${firstIncompleteStoryNum})`);
    }
    console.log(`Phase: ${firstIncompletePhase || 'DONE'}`);
  }
}
