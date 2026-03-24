/**
 * Tests for Progress Index Generator
 *
 * Run with: npm test -- src/__tests__/scripts/generate-progress-index.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Get project root (stadium-8)
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, '__test-fixtures__');
const SCRIPT_PATH = path.join(
  PROJECT_ROOT,
  '.github/scripts/generate-progress-index.js',
);

/**
 * Helper to run the script with optional stdin input
 * @param stdinInput - JSON object to pipe to stdin
 * @param env - Additional environment variables
 * @returns Promise with stdout, stderr, and exitCode
 */
function runScript(
  stdinInput: object | null = null,
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH], {
      env: { ...process.env, ...env },
      cwd: FIXTURES_DIR,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode: number | null) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    if (stdinInput) {
      proc.stdin.write(JSON.stringify(stdinInput));
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * Helper to create test fixture files
 */
function createFixture(relativePath: string, content: string): void {
  const fullPath = path.join(FIXTURES_DIR, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
}

/**
 * Helper to clean up fixtures directory
 */
function cleanFixtures(): void {
  if (fs.existsSync(FIXTURES_DIR)) {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  }
}

/**
 * Helper to read generated PROGRESS.md
 */
function readProgressFile(): string | null {
  const progressPath = path.join(FIXTURES_DIR, 'generated-docs', 'PROGRESS.md');
  if (!fs.existsSync(progressPath)) {
    return null;
  }
  return fs.readFileSync(progressPath, 'utf-8');
}

// Sample fixture content
const SAMPLE_FEATURE_OVERVIEW = `# Feature: User Authentication

## Summary
Implement user authentication with login, registration, and password reset.

## Epics

1. **Epic 1: Basic Authentication** - Core login and registration
   - Status: Pending
   - Directory: \`epic-1-basic-auth/\`

2. **Epic 2: Password Management** - Password reset and change
   - Status: Pending
   - Directory: \`epic-2-password-mgmt/\`
`;

const SAMPLE_EPIC_OVERVIEW = `# Epic 1: Basic Authentication

## Description
Implement core login and registration functionality.

## Stories

1. **User Login** - Allow users to log in with email and password
   - File: \`story-1-user-login.md\`
   - Status: Pending

2. **User Registration** - Allow new users to create accounts
   - File: \`story-2-user-registration.md\`
   - Status: Pending
`;

const SAMPLE_STORY_PLANNED = `# Story: User Login

## Description
Allow users to log in with email and password.

## Acceptance Tests

- [ ] User can enter email and password
- [ ] User sees error message for invalid credentials
- [ ] User is redirected to dashboard on success
`;

const SAMPLE_STORY_IN_PROGRESS = `# Story: User Login

## Description
Allow users to log in with email and password.

## Acceptance Tests

- [x] User can enter email and password
- [ ] User sees error message for invalid credentials
- [ ] User is redirected to dashboard on success
`;

const SAMPLE_STORY_COMPLETE = `# Story: User Login

## Description
Allow users to log in with email and password.

## Acceptance Tests

- [x] User can enter email and password
- [x] User sees error message for invalid credentials
- [x] User is redirected to dashboard on success
`;

describe('Progress Index Generator', () => {
  beforeEach(() => {
    cleanFixtures();
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanFixtures();
  });

  describe('Early exit conditions', () => {
    it('exits gracefully when stories directory does not exist', async () => {
      // Create fixtures dir but no stories directory
      createFixture('package.json', '{}');

      const result = await runScript(null, {
        CLAUDE_PROJECT_DIR: FIXTURES_DIR,
      });

      expect(result.exitCode).toBe(0);
      expect(readProgressFile()).toBeNull();
    });

    it('exits early when file path is not in generated-docs/stories/', async () => {
      // Create a stories directory with content
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_PLANNED,
      );

      // Run with a file path outside stories directory
      const result = await runScript(
        {
          tool_input: {
            file_path: '/some/other/path/file.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);
      // PROGRESS.md should NOT be generated since we exited early
      expect(readProgressFile()).toBeNull();
    });
  });

  describe('Feature overview parsing', () => {
    it('correctly parses _feature-overview.md to extract feature name and epics', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_PLANNED,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      expect(progress).toContain('User Authentication');
      expect(progress).toContain('Basic Authentication');
    });
  });

  describe('Epic overview parsing', () => {
    it('correctly parses _epic-overview.md to extract stories', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_PLANNED,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      // Check that stories are counted
      expect(progress).toMatch(/\|\s*2\s*\|/); // 2 stories
    });
  });

  describe('Checkbox counting', () => {
    it('correctly counts checkboxes in story files', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      // One story in progress, one complete
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_IN_PROGRESS,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_COMPLETE,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      // Should have 1 completed story out of 2
      expect(progress).toMatch(/\|\s*1\s*\|/); // 1 completed
    });
  });

  describe('Status calculation', () => {
    it('correctly calculates Planned status when no checkboxes checked', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_PLANNED,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      expect(progress).toContain('Planned');
      expect(progress).toContain('⏳'); // Planned icon
    });

    it('correctly calculates In Progress status when some checkboxes checked', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_IN_PROGRESS,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      expect(progress).toContain('In Progress');
      expect(progress).toContain('🔄'); // In Progress icon
    });

    it('correctly calculates Complete status when all checkboxes checked', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_COMPLETE,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_COMPLETE,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();
      expect(progress).toContain('Complete');
      expect(progress).toContain('✅'); // Complete icon
    });
  });

  describe('Markdown output generation', () => {
    it('generates valid markdown output with correct structure', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_IN_PROGRESS,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();

      // Check header
      expect(progress).toContain('# Project Progress Index');
      expect(progress).toContain('Auto-generated. Do not edit manually.');

      // Check Features Overview table headers
      expect(progress).toContain('## Features Overview');
      expect(progress).toContain(
        '| Feature | Epics | Stories | Completed | Status |',
      );

      // Check Epic breakdown section
      expect(progress).toContain('## User Authentication');
      expect(progress).toContain(
        '[Feature Overview](stories/_feature-overview.md)',
      );

      // Check links are generated correctly
      expect(progress).toContain(
        '[Basic Authentication](stories/epic-1-basic-auth/_epic-overview.md)',
      );
    });

    it('includes story details for in-progress epics', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_IN_PROGRESS,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_PLANNED,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();

      // Should include story details section for in-progress epic
      expect(progress).toContain('### Basic Authentication (In Progress)');
      expect(progress).toContain('| Story | Status |');
      expect(progress).toContain('[User Login]');
      expect(progress).toContain('[User Registration]');
    });
  });

  describe('Multiple features handling', () => {
    it('handles multiple epics correctly', async () => {
      createFixture(
        'generated-docs/stories/_feature-overview.md',
        SAMPLE_FEATURE_OVERVIEW,
      );

      // Epic 1: In progress
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/_epic-overview.md',
        SAMPLE_EPIC_OVERVIEW,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
        SAMPLE_STORY_COMPLETE,
      );
      createFixture(
        'generated-docs/stories/epic-1-basic-auth/story-2-user-registration.md',
        SAMPLE_STORY_IN_PROGRESS,
      );

      // Epic 2: Complete
      const epic2Overview = `# Epic 2: Password Management

## Description
Password reset and change functionality.

## Stories

1. **Password Reset** - Allow users to reset forgotten password
   - File: \`story-1-password-reset.md\`
   - Status: Pending
`;
      createFixture(
        'generated-docs/stories/epic-2-password-mgmt/_epic-overview.md',
        epic2Overview,
      );
      createFixture(
        'generated-docs/stories/epic-2-password-mgmt/story-1-password-reset.md',
        SAMPLE_STORY_COMPLETE,
      );

      const result = await runScript(
        {
          tool_input: {
            file_path:
              'generated-docs/stories/epic-1-basic-auth/story-1-user-login.md',
          },
        },
        { CLAUDE_PROJECT_DIR: FIXTURES_DIR },
      );

      expect(result.exitCode).toBe(0);

      const progress = readProgressFile();
      expect(progress).not.toBeNull();

      // Should contain both epics
      expect(progress).toContain('Basic Authentication');
      expect(progress).toContain('Password Management');

      // Feature should show 2 epics and 3 stories total
      expect(progress).toMatch(/User Authentication\s*\|\s*2\s*\|\s*3/);
    });
  });
});
