/**
 * Tests for check-node-version.js pre-install script
 *
 * This script validates Node.js version requirements before npm install.
 *
 * Testing Philosophy:
 * - We test the BEHAVIOR of the script (exit codes, output), not its source code
 * - We don't read the script file and assert on string contents
 * - We run the script and verify it behaves correctly
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

// The script is in web/scripts/, and tests are in web/src/__tests__/scripts/
const SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../scripts/check-node-version.js',
);

describe('check-node-version.js', () => {
  describe('when Node version meets requirements (22+)', () => {
    it('should exit with code 0 and produce no output', () => {
      // Running the actual script with current Node (which should be 22+)
      const result = execSync(`node "${SCRIPT_PATH}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Script should produce no output on success
      expect(result).toBe('');
    });

    it('should not throw when executed', () => {
      expect(() => {
        execSync(`node "${SCRIPT_PATH}"`, { encoding: 'utf-8' });
      }).not.toThrow();
    });
  });

  describe('script syntax validation', () => {
    it('should be valid JavaScript', () => {
      // --check flag validates syntax without executing
      const result = execSync(`node --check "${SCRIPT_PATH}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Empty output means valid syntax
      expect(result).toBe('');
    });
  });

  /**
   * NOTE: We intentionally do NOT test:
   * - Source code string contents (e.g., "script should contain 'process.exit(1)'")
   * - Internal implementation details (e.g., "should define REQUIRED_NODE_VERSION as 18")
   * - Error message formatting by reading source
   *
   * These would be testing implementation details, not behavior.
   *
   * To properly test the failure case, we would need to either:
   * 1. Run the script with an older Node.js version (requires nvm/containerization)
   * 2. Extract and test the version comparison logic in isolation
   *
   * For this template, we verify the success path works correctly,
   * which gives us confidence the script is functioning.
   */
});
