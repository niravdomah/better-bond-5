#!/usr/bin/env node
/**
 * test-phase-transitions.js
 * Tests the phaseStatus transitions to verify correct behavior
 *
 * Usage: node .claude/scripts/test-phase-transitions.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = 'generated-docs/context/workflow-state.json';
const TEST_SPEC = 'documentation/test-feature.md';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg) { console.log(msg); }
function pass(msg) { console.log(`${GREEN}✓ PASS${RESET}: ${msg}`); }
function fail(msg) { console.log(`${RED}✗ FAIL${RESET}: ${msg}`); }
function info(msg) { console.log(`${YELLOW}→${RESET} ${msg}`); }

function run(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (e) {
    if (e.stdout) {
      try { return JSON.parse(e.stdout); } catch {}
    }
    return { status: 'error', message: e.message };
  }
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function cleanup() {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(TEST_SPEC)) fs.unlinkSync(TEST_SPEC);
}

function setup() {
  // Ensure documentation directory exists
  const docDir = path.dirname(TEST_SPEC);
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  // Create test feature spec
  fs.writeFileSync(TEST_SPEC, '# Test Feature\n\nA test feature for phase transition testing.\n');
}

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    pass(description);
    passed++;
  } catch (e) {
    fail(`${description}: ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, field) {
  if (actual !== expected) {
    throw new Error(`Expected ${field} to be "${expected}" but got "${actual}"`);
  }
}

// Main test suite
log('\n=== Phase Transition Tests ===\n');

// Cleanup any previous state
cleanup();
setup();

info('Setting up test environment...\n');

// Test 1: Initialize workflow
test('Initialize workflow sets phaseStatus to "ready"', () => {
  run('node .claude/scripts/transition-phase.js --init SCOPE');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'SCOPE', 'currentPhase');
});

// Test 2: Mark started changes status to in_progress
test('--mark-started changes phaseStatus to "in_progress"', () => {
  run('node .claude/scripts/transition-phase.js --mark-started');
  const state = readState();
  assertEqual(state.phaseStatus, 'in_progress', 'phaseStatus');
});

// Test 3: Mark started is idempotent
test('--mark-started is idempotent (no error when already in_progress)', () => {
  const result = run('node .claude/scripts/transition-phase.js --mark-started');
  assertEqual(result.status, 'ok', 'status');
  assertEqual(result.state.phaseStatus, 'in_progress', 'phaseStatus');
});

// Test 4: Transition resets to ready
test('Phase transition resets phaseStatus to "ready"', () => {
  run('node .claude/scripts/transition-phase.js --epic 1 --to STORIES');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'STORIES', 'currentPhase');
});

// Test 5: Mark started again
test('--mark-started works after transition', () => {
  run('node .claude/scripts/transition-phase.js --mark-started');
  const state = readState();
  assertEqual(state.phaseStatus, 'in_progress', 'phaseStatus');
});

// Test 6: Story-level transition to TEST-DESIGN
test('Story-level transition to TEST-DESIGN sets phaseStatus to "ready"', () => {
  // First set total stories
  run('node .claude/scripts/transition-phase.js --set-totals stories 2 --epic 1');
  // Transition to story phase
  run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to TEST-DESIGN');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'TEST-DESIGN', 'currentPhase');
  assertEqual(state.currentStory, 1, 'currentStory');
});

// Test 7: Mark started for story phase
test('--mark-started works for story-level phases', () => {
  run('node .claude/scripts/transition-phase.js --mark-started');
  const state = readState();
  assertEqual(state.phaseStatus, 'in_progress', 'phaseStatus');
});

// Test 7b: Transition from TEST-DESIGN to WRITE-TESTS
test('TEST-DESIGN → WRITE-TESTS transition succeeds', () => {
  run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to WRITE-TESTS');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'WRITE-TESTS', 'currentPhase');
});

// Test 8: Transition to IMPLEMENT
test('Transition to IMPLEMENT resets phaseStatus', () => {
  run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to IMPLEMENT');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'IMPLEMENT', 'currentPhase');
});

// Test 9: Full cycle through QA
test('Transition through QA maintains ready status', () => {
  run('node .claude/scripts/transition-phase.js --mark-started'); // Start IMPLEMENT
  run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to QA');
  const state = readState();
  assertEqual(state.phaseStatus, 'ready', 'phaseStatus');
  assertEqual(state.currentPhase, 'QA', 'currentPhase');
});

// Test 10: --show includes phaseStatus
test('--show output includes phaseStatus field', () => {
  const result = run('node .claude/scripts/transition-phase.js --show');
  assertEqual(result.status, 'ok', 'status');
  assertEqual(typeof result.state.phaseStatus, 'string', 'phaseStatus type');
});

// Test 11: REALIGN → WRITE-TESTS is now invalid (must go through TEST-DESIGN)
test('REALIGN → WRITE-TESTS is rejected (must go through TEST-DESIGN)', () => {
  // Reset state completely and rebuild to REALIGN
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  run('node .claude/scripts/transition-phase.js --init SCOPE');
  run('node .claude/scripts/transition-phase.js --epic 1 --to STORIES');
  run('node .claude/scripts/transition-phase.js --set-totals stories 2 --epic 1');
  run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to REALIGN');
  // Try invalid transition
  const result = run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to WRITE-TESTS');
  assertEqual(result.status, 'error', 'status');
});

// Test 12: REALIGN → TEST-DESIGN succeeds
test('REALIGN → TEST-DESIGN transition succeeds', () => {
  const result = run('node .claude/scripts/transition-phase.js --epic 1 --story 1 --to TEST-DESIGN');
  assertEqual(result.status, 'ok', 'status');
  const state = readState();
  assertEqual(state.currentPhase, 'TEST-DESIGN', 'currentPhase');
});

// Cleanup
cleanup();

// Summary
log('\n=== Test Summary ===\n');
log(`${GREEN}Passed: ${passed}${RESET}`);
if (failed > 0) {
  log(`${RED}Failed: ${failed}${RESET}`);
  process.exit(1);
} else {
  log(`\n${GREEN}All tests passed!${RESET}\n`);
}
