#!/usr/bin/env node
/**
 * workflow-helpers.js
 * Shared helpers used by transition-phase.js and detect-workflow-state.js
 *
 * Extracted to avoid duplication and ensure consistent behavior across scripts.
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// PHASE CONSTANTS
// =============================================================================

// Global phases run once for the entire feature (not per-epic)
const GLOBAL_PHASES = ['INTAKE', 'DESIGN', 'SCOPE'];

// Per-story phases in TDD cycle order
const STORY_PHASES = ['REALIGN', 'TEST-DESIGN', 'WRITE-TESTS', 'IMPLEMENT', 'QA'];

// All valid phases
const ALL_PHASES = [...GLOBAL_PHASES, 'STORIES', ...STORY_PHASES, 'COMPLETE', 'PENDING'];

// =============================================================================
// PATH CONSTANTS
// =============================================================================

const STORIES_DIR = 'generated-docs/stories';
const TEST_DIR = 'web/src/__tests__/integration';
const TEST_DESIGN_DIR = 'generated-docs/test-design';
const WIREFRAMES_DIR = 'generated-docs/specs/wireframes';
const IMPACTS_PATH = 'generated-docs/discovered-impacts.md';
const STATE_FILE = 'generated-docs/context/workflow-state.json';
const INTAKE_MANIFEST_FILE = 'generated-docs/context/intake-manifest.json';
const FRS_PATH = 'generated-docs/specs/feature-requirements.md';
const API_SPEC_PATH = 'generated-docs/specs/api-spec.yaml';
const HANDLERS_PATH = 'web/src/mocks/handlers.ts';
const SNAPSHOT_PATH = 'generated-docs/context/mock-spec-snapshot.yaml';

// =============================================================================
// DISPLAY CONSTANTS
// =============================================================================

const AGENT_DISPLAY_NAMES = {
  'design-api-agent': 'API Spec Agent',
  'design-style-agent': 'Style Agent',
  'design-wireframe-agent': 'Wireframe Agent',
  'mock-setup-agent': 'Mock Setup',
  'type-generator-agent': 'Type Generator'
};

// Shared regex source for AC-N identifiers (used by multiple traceability functions).
// Must call to get a fresh RegExp (global regexes are stateful).
function acIdRegex() { return /AC-\d+/g; }

// =============================================================================
// FILE FINDING HELPERS
// =============================================================================

function findFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');

  try {
    return fs.readdirSync(dir)
      .filter(file => regex.test(file))
      .map(file => path.join(dir, file));
  } catch {
    return [];
  }
}

function findFilesRecursive(dir, pattern) {
  if (!fs.existsSync(dir)) return [];

  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  const results = [];

  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors on individual directories
    }
  }

  walk(dir);
  return results;
}

// =============================================================================
// EPIC / STORY DIRECTORY HELPERS
// =============================================================================

/**
 * Find the directory path for a given epic number.
 * Returns the full path (e.g., 'generated-docs/stories/epic-1-dashboard') or null.
 */
function findEpicDir(epicNum) {
  if (!fs.existsSync(STORIES_DIR)) return null;

  try {
    const entries = fs.readdirSync(STORIES_DIR);
    const match = entries.find(d => {
      const m = d.match(/^epic-(\d+)/);
      return m && parseInt(m[1]) === epicNum;
    });

    if (match) {
      const fullPath = path.join(STORIES_DIR, match);
      try {
        if (fs.statSync(fullPath).isDirectory()) return fullPath;
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Find all story files in an epic directory.
 * Returns array of { num, title, path } sorted by story number.
 */
function findStoryFiles(epicDir) {
  const storyFiles = findFiles(epicDir, 'story-*.md').sort();
  const results = [];

  for (const file of storyFiles) {
    const basename = path.basename(file, '.md');
    const numMatch = basename.match(/story-(\d+)/);
    if (numMatch) {
      results.push({
        num: parseInt(numMatch[1]),
        title: basename,
        path: file
      });
    }
  }

  return results;
}

// =============================================================================
// ACCEPTANCE CRITERIA HELPERS
// =============================================================================

/**
 * Extract the Acceptance Criteria section from a story file's content.
 * Returns { text, startOffset, endOffset } or null if not found.
 * text is just the AC section body; startOffset/endOffset are byte offsets
 * into the original content for replacement operations.
 */
function extractACSection(content) {
  const acHeaderPattern = /^## Acceptance Criteria\s*$/m;
  const acStart = content.search(acHeaderPattern);
  if (acStart === -1) return null;

  const afterHeader = content.indexOf('\n', acStart) + 1;
  const nextH2 = content.indexOf('\n## ', afterHeader);
  const acEnd = nextH2 === -1 ? content.length : nextH2;

  return {
    text: content.slice(afterHeader, acEnd),
    startOffset: afterHeader,
    endOffset: acEnd
  };
}

/**
 * Count checked/unchecked ACs for a single story.
 * Scoped to ## Acceptance Criteria section only.
 */
function countStoryAC(epicDir, storyNum) {
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return { total: 0, checked: 0 };

  try {
    const content = fs.readFileSync(story.path, 'utf-8');
    const ac = extractACSection(content);
    if (!ac) return { total: 0, checked: 0 };

    const checkedMatches = ac.text.match(/^\s*[-*] \[[xX]\]/gm);
    const uncheckedMatches = ac.text.match(/^\s*[-*] \[ \]/gm);

    const checked = checkedMatches ? checkedMatches.length : 0;
    const unchecked = uncheckedMatches ? uncheckedMatches.length : 0;

    return { total: checked + unchecked, checked };
  } catch {
    return { total: 0, checked: 0 };
  }
}

/**
 * Count checked/unchecked ACs across ALL stories in an epic.
 * Scoped to ## Acceptance Criteria section per file.
 */
function countEpicAC(epicDir) {
  const stories = findStoryFiles(epicDir);
  let checked = 0;
  let unchecked = 0;

  for (const story of stories) {
    const ac = countStoryAC(epicDir, story.num);
    checked += ac.checked;
    unchecked += ac.total - ac.checked;
  }

  return { checked, unchecked };
}

/**
 * Auto-check all ACs in a story file (replace [ ] with [x]).
 * Scoped to ## Acceptance Criteria section only.
 * Used by --pre-complete-checks before commit.
 */
function checkAllAcceptanceCriteria(epicDir, storyNum) {
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return;

  let content;
  try {
    content = fs.readFileSync(story.path, 'utf-8');
  } catch {
    return;
  }

  const ac = extractACSection(content);
  if (!ac) return;

  const before = content.slice(0, ac.startOffset);
  const after = content.slice(ac.endOffset);

  const checkedSection = ac.text.replace(/^(\s*[-*] )\[ \]/gm, '$1[x]');
  const newContent = before + checkedSection + after;

  fs.writeFileSync(story.path, newContent);
}

// =============================================================================
// STORY METADATA HELPERS
// =============================================================================

/**
 * Extract the Route field from a story file's Story Metadata table.
 * Returns the route string (e.g., '/', '/dashboard', 'N/A') or null if not found.
 */
function extractStoryRoute(content) {
  // Match the Route row in the Story Metadata table: | **Route** | `/dashboard` |
  const routeMatch = content.match(/\|\s*\*?\*?Route\*?\*?\s*\|\s*`?([^`|\n]+?)`?\s*\|/i);
  if (!routeMatch) return null;
  return routeMatch[1].trim();
}

/**
 * Get all stories in an epic that had manual verification auto-skipped
 * (Route: N/A, phase: COMPLETE, manualVerification: 'auto-skipped').
 * Returns array of { number, name, route, acceptanceCriteria } for stories
 * awaiting deferred manual verification.
 */
function getDeferredVerificationStories(epicNum) {
  const state = readWorkflowState();
  if (!state?.epics?.[epicNum]?.stories) return [];

  const epicDir = findEpicDir(epicNum);
  if (!epicDir) return [];

  const deferred = [];
  const storyFiles = findStoryFiles(epicDir);

  for (const [sNum, storyState] of Object.entries(state.epics[epicNum].stories)) {
    if (storyState.manualVerification !== 'auto-skipped') continue;

    const storyFile = storyFiles.find(s => s.num === parseInt(sNum));
    if (!storyFile) continue;

    try {
      const content = fs.readFileSync(storyFile.path, 'utf-8');
      const ac = extractACSection(content);
      deferred.push({
        number: parseInt(sNum),
        name: storyState.name || storyFile.title,
        route: extractStoryRoute(content) || 'N/A',
        acceptanceCriteria: ac ? ac.text.trim() : null
      });
    } catch {
      // Skip unreadable files
    }
  }

  return deferred;
}

// =============================================================================
// TEST FILE HELPERS
// =============================================================================

/**
 * Count test files for a specific story.
 * Options:
 *   dirs: array of directories to search (default: [TEST_DIR])
 *   recursive: if true, search directories recursively (default: false)
 */
function countTestFiles(epicNum, storyNum, options) {
  const dirs = options?.dirs || [TEST_DIR];
  const recursive = options?.recursive || false;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, recursive ? { recursive: true } : undefined);
      const testFiles = entries.filter(f =>
        typeof f === 'string' &&
        f.includes(`epic-${epicNum}`) &&
        f.includes(`story-${storyNum}`) &&
        (f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
      );
      if (testFiles.length > 0) return testFiles.length;
    } catch {
      // skip unreadable dirs
    }
  }
  return 0;
}

/**
 * Count wireframe files in the specs/wireframes directory.
 */
function countWireframes() {
  return findFilesRecursive(WIREFRAMES_DIR, '*.md').length;
}

// =============================================================================
// STORY PHASE DETERMINATION
// =============================================================================

/**
 * Find a test-design file for a given epic/story.
 * Returns the file path or null if not found.
 */
function findTestDesignFile(epicNum, storyNum) {
  if (!fs.existsSync(TEST_DESIGN_DIR)) return null;

  try {
    const epicDirs = fs.readdirSync(TEST_DESIGN_DIR)
      .filter(d => d.match(new RegExp(`^epic-${epicNum}`)));
    for (const epicDir of epicDirs) {
      const fullDir = path.join(TEST_DESIGN_DIR, epicDir);
      try {
        if (!fs.statSync(fullDir).isDirectory()) continue;
        const files = fs.readdirSync(fullDir)
          .filter(f => f.match(new RegExp(`^story-${storyNum}-.*test-design\\.md$`)));
        if (files.length > 0) return path.join(fullDir, files[0]);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Determine if a story has a test-design document.
 */
function storyHasTestDesign(epicNum, storyNum) {
  return findTestDesignFile(epicNum, storyNum) !== null;
}

/**
 * Determine if a story has tests.
 */
function storyHasTests(epicNum, storyNum, options) {
  return countTestFiles(epicNum, storyNum, options) > 0;
}

/**
 * Find the first incomplete story in an epic.
 * Returns { name, number, phase } or null if all complete.
 *
 * CONTRACT: Returns a "raw" phase (TEST-DESIGN, WRITE-TESTS, or IMPLEMENT)
 * based solely on AC checkboxes, test-design doc, and test file existence.
 * It does NOT determine REALIGN — the caller must combine its result with
 * getDiscoveredImpactsForEpic():
 *
 *   const story = findFirstIncompleteStory(epicDir, epicNum);
 *   const impacts = getDiscoveredImpactsForEpic(epicNum);
 *   if (impacts.hasImpactsForEpic && story.phase === 'TEST-DESIGN') {
 *     story.phase = 'REALIGN';
 *   }
 */
function findFirstIncompleteStory(epicDir, epicNum) {
  const stories = getStoryStates(epicDir, epicNum);
  return stories.find(s => s.phase !== 'COMPLETE') || null;
}

/**
 * Get phase state for all stories in an epic.
 * Returns array of { name, number, phase, hasTests }.
 * Options (passed through to countTestFiles):
 *   dirs: array of directories to search for test files
 *   recursive: if true, search directories recursively
 */
function getStoryStates(epicDir, epicNum, options) {
  const storyFiles = findFiles(epicDir, 'story-*.md').sort();
  const stories = [];

  for (const file of storyFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const storyName = path.basename(file, '.md');
      const storyNumMatch = storyName.match(/story-(\d+)/);
      const storyNum = storyNumMatch ? parseInt(storyNumMatch[1]) : 0;

      const ac = extractACSection(content);
      const hasUncheckedCriteria = ac ? /^\s*[-*] \[ \]/m.test(ac.text) : false;
      const hasTestDesign = storyHasTestDesign(epicNum, storyNum);
      const hasTests = storyHasTests(epicNum, storyNum, options);

      let storyPhase;
      if (!hasUncheckedCriteria) {
        storyPhase = 'COMPLETE';
      } else if (!hasTestDesign && !hasTests) {
        storyPhase = 'TEST-DESIGN';
      } else if (!hasTests) {
        storyPhase = 'WRITE-TESTS';
      } else {
        storyPhase = 'IMPLEMENT';
      }

      const route = extractStoryRoute(content);

      stories.push({
        name: storyName,
        number: storyNum,
        phase: storyPhase,
        hasTestDesign,
        hasTests,
        route: route || null
      });
    } catch {
      // Skip unreadable files
    }
  }

  return stories;
}

// =============================================================================
// DISCOVERED IMPACTS
// =============================================================================

/**
 * Check discovered-impacts.md for impacts affecting a specific epic.
 */
function getDiscoveredImpactsForEpic(epicNum) {
  if (!fs.existsSync(IMPACTS_PATH)) {
    return { exists: false, hasImpactsForEpic: false, impactCount: 0 };
  }

  try {
    const content = fs.readFileSync(IMPACTS_PATH, 'utf-8');
    if (!content.trim()) {
      return { exists: true, hasImpactsForEpic: false, impactCount: 0 };
    }

    const epicPattern = new RegExp(`\\*\\*Affects:\\*\\*.*Epic\\s+${epicNum}[,:\\s]`, 'gi');
    const matches = content.match(epicPattern);
    const impactCount = matches ? matches.length : 0;

    return {
      exists: true,
      hasImpactsForEpic: impactCount > 0,
      impactCount
    };
  } catch {
    return { exists: false, hasImpactsForEpic: false, impactCount: 0 };
  }
}

// =============================================================================
// QA COMPLETION CHECK
// =============================================================================

/**
 * Check QA completion across 3 sources:
 * 1. workflow-state.json (phases.QA.status)
 * 2. review-findings.json (recommendation field)
 * 3. Epic-specific review file (epic-{N}-review.md)
 */
function checkQAComplete(epicNum) {
  // Source 1: workflow-state.json
  const state = readWorkflowState();
  if (state?.phases?.QA?.status === 'completed') {
    return true;
  }

  // Source 2: review-findings.json
  const reviewFindingsPath = 'generated-docs/context/review-findings.json';
  if (fs.existsSync(reviewFindingsPath)) {
    try {
      const content = fs.readFileSync(reviewFindingsPath, 'utf-8');
      const findings = JSON.parse(content);
      if (findings.recommendation) {
        return true;
      }
    } catch {
      // Invalid JSON
    }
  }

  // Source 3: epic-specific review file
  const reviewMarkerPath = `generated-docs/reviews/epic-${epicNum}-review.md`;
  if (fs.existsSync(reviewMarkerPath)) {
    return true;
  }

  return false;
}

// =============================================================================
// STATE FILE READERS
// =============================================================================

/**
 * Read and parse workflow-state.json. Returns the parsed object or null.
 */
function readWorkflowState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read and parse intake-manifest.json. Returns the parsed object or null.
 */
function readIntakeManifest() {
  if (!fs.existsSync(INTAKE_MANIFEST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(INTAKE_MANIFEST_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Convert a slug like "epic-1-onboarding-flow" to "Epic 1: Onboarding flow".
 */
function friendlyName(slug, type) {
  if (!slug) return slug;
  const prefixRe = new RegExp(`^${type}-(\\d+)-?`);
  const m = slug.match(prefixRe);
  if (!m) return slug;
  const num = m[1];
  const rest = slug.slice(m[0].length);
  if (!rest) return `${type.charAt(0).toUpperCase() + type.slice(1)} ${num}`;
  const words = rest.split('-');
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${num}: ${words.join(' ')}`;
}

// =============================================================================
// AC TRACEABILITY PARSING (for dashboard test coverage card)
// =============================================================================

/**
 * Extract AC-N entries from story file content.
 * Returns array of { id, text, checked }.
 */
function parseACsFromContent(content) {
  const results = [];
  const re = /- \[([ xX])\] (AC-\d+): (.+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    results.push({ id: m[2], text: m[3].trim(), checked: m[1].toLowerCase() === 'x' });
  }
  return results;
}

/**
 * Parse AC-N identifiers from a story file.
 * Returns array of { id, text, checked } for each AC with an AC-N prefix.
 */
function parseACsFromStory(epicNum, storyNum) {
  const epicDir = findEpicDir(epicNum);
  if (!epicDir) return [];
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);
  if (!story) return [];

  try {
    return parseACsFromContent(fs.readFileSync(story.path, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Parse the Coverage for WRITE-TESTS section of a test-design document.
 * Returns { coveredACs: Set<string>, baDecisionsPending: number }.
 * Only scans between "## Coverage for WRITE-TESTS" and the next "##" header.
 */
function parseTestDesignCoverage(epicNum, storyNum) {
  const result = { coveredACs: new Set(), baDecisionsPending: 0 };
  const tdPath = findTestDesignFile(epicNum, storyNum);
  if (!tdPath) return result;

  try {
    const tdContent = fs.readFileSync(tdPath, 'utf-8');

    // Count BA decisions in full document
    const baMatches = tdContent.match(/BA decision required/gi);
    result.baDecisionsPending = baMatches ? baMatches.length : 0;

    // Extract only the Coverage for WRITE-TESTS section
    const coverageHeader = '## Coverage for WRITE-TESTS';
    const coverageStart = tdContent.indexOf(coverageHeader);
    if (coverageStart === -1) return result;
    const afterCoverage = tdContent.slice(coverageStart + coverageHeader.length);
    const nextHeader = afterCoverage.indexOf('\n## ');
    const coverageText = nextHeader >= 0 ? afterCoverage.slice(0, nextHeader) : afterCoverage;

    // Scan for AC-N references within the coverage section only
    const acRe = acIdRegex();
    let am;
    while ((am = acRe.exec(coverageText)) !== null) {
      result.coveredACs.add(am[0]);
    }
  } catch { /* ignore */ }

  return result;
}

/**
 * Scan a test file for AC-N references anywhere in the file.
 * Returns Set<string> of AC IDs found.
 */
function scanTestFileForACs(epicNum, storyNum) {
  const tested = new Set();
  const testDirs = ['web/src/__tests__/integration', 'web/src/__tests__'];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { recursive: true });
      const testFiles = entries.filter(f =>
        typeof f === 'string' &&
        f.includes(`epic-${epicNum}`) &&
        f.includes(`story-${storyNum}`) &&
        (f.endsWith('.test.tsx') || f.endsWith('.test.ts'))
      );
      for (const tf of testFiles) {
        const content = fs.readFileSync(path.join(dir, tf), 'utf-8');
        const re = acIdRegex();
        let m;
        while ((m = re.exec(content)) !== null) {
          tested.add(m[0]);
        }
      }
      if (testFiles.length > 0) break;
    } catch { /* ignore */ }
  }

  return tested;
}

/**
 * Combined traceability lookup — resolves epic/story paths once, then gathers
 * ACs, test-design coverage, and test-file references in a single pass.
 * Returns { acs, coverage, tested } matching the shapes of the individual helpers.
 */
function getACTraceability(epicNum, storyNum) {
  const empty = {
    acs: [],
    coverage: { coveredACs: new Set(), baDecisionsPending: 0 },
    tested: new Set()
  };

  // Single directory lookup
  const epicDir = findEpicDir(epicNum);
  if (!epicDir) return empty;
  const storyFiles = findStoryFiles(epicDir);
  const story = storyFiles.find(s => s.num === storyNum);

  // ACs from story file (delegates to shared parser)
  let acs = [];
  if (story) {
    try {
      acs = parseACsFromContent(fs.readFileSync(story.path, 'utf-8'));
    } catch { /* ignore */ }
  }

  // Test-design coverage (uses its own path lookup — no overlap with epic/story dirs)
  const coverage = parseTestDesignCoverage(epicNum, storyNum);

  // Test-file AC references
  const tested = scanTestFileForACs(epicNum, storyNum);

  return { acs, coverage, tested };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Phase constants
  GLOBAL_PHASES,
  STORY_PHASES,
  ALL_PHASES,

  // Path constants
  STORIES_DIR,
  TEST_DESIGN_DIR,
  STATE_FILE,
  INTAKE_MANIFEST_FILE,
  FRS_PATH,
  API_SPEC_PATH,
  HANDLERS_PATH,
  SNAPSHOT_PATH,

  // Display constants
  AGENT_DISPLAY_NAMES,

  // File finding
  findFiles,
  findFilesRecursive,

  // Epic/story directory
  findEpicDir,
  findStoryFiles,

  // Acceptance criteria
  extractACSection,
  countStoryAC,
  countEpicAC,
  checkAllAcceptanceCriteria,

  // Story metadata
  extractStoryRoute,
  getDeferredVerificationStories,

  // Test files
  countTestFiles,
  countWireframes,

  // Story phase determination
  storyHasTestDesign,
  storyHasTests,
  findFirstIncompleteStory,
  getStoryStates,

  // Discovered impacts
  getDiscoveredImpactsForEpic,

  // QA completion
  checkQAComplete,

  // Display helpers
  friendlyName,

  // AC traceability (dashboard test coverage card)
  parseACsFromStory,
  parseTestDesignCoverage,
  scanTestFileForACs,
  getACTraceability,

  // State file readers
  readWorkflowState,
  readIntakeManifest
};
