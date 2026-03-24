#!/usr/bin/env node
/**
 * validate-phase-output.js
 * Validates that expected artifacts exist after a workflow phase completes
 *
 * Usage:
 *   node .claude/scripts/validate-phase-output.js --phase <PHASE> [--epic <N>] [--story <M>]
 *
 * Workflow Structure (4 Stages):
 *   Stage 1: INTAKE (gather requirements, produce FRS) → DESIGN (once) → SCOPE (define epics only)
 *   Stage 2: Per-Epic: STORIES (define stories for current epic)
 *   Stage 3: Per-Story: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA
 *
 * Phases and their expected artifacts:
 *   INTAKE: intake-manifest.json + feature-requirements.md in generated-docs/
 *   DESIGN: manifest-driven validation of API spec, design tokens, wireframes in generated-docs/specs/
 *   SCOPE: _feature-overview.md with epics defined
 *   STORIES: story files in epic dir with acceptance criteria
 *   WRITE-TESTS: test files for current story
 *   IMPLEMENT: source files that tests import
 *   QA: review findings and quality-gate-status.json
 *
 * Exit codes:
 *   0 - All expected artifacts found
 *   1 - Some non-critical artifacts missing (warnings)
 *   2 - Critical artifacts missing (phase not complete)
 */

const fs = require('fs');
const path = require('path');
const { findFiles, findFilesRecursive } = require('./lib/workflow-helpers');

// =============================================================================
// HELPERS
// =============================================================================

function fileHasContent(filePath, minBytes = 10) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size >= minBytes;
  } catch {
    return false;
  }
}

function validateWireframeDir(result) {
  const wireframeDir = 'generated-docs/specs/wireframes';
  if (!fs.existsSync(wireframeDir)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/specs/wireframes/ directory');
  } else {
    const wireframes = findFiles(wireframeDir, '*.md');
    if (wireframes.length === 0) {
      result.status = 'invalid';
      result.missing.push('wireframe markdown files');
    } else {
      result.found.push(`${wireframes.length} wireframe file(s)`);
    }
    const overviewFile = path.join(wireframeDir, '_overview.md');
    if (!fs.existsSync(overviewFile)) {
      result.warnings.push('_overview.md not found (optional but recommended)');
    } else {
      result.found.push('wireframes/_overview.md');
    }
  }
}

function extractImportsFromTestFile(testFilePath) {
  // Extract import paths from a test file to verify implementation exists
  try {
    const content = fs.readFileSync(testFilePath, 'utf-8');
    const imports = [];

    // Match import statements with @/ paths
    const importRegex = /import\s+.*from\s+['"](@\/[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  } catch {
    return [];
  }
}

function resolveAliasPath(aliasPath) {
  // Convert @/ path to actual file path
  if (aliasPath.startsWith('@/')) {
    const relativePath = aliasPath.replace('@/', 'web/src/');
    // Try with common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
    for (const ext of extensions) {
      const fullPath = relativePath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

// =============================================================================
// PHASE VALIDATORS
// =============================================================================

function validateIntake() {
  const result = {
    status: 'valid',
    phase: 'INTAKE',
    expected: ['generated-docs/context/intake-manifest.json', 'generated-docs/specs/feature-requirements.md'],
    found: [],
    missing: [],
    warnings: []
  };

  // Check intake manifest (critical)
  const manifestPath = 'generated-docs/context/intake-manifest.json';
  if (!fs.existsSync(manifestPath)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/context/intake-manifest.json');
  } else if (!fileHasContent(manifestPath, 10)) {
    result.status = 'invalid';
    result.missing.push('intake-manifest.json exists but has no content');
  } else {
    // Validate it's parseable JSON
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      if (!manifest.artifacts || !manifest.context) {
        result.warnings.push('intake-manifest.json missing expected top-level keys (artifacts, context)');
      }
      result.found.push('intake-manifest.json');
    } catch {
      result.status = 'invalid';
      result.missing.push('intake-manifest.json exists but is not valid JSON');
    }
  }

  // Check Feature Requirements Specification (critical)
  const frsPath = 'generated-docs/specs/feature-requirements.md';
  if (!fs.existsSync(frsPath)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/specs/feature-requirements.md');
  } else if (!fileHasContent(frsPath, 50)) {
    result.status = 'invalid';
    result.missing.push('feature-requirements.md exists but has no meaningful content');
  } else {
    result.found.push('feature-requirements.md');
  }

  return result;
}

function validateDesign() {
  const result = {
    status: 'valid',
    phase: 'DESIGN',
    expected: [],
    found: [],
    missing: [],
    warnings: []
  };

  // Try to read intake manifest to determine which artifacts are expected
  const manifestPath = 'generated-docs/context/intake-manifest.json';
  let manifest = null;

  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      result.warnings.push('intake-manifest.json exists but is not valid JSON — falling back to wireframe-only validation');
    }
  }

  if (manifest && manifest.artifacts) {
    const artifacts = manifest.artifacts;

    // Validate API spec
    if (artifacts.apiSpec && (artifacts.apiSpec.generate || artifacts.apiSpec.userProvided)) {
      const apiSpecPath = 'generated-docs/specs/api-spec.yaml';
      result.expected.push(apiSpecPath);
      if (!fs.existsSync(apiSpecPath)) {
        result.status = 'invalid';
        result.missing.push('generated-docs/specs/api-spec.yaml');
      } else if (!fileHasContent(apiSpecPath, 10)) {
        result.status = 'invalid';
        result.missing.push('api-spec.yaml exists but has no content');
      } else {
        result.found.push('api-spec.yaml');
      }
    }

    // Validate design tokens CSS
    if (artifacts.designTokensCss && (artifacts.designTokensCss.generate || artifacts.designTokensCss.userProvided)) {
      const cssPath = 'generated-docs/specs/design-tokens.css';
      result.expected.push(cssPath);
      if (!fs.existsSync(cssPath)) {
        result.status = 'invalid';
        result.missing.push('generated-docs/specs/design-tokens.css');
      } else if (!fileHasContent(cssPath, 10)) {
        result.status = 'invalid';
        result.missing.push('design-tokens.css exists but has no content');
      } else {
        result.found.push('design-tokens.css');
      }
    }

    // Validate design tokens MD
    if (artifacts.designTokensMd && (artifacts.designTokensMd.generate || artifacts.designTokensMd.userProvided)) {
      const mdPath = 'generated-docs/specs/design-tokens.md';
      result.expected.push(mdPath);
      if (!fs.existsSync(mdPath)) {
        result.status = 'invalid';
        result.missing.push('generated-docs/specs/design-tokens.md');
      } else if (!fileHasContent(mdPath, 10)) {
        result.status = 'invalid';
        result.missing.push('design-tokens.md exists but has no content');
      } else {
        result.found.push('design-tokens.md');
      }
    }

    // Validate wireframes
    if (artifacts.wireframes && (artifacts.wireframes.generate || artifacts.wireframes.userProvided)) {
      result.expected.push('wireframes in generated-docs/specs/wireframes/');
      validateWireframeDir(result);
    }

    // If no artifacts were expected, DESIGN is trivially valid
    if (result.expected.length === 0) {
      result.found.push('No DESIGN artifacts required by manifest');
    }
  } else {
    // Fallback: no manifest — check wireframes only (backwards compatibility)
    result.expected.push('wireframes in generated-docs/specs/wireframes/');
    result.warnings.push('No intake manifest found — validating wireframes only (legacy mode)');
    validateWireframeDir(result);
  }

  return result;
}

function validateScope() {
  const result = {
    status: 'valid',
    phase: 'SCOPE',
    expected: ['_feature-overview.md with epics defined'],
    found: [],
    missing: [],
    warnings: []
  };

  const storiesDir = 'generated-docs/stories';
  const featureOverview = path.join(storiesDir, '_feature-overview.md');

  // Check feature overview
  if (!fs.existsSync(featureOverview)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/stories/_feature-overview.md');
    return result;
  }

  if (!fileHasContent(featureOverview, 50)) {
    result.status = 'invalid';
    result.missing.push('_feature-overview.md has no content');
    return result;
  }

  // Verify feature overview contains epic definitions
  try {
    const content = fs.readFileSync(featureOverview, 'utf-8');
    if (!content.includes('Epic') && !content.includes('epic')) {
      result.status = 'invalid';
      result.missing.push('_feature-overview.md does not contain epic definitions');
    } else {
      result.found.push('_feature-overview.md with epic definitions');
    }
  } catch {
    result.status = 'invalid';
    result.missing.push('Could not read _feature-overview.md');
  }

  return result;
}

function validateStories(epicNum) {
  const result = {
    status: 'valid',
    phase: 'STORIES',
    epic: epicNum,
    expected: ['epic directory with story files and acceptance criteria'],
    found: [],
    missing: [],
    warnings: []
  };

  if (!epicNum) {
    result.status = 'invalid';
    result.missing.push('Epic number required for STORIES validation');
    return result;
  }

  const storiesDir = 'generated-docs/stories';

  // Check stories directory exists
  if (!fs.existsSync(storiesDir)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/stories/ directory');
    return result;
  }

  // Find epic directory
  const epicDirs = fs.readdirSync(storiesDir)
    .filter(d => d.startsWith(`epic-${epicNum}`))
    .map(d => path.join(storiesDir, d))
    .filter(d => fs.statSync(d).isDirectory());

  if (epicDirs.length === 0) {
    result.status = 'invalid';
    result.missing.push(`epic-${epicNum}-* directory`);
    return result;
  }

  const epicDir = epicDirs[0];
  const epicName = path.basename(epicDir);

  // Check epic overview
  const epicOverview = path.join(epicDir, '_epic-overview.md');
  if (!fs.existsSync(epicOverview)) {
    result.warnings.push(`${epicName}/_epic-overview.md missing`);
  } else {
    result.found.push(`${epicName}/_epic-overview.md`);
  }

  // Check story files
  const storyFiles = findFiles(epicDir, 'story-*.md');

  if (storyFiles.length === 0) {
    result.status = 'invalid';
    result.missing.push(`${epicName}/story-*.md files`);
    return result;
  }

  result.found.push(`${epicName}: ${storyFiles.length} story file(s)`);

  // Validate story files have acceptance criteria
  for (const storyFile of storyFiles) {
    try {
      const content = fs.readFileSync(storyFile, 'utf-8');
      if (!content.includes('## Acceptance Criteria') && !content.includes('### ')) {
        result.warnings.push(`${path.basename(storyFile)} may be missing acceptance criteria`);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return result;
}

function validateTestDesign(epicNum, storyNum) {
  const result = {
    status: 'valid',
    phase: 'TEST-DESIGN',
    epic: epicNum,
    story: storyNum,
    expected: storyNum
      ? [`test-design document for epic-${epicNum} story-${storyNum}`]
      : [`test-design documents for epic-${epicNum}`],
    found: [],
    missing: [],
    warnings: []
  };

  if (!epicNum) {
    result.status = 'invalid';
    result.missing.push('Epic number required for TEST-DESIGN validation');
    return result;
  }

  const testDesignDir = 'generated-docs/test-design';

  if (!fs.existsSync(testDesignDir)) {
    result.status = 'invalid';
    result.missing.push('generated-docs/test-design/ directory');
    return result;
  }

  // Find epic directory within test-design
  const epicDirs = fs.readdirSync(testDesignDir)
    .filter(d => d.startsWith(`epic-${epicNum}`))
    .map(d => path.join(testDesignDir, d))
    .filter(d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });

  if (epicDirs.length === 0) {
    result.status = 'invalid';
    result.missing.push(`epic-${epicNum}-* directory in generated-docs/test-design/`);
    return result;
  }

  const epicDir = epicDirs[0];

  // Find test-design files
  const designFiles = fs.readdirSync(epicDir)
    .filter(f => {
      const matchesStory = storyNum ? f.includes(`story-${storyNum}`) : true;
      return matchesStory && f.endsWith('-test-design.md');
    });

  if (designFiles.length === 0) {
    result.status = 'invalid';
    const pattern = storyNum
      ? `story-${storyNum}-*-test-design.md`
      : `*-test-design.md`;
    result.missing.push(`test-design files matching ${pattern}`);
    return result;
  }

  const desc = storyNum
    ? `${designFiles.length} test-design file(s) for epic-${epicNum} story-${storyNum}`
    : `${designFiles.length} test-design file(s) for epic-${epicNum}`;
  result.found.push(desc);

  // Validate test-design files have meaningful content
  for (const designFile of designFiles) {
    const fullPath = path.join(epicDir, designFile);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.length < 100) {
        result.warnings.push(`${designFile} appears too short to be a meaningful test-design document`);
      }
      if (!content.includes('## ')) {
        result.warnings.push(`${designFile} may be missing expected sections`);
      }
    } catch {
      result.warnings.push(`Could not read ${designFile}`);
    }
  }

  return result;
}

function validateSpecify(epicNum, storyNum) {
  const result = {
    status: 'valid',
    phase: 'WRITE-TESTS',
    epic: epicNum,
    story: storyNum,
    expected: storyNum
      ? [`test files for epic-${epicNum} story-${storyNum}`]
      : [`test files for epic-${epicNum}`],
    found: [],
    missing: [],
    warnings: []
  };

  if (!epicNum) {
    result.status = 'invalid';
    result.missing.push('Epic number required for WRITE-TESTS validation');
    return result;
  }

  // Look for test files in integration directory
  const testDir = 'web/src/__tests__/integration';

  if (!fs.existsSync(testDir)) {
    result.status = 'invalid';
    result.missing.push('web/src/__tests__/integration/ directory');
    return result;
  }

  // Find test files for this epic (and optionally story)
  const testFiles = fs.readdirSync(testDir)
    .filter(f => {
      const matchesEpic = f.includes(`epic-${epicNum}`);
      const matchesStory = storyNum ? f.includes(`story-${storyNum}`) : true;
      const isTestFile = f.endsWith('.test.tsx') || f.endsWith('.test.ts');
      return matchesEpic && matchesStory && isTestFile;
    });

  if (testFiles.length === 0) {
    result.status = 'invalid';
    const pattern = storyNum
      ? `epic-${epicNum}-story-${storyNum}-*.test.tsx`
      : `epic-${epicNum}-*.test.tsx`;
    result.missing.push(`test files matching ${pattern}`);
    return result;
  }

  const desc = storyNum
    ? `${testFiles.length} test file(s) for epic-${epicNum} story-${storyNum}`
    : `${testFiles.length} test file(s) for epic-${epicNum}`;
  result.found.push(desc);

  // Validate test files have actual test content
  for (const testFile of testFiles) {
    const fullPath = path.join(testDir, testFile);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');

      if (!content.includes('describe(') && !content.includes('it(') && !content.includes('test(')) {
        result.warnings.push(`${testFile} has no test blocks`);
      }

      if (content.includes('.skip(') || content.includes('.todo(')) {
        result.warnings.push(`${testFile} contains skipped or todo tests`);
      }
    } catch {
      result.warnings.push(`Could not read ${testFile}`);
    }
  }

  return result;
}

function validateImplement(epicNum, storyNum) {
  const result = {
    status: 'valid',
    phase: 'IMPLEMENT',
    epic: epicNum,
    story: storyNum,
    expected: ['implementation files referenced by tests'],
    found: [],
    missing: [],
    warnings: []
  };

  if (!epicNum) {
    result.status = 'invalid';
    result.missing.push('Epic number required for IMPLEMENT validation');
    return result;
  }

  // Find test files for this epic (and optionally story)
  const testDir = 'web/src/__tests__/integration';

  if (!fs.existsSync(testDir)) {
    result.warnings.push('No integration test directory found');
    return result;
  }

  const testFiles = fs.readdirSync(testDir)
    .filter(f => {
      const matchesEpic = f.includes(`epic-${epicNum}`);
      const matchesStory = storyNum ? f.includes(`story-${storyNum}`) : true;
      const isTestFile = f.endsWith('.test.tsx') || f.endsWith('.test.ts');
      return matchesEpic && matchesStory && isTestFile;
    })
    .map(f => path.join(testDir, f));

  if (testFiles.length === 0) {
    const desc = storyNum ? `epic-${epicNum} story-${storyNum}` : `epic-${epicNum}`;
    result.warnings.push(`No test files found for ${desc}`);
    return result;
  }

  // Extract imports from test files and verify they exist
  const allImports = new Set();
  for (const testFile of testFiles) {
    const imports = extractImportsFromTestFile(testFile);
    imports.forEach(i => allImports.add(i));
  }

  let foundCount = 0;
  let missingCount = 0;

  for (const importPath of allImports) {
    // Skip test utilities and mocks
    if (importPath.includes('__tests__') || importPath.includes('mock') || importPath.includes('test-utils')) {
      continue;
    }

    const resolved = resolveAliasPath(importPath);
    if (resolved) {
      foundCount++;
      result.found.push(importPath);
    } else {
      missingCount++;
      result.missing.push(`${importPath} (referenced in tests but not found)`);
    }
  }

  if (missingCount > 0 && foundCount === 0) {
    result.status = 'invalid';
  } else if (missingCount > 0) {
    result.status = 'partial';
  }

  return result;
}

function validateQA(epicNum, storyNum) {
  const result = {
    status: 'valid',
    phase: 'QA',
    epic: epicNum,
    story: storyNum,
    expected: ['review findings or marker', 'quality-gate-status.json'],
    found: [],
    missing: [],
    warnings: []
  };

  let hasReviewArtifact = false;
  let hasQualityGates = false;

  // Check for review findings JSON
  const findingsPath = 'generated-docs/context/review-findings.json';
  if (fs.existsSync(findingsPath)) {
    try {
      const content = fs.readFileSync(findingsPath, 'utf-8');
      const findings = JSON.parse(content);
      if (findings.recommendation) {
        result.found.push('review-findings.json with recommendation');
        hasReviewArtifact = true;
      }
    } catch {
      result.warnings.push('review-findings.json exists but is invalid');
    }
  }

  // Check for story-specific review marker
  if (!hasReviewArtifact && epicNum && storyNum) {
    const reviewMarker = `generated-docs/reviews/epic-${epicNum}-story-${storyNum}-review.md`;
    if (fs.existsSync(reviewMarker)) {
      result.found.push(`epic-${epicNum}-story-${storyNum}-review.md`);
      hasReviewArtifact = true;
    }
  }

  // Check for epic-specific review marker
  if (!hasReviewArtifact && epicNum) {
    const reviewMarker = `generated-docs/reviews/epic-${epicNum}-review.md`;
    if (fs.existsSync(reviewMarker)) {
      result.found.push(`epic-${epicNum}-review.md`);
      hasReviewArtifact = true;
    }
  }

  // Check workflow state for QA status
  if (!hasReviewArtifact) {
    const statePath = 'generated-docs/context/workflow-state.json';
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        if (state.epics && epicNum && state.epics[epicNum]) {
          const epicState = state.epics[epicNum];

          // Check story-level phase if storyNum provided
          if (storyNum && epicState.stories && epicState.stories[storyNum]) {
            const storyState = epicState.stories[storyNum];
            if (storyState.phase === 'COMPLETE') {
              result.found.push('workflow state indicates story QA completed');
              hasReviewArtifact = true;
            }
          }

          // Check epic-level phase
          if (!hasReviewArtifact && epicState.phase === 'COMPLETE') {
            result.found.push('workflow state indicates QA completed');
            hasReviewArtifact = true;
          }
        }
      } catch {
        // Invalid state file
      }
    }
  }

  // Check quality gate status
  const statusPath = 'generated-docs/context/quality-gate-status.json';
  if (fs.existsSync(statusPath)) {
    try {
      const content = fs.readFileSync(statusPath, 'utf-8');
      const status = JSON.parse(content);

      if (!status.overallStatus) {
        result.warnings.push('quality-gate-status.json missing overallStatus');
      } else if (status.overallStatus === 'pass') {
        result.found.push('quality-gate-status.json with passing status');
        hasQualityGates = true;
      } else {
        result.warnings.push(`quality-gate-status.json shows ${status.overallStatus} status`);
      }

      // Check that gates are present
      if (!status.gates) {
        result.warnings.push('quality-gate-status.json missing gates object');
      } else {
        const gateCount = Object.keys(status.gates).length;
        result.found.push(`${gateCount} quality gates recorded`);
        hasQualityGates = true;
      }

      // If story-level validation, check that status includes story info
      if (storyNum && status.story !== storyNum) {
        result.warnings.push(`quality-gate-status.json may not be for story ${storyNum}`);
      }
    } catch {
      result.warnings.push('quality-gate-status.json is invalid JSON');
    }
  }

  // Determine overall status
  if (!hasReviewArtifact && !hasQualityGates) {
    result.status = 'invalid';
    result.missing.push('No QA completion indicators found (review artifacts or quality gate status)');
  } else if (!hasReviewArtifact || !hasQualityGates) {
    result.status = 'partial';
    if (!hasReviewArtifact) {
      result.missing.push('No review completion indicator found');
    }
    if (!hasQualityGates) {
      result.missing.push('quality-gate-status.json not found or invalid');
    }
  }

  return result;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node .claude/scripts/validate-phase-output.js --phase <PHASE> [--epic <N>] [--story <M>]

Workflow Structure (4 Stages):
  Stage 1: INTAKE (gather requirements, produce FRS) → DESIGN (once) → SCOPE (define epics only)
  Stage 2: Per-Epic: STORIES (define stories for current epic)
  Stage 3: Per-Story: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA

Phases: INTAKE, DESIGN, SCOPE, STORIES, TEST-DESIGN, WRITE-TESTS, IMPLEMENT, QA

Options:
  --phase <PHASE>  Phase to validate (required)
  --epic <N>       Epic number (required for STORIES, TEST-DESIGN, WRITE-TESTS, IMPLEMENT, QA)
  --story <M>      Story number (optional, for per-story validation)

Exit codes:
  0 - All expected artifacts found
  1 - Some non-critical artifacts missing (warnings)
  2 - Critical artifacts missing (phase not complete)
`);
    process.exit(0);
  }

  let phase = null;
  let epicNum = null;
  let storyNum = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && args[i + 1]) {
      phase = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--epic' && args[i + 1]) {
      epicNum = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--story' && args[i + 1]) {
      storyNum = parseInt(args[i + 1]);
      i++;
    }
  }

  if (!phase) {
    console.log(JSON.stringify({
      status: 'error',
      message: 'Missing required --phase argument'
    }, null, 2));
    process.exit(2);
  }

  const validators = {
    'INTAKE': () => validateIntake(),
    'DESIGN': () => validateDesign(),
    'SCOPE': () => validateScope(),
    'STORIES': () => validateStories(epicNum),
    'TEST-DESIGN': () => validateTestDesign(epicNum, storyNum),
    'WRITE-TESTS': () => validateSpecify(epicNum, storyNum),
    'IMPLEMENT': () => validateImplement(epicNum, storyNum),
    'QA': () => validateQA(epicNum, storyNum)
  };

  if (!validators[phase]) {
    console.log(JSON.stringify({
      status: 'error',
      message: `Unknown phase: ${phase}. Valid phases: ${Object.keys(validators).join(', ')}`
    }, null, 2));
    process.exit(2);
  }

  const result = validators[phase]();

  // Add summary message
  if (result.status === 'valid') {
    result.message = `All expected artifacts found for ${phase} phase`;
  } else if (result.status === 'partial') {
    result.message = `Some artifacts found for ${phase} phase, but some are missing`;
  } else {
    result.message = `${phase} phase validation failed - critical artifacts missing`;
  }

  console.log(JSON.stringify(result, null, 2));

  // Set exit code based on status
  if (result.status === 'invalid') {
    process.exit(2);
  } else if (result.status === 'partial' || result.warnings.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
