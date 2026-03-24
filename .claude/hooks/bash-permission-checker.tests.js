#!/usr/bin/env node
/**
 * Automated tests for bash-permission-checker.js
 *
 * Feeds synthetic JSON input to the permission checker hook and validates
 * that commands are correctly allowed, denied, or fall through.
 *
 * Usage:
 *   node .claude/hooks/bash-permission-checker.tests.js
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'bash-permission-checker.js');
const prefsPath = path.join(__dirname, '..', 'preferences.json');

let passed = 0;
let failed = 0;
const errors = [];

function testCommand(command, expected, description) {
  const json = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  let result, exitCode, stderr;
  try {
    result = execFileSync('node', [scriptPath], {
      input: json,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    exitCode = 0;
    stderr = '';
  } catch (err) {
    exitCode = err.status ?? 1;
    result = err.stdout ?? '';
    stderr = err.stderr ?? '';
  }

  let actual;
  if (exitCode === 2) {
    actual = 'deny';
  } else if (exitCode === 0) {
    actual = result && result.includes('allow') ? 'allow' : 'fallthrough';
  } else {
    actual = `error(exit=${exitCode})`;
  }

  if (actual === expected) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m: ${description}`);
  } else {
    failed++;
    const msg = `FAIL: ${description} (expected=${expected}, actual=${actual})`;
    errors.push(msg);
    console.log(`  \x1b[31m${msg}\x1b[0m`);
  }
}

/** Run tests with a specific preferences.json, then restore the original state. */
function withPreferences(prefs, fn) {
  const existed = fs.existsSync(prefsPath);
  const backup = existed ? fs.readFileSync(prefsPath, 'utf8') : null;
  try {
    if (prefs === null) {
      try { fs.unlinkSync(prefsPath); } catch {}
    } else {
      fs.writeFileSync(prefsPath, JSON.stringify(prefs));
    }
    fn();
  } finally {
    try { fs.unlinkSync(prefsPath); } catch {}
    if (existed && backup) fs.writeFileSync(prefsPath, backup);
  }
}

// =============================================================================
// REGRESSION TESTS - existing single-command behavior
// =============================================================================
console.log('\nRegression: Single commands');

testCommand('npm test', 'allow', 'npm test');
testCommand('npm install', 'allow', 'npm install');
testCommand('npm run build', 'allow', 'npm run build');
testCommand('cd web && npm test', 'allow', 'cd prefix + npm test');
testCommand('cd "c:/Git/project/web" && npm test -- src/test.tsx', 'allow', 'cd with absolute path + npm test with args');
testCommand('npx vitest --run', 'allow', 'npx vitest');
testCommand('ls -la web/src/', 'allow', 'ls safe directory');
testCommand('pwd', 'allow', 'pwd');
testCommand('node --version', 'allow', 'node --version');
testCommand('npm run generate:types', 'allow', 'npm run generate:types');

// =============================================================================
// Git read-only commands
// =============================================================================
console.log('\nGit read-only commands');

testCommand('git status', 'allow', 'git status');
testCommand('git status --short', 'allow', 'git status --short');
testCommand('git log --oneline -5', 'allow', 'git log with flags');
testCommand('git diff', 'allow', 'git diff');
testCommand('git diff HEAD~1 -- src/', 'allow', 'git diff with args');
testCommand('git show HEAD', 'allow', 'git show HEAD');
testCommand('git branch', 'allow', 'git branch (list)');
testCommand('git branch -a', 'allow', 'git branch -a');
testCommand('git branch -vv', 'allow', 'git branch -vv');
testCommand('git rev-parse HEAD', 'allow', 'git rev-parse HEAD');
testCommand('git remote -v', 'allow', 'git remote -v');
testCommand('git stash list', 'allow', 'git stash list');
testCommand('git describe --tags', 'allow', 'git describe --tags');
testCommand('git tag', 'allow', 'git tag (list)');
testCommand('git tag -l "v*"', 'allow', 'git tag -l with pattern');

// Safety: these should NOT be auto-approved
testCommand('git branch new-feature', 'fallthrough', 'git branch create = fallthrough');
testCommand('git branch -d old-feature', 'fallthrough', 'git branch -d = fallthrough');
testCommand('git tag v1.0', 'fallthrough', 'git tag create = fallthrough');
testCommand('git stash', 'fallthrough', 'git stash (not list) = fallthrough');
testCommand('git remote add origin url', 'fallthrough', 'git remote add = fallthrough');

// =============================================================================
// Git pull and add (unconditional allow)
// =============================================================================
console.log('\nGit pull and add');

testCommand('git pull', 'allow', 'git pull');
testCommand('git pull origin main', 'allow', 'git pull origin main');
testCommand('git pull --rebase', 'allow', 'git pull --rebase');
testCommand('git pull --ff-only', 'allow', 'git pull --ff-only');
testCommand('git pull origin feature/my-branch', 'allow', 'git pull with feature branch');
testCommand('cd web && git pull', 'allow', 'cd prefix + git pull');
testCommand('git add src/foo.ts', 'allow', 'git add specific file');
testCommand('git add src/foo.ts src/bar.ts', 'allow', 'git add multiple files');
testCommand('git add .', 'allow', 'git add .');
testCommand('git add -A', 'allow', 'git add -A');
testCommand('git add --all', 'allow', 'git add --all');
testCommand('git add -u', 'allow', 'git add -u (update tracked)');
testCommand('git add .claude/logs/', 'allow', 'git add .claude/logs/');
testCommand('cd web && git add .', 'allow', 'cd prefix + git add .');
testCommand('cd web && git add \\\n  src/app/page.tsx \\\n  src/components/Foo.tsx \\\n  ../.claude/logs/', 'allow', 'git add with backslash-newline continuations');
testCommand('git add \\\n  src/foo.ts \\\n  src/bar.ts', 'allow', 'git add multiline with continuations');

// =============================================================================
// Git deny patterns (always blocked)
// =============================================================================
console.log('\nGit deny patterns');

testCommand('git push --force', 'deny', 'git push --force = denied');
testCommand('git push -f', 'deny', 'git push -f = denied');
testCommand('git push origin main --force', 'deny', 'git push origin main --force = denied');
testCommand('git push --no-verify', 'deny', 'git push --no-verify = denied');
testCommand('git commit --no-verify', 'deny', 'git commit --no-verify = denied');
testCommand('git commit -m "msg" --no-verify', 'deny', 'git commit -m with --no-verify = denied');
testCommand('git push --force-with-lease', 'deny', 'git push --force-with-lease = denied (matches --force)');
testCommand('git push --delete origin old-branch', 'deny', 'git push --delete = denied');
testCommand('git commit --amend', 'deny', 'git commit --amend = denied');
testCommand('git commit -a --amend -m "rewrite"', 'deny', 'git commit -a --amend -m = denied');

// =============================================================================
// Git commit/push config-conditional tests
// =============================================================================

// --- Without config (fallthrough by default) ---
withPreferences(null, () => {
  console.log('\nGit commit/push without config (fallthrough)');

  testCommand('git commit -m "test commit"', 'fallthrough', 'git commit without config = fallthrough');
  testCommand('git push', 'fallthrough', 'git push without config = fallthrough');
  testCommand('git push -u origin main', 'fallthrough', 'git push -u without config = fallthrough');
});

// --- With config enabled (auto-approve) ---
withPreferences({ git: { autoApproveCommit: true, autoApprovePush: true } }, () => {
  console.log('\nGit commit/push with config enabled');

  testCommand('git commit -m "feat: add new feature"', 'allow', 'git commit -m with config enabled');
  testCommand('git commit --message "fix: typo"', 'allow', 'git commit --message with config enabled');
  testCommand('git commit -a -m "all changes"', 'allow', 'git commit -a -m with config enabled');
  testCommand('git push', 'allow', 'git push with config enabled');
  testCommand('git push -u origin feature-branch', 'allow', 'git push -u origin with config enabled');
  testCommand('git push origin main', 'allow', 'git push origin main with config enabled');
  testCommand('git push --tags', 'allow', 'git push --tags with config enabled');

  // Even with config enabled, dangerous operations are still denied
  testCommand('git push --force', 'deny', 'git push --force STILL denied with config');
  testCommand('git push --delete origin branch', 'deny', 'git push --delete STILL denied with config');
  testCommand('git commit --no-verify', 'deny', 'git commit --no-verify STILL denied with config');
  testCommand('git commit --amend -m "rewrite"', 'deny', 'git commit --amend STILL denied with config');
  testCommand('git commit -a --amend -m "rewrite"', 'deny', 'git commit -a --amend STILL denied with config');
});

// --- With partial config (only commit enabled) ---
withPreferences({ git: { autoApproveCommit: true, autoApprovePush: false } }, () => {
  console.log('\nGit commit/push with partial config');

  testCommand('git commit -m "test"', 'allow', 'git commit allowed (commit=true, push=false)');
  testCommand('git push', 'fallthrough', 'git push fallthrough (commit=true, push=false)');
});

// =============================================================================
// Compound commands with git
// =============================================================================
console.log('\nCompound commands with git');

testCommand('git pull && npm install', 'allow', 'git pull && npm install');
testCommand('git add src/foo.ts && git status', 'allow', 'git add specific file && git status');
testCommand('git add . && git status', 'allow', 'git add . && git status');

// =============================================================================
// REGRESSION TESTS - deny patterns
// =============================================================================
console.log('\nRegression: Deny patterns');

testCommand('cat ~/.ssh/id_rsa', 'deny', 'cat SSH key');
testCommand('rm -rf /', 'deny', 'rm -rf /');
testCommand('cat /etc/credentials', 'deny', 'cat credentials');
testCommand('type secret.key', 'deny', 'type secret file');

// =============================================================================
// REGRESSION TESTS - fallthrough
// =============================================================================
console.log('\nRegression: Fallthrough');

testCommand('docker run ubuntu', 'fallthrough', 'unknown command falls through');
testCommand('curl https://example.com', 'fallthrough', 'curl falls through');

// =============================================================================
// Standalone pattern tests
// =============================================================================
console.log('\nStandalone patterns');

testCommand('cd /some/directory', 'allow', 'standalone cd');
testCommand('cd "c:/Git/project/web"', 'allow', 'standalone cd with quoted Windows path');
testCommand('echo "Installing dependencies..."', 'allow', 'echo with quoted string');
testCommand("echo 'test passed'", 'allow', 'echo with single-quoted string');
testCommand('echo done', 'allow', 'echo with simple word');
testCommand('test -d node_modules', 'allow', 'test -d');
testCommand('[ -d node_modules ]', 'allow', '[ -d ] bracket syntax');
testCommand('true', 'allow', 'true');
testCommand('false', 'allow', 'false');

// =============================================================================
// Compound command tests (splitting)
// =============================================================================
console.log('\nCompound commands (splitting)');

testCommand('cd web && npm install && npm test', 'allow', 'three safe commands chained with &&');
testCommand('echo "installing" && npm install', 'allow', 'echo + npm install');
testCommand('cd web && npm test || echo "tests failed"', 'allow', 'npm test || echo fallback');
testCommand('npm install ; npm run build', 'allow', 'semicolon separator');
testCommand('test -d node_modules && echo "found" || npm install', 'allow', 'conditional dependency check (split)');
testCommand('test -f "c:/Git/project/generated-docs/file.md" && cat "c:/Git/project/generated-docs/file.md" || echo "File not found"', 'allow', 'test -f + cat safe dir + echo fallback');
testCommand('cd web && npm run build && npm run lint && npm test', 'allow', 'four commands chained');
testCommand('cd "c:/Git/project/web" && npm install && npm run build', 'allow', 'absolute path cd + chain');
testCommand('cd /c/Git/stadium-8 && ls -la generated-docs/context/ 2>/dev/null || echo "Context directory not found"', 'allow', 'cd + ls generated-docs subdir + echo fallback');

// Heredoc compound (newline-separated)
testCommand("cat > /tmp/test.js << 'EOF'\nimport { test } from 'vitest';\nEOF\nnpm test -- /tmp/test.js", 'allow', 'heredoc to /tmp + npm test (newline split)');

// =============================================================================
// SECURITY: Compound commands with deny
// =============================================================================
console.log('\nSecurity: Compound with deny');

testCommand('echo "ok" && cat ~/.ssh/id_rsa', 'deny', 'safe + deny = blocked');
testCommand('npm test && rm -rf /', 'deny', 'safe + rm -rf = blocked');
testCommand('echo "ok" ; cat credentials.json', 'deny', 'semicolon + deny = blocked');
testCommand('npm install || cat secret', 'deny', 'OR chain with deny = blocked');

// =============================================================================
// EDGE CASES
// =============================================================================
console.log('\nEdge cases');

testCommand('echo "foo && bar"', 'allow', 'quoted && not split (single command match)');
testCommand("echo 'a ; b'", 'allow', 'quoted ; not split (single command match)');
testCommand('(npm test && npm run build)', 'allow', 'parenthesized group with safe commands');
testCommand('cd web && (npm install && npm test)', 'allow', 'mixed: plain + parenthesized group');
testCommand('(npm test) && (npm run build)', 'allow', 'two parenthesized groups');
testCommand('(npm test && docker run ubuntu)', 'fallthrough', 'parenthesized group with unknown = fallthrough');
testCommand('cd web && docker run ubuntu && npm test', 'fallthrough', 'one unknown sub-command = fallthrough');

// =============================================================================
// FIND - safe directory exploration
// =============================================================================
console.log('\nFind commands');

testCommand('find .claude -name "*.json" 2>/dev/null', 'allow', 'find .claude json files');
testCommand('find documentation -name "*.yaml" -type f', 'allow', 'find documentation yaml files');
testCommand('find web/src -name "*.tsx" -maxdepth 3', 'allow', 'find web/src tsx files with maxdepth');
testCommand('find generated-docs -name "*.md"', 'allow', 'find generated-docs markdown files');
testCommand('find .github -type f', 'allow', 'find .github all files');
testCommand('cd /c/Git/project && find .claude -name "*.json" 2>/dev/null', 'allow', 'cd + find .claude (compound)');
testCommand('cd /home/user/my-project && find .claude -name "*.json" 2>/dev/null && ls .claude/', 'allow', 'cd + find .claude + ls .claude (workflow state check)');
testCommand('find .claude -name "*.json" -exec rm {} \\;', 'fallthrough', 'find with -exec = fallthrough');
testCommand('find .claude -delete', 'fallthrough', 'find with -delete = fallthrough');
testCommand('find /tmp -execdir cat {} \\;', 'fallthrough', 'find with -execdir = fallthrough');
testCommand('find /tmp -ok rm {} \\;', 'fallthrough', 'find with -ok = fallthrough');

// =============================================================================
// FIND - arbitrary paths, -o flag, escaped parens, pipelines
// =============================================================================
console.log('\nFind: arbitrary paths and advanced flags');

testCommand('find /home/user -name "*.json"', 'allow', 'find any path = allowed (read-only)');
testCommand('find /home/user/my-project -name "*epic*2*" -o -name "*story*"', 'allow', 'find with -o (OR operator)');
testCommand('find /home/user/my-project -type f -name "*mock*" -o -name "*fixture*" -o -name "*sample*"', 'allow', 'find with multiple -o flags');
testCommand('find /tmp -name "*.log" -o -name "*.tmp"', 'allow', 'find /tmp with -o');
testCommand('find /c/Git/project/web -type f ! -name "*.map"', 'allow', 'find with ! (NOT operator)');
testCommand('find /c/Git/project -not -name "node_modules" -type d', 'allow', 'find with -not flag');
testCommand('find /c/Git/project -name "*.ts" -print', 'allow', 'find with -print');
testCommand('find /c/Git/project -name "*.ts" -print0', 'allow', 'find with -print0');

console.log('\nFind: escaped parentheses grouping');

testCommand(
  'find /home/user/my-project/web -type f \\( -name "*.test.*" -o -name "*.spec.*" \\)',
  'allow', 'find with escaped parens grouping'
);
testCommand(
  'find /c/Git/project -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -path "*/node_modules/*"',
  'allow', 'find with escaped parens + ! -path'
);

console.log('\nFind: piped to grep/head (QA workflow patterns)');

testCommand(
  'find /home/user/my-project -name "*epic*2*" -o -name "*story*" | grep -E "\\.(md|txt)$" | head -20',
  'allow', 'find | grep -E | head (epic/story search)'
);
testCommand(
  'find /home/user/my-project -type f -name "*mock*" -o -name "*fixture*" -o -name "*sample*" | grep -E "\\.(json|ts|js)$" | head -10',
  'allow', 'find | grep -E | head (mock/fixture search)'
);
testCommand(
  'find /home/user/my-project/web -type f \\( -name "*.test.*" -o -name "*.spec.*" \\) | grep -i payment | head -5',
  'allow', 'find with parens | grep -i | head (test file search)'
);
testCommand(
  'find web/src -name "*.tsx" | wc -l',
  'allow', 'find | wc -l (count files)'
);
testCommand(
  'find /c/Git/project -name "*.md" | sort',
  'allow', 'find | sort'
);

// =============================================================================
// WORKFLOW SCRIPTS
// =============================================================================
console.log('\nWorkflow scripts');

testCommand('node .claude/scripts/copy-with-header.js --from "documentation/Api Definition.yaml" --to "generated-docs/specs/api-spec.yaml"', 'allow', 'copy-with-header: basic with spaces in filename');
testCommand('node .claude/scripts/copy-with-header.js --from "documentation/design-tokens.css" --to "generated-docs/specs/design-tokens.css" --header "/* Source: documentation/design-tokens.css */"', 'allow', 'copy-with-header: with custom --header flag');
testCommand('node .claude/scripts/copy-with-header.js --help', 'allow', 'copy-with-header: --help');
testCommand('cd "c:/Git/project" && node .claude/scripts/copy-with-header.js --from "documentation/api.yaml" --to "generated-docs/specs/api-spec.yaml"', 'allow', 'copy-with-header: with cd prefix');
testCommand('node .claude/scripts/transition-phase.js --show', 'allow', 'transition-phase: --show');
testCommand('node .claude/scripts/generate-todo-list.js', 'allow', 'generate-todo-list: no args');

// =============================================================================
// ENV VAR PREFIX (VAR=value before commands)
// =============================================================================
console.log('\nEnv var prefix');

// npm with env prefix
testCommand('CI=true npm test', 'allow', 'CI=true npm test');
testCommand('NODE_ENV=production npm run build', 'allow', 'NODE_ENV=production npm run build');
testCommand('CI=true npm run lint', 'allow', 'CI=true npm run lint');
testCommand('CI=true npm install', 'allow', 'CI=true npm install');

// Multiple env vars
testCommand('CI=true NODE_ENV=test npm test', 'allow', 'multiple env vars + npm test');

// npx / bare dev tools with env prefix
testCommand('CI=true npx vitest --run', 'allow', 'CI=true npx vitest');
testCommand('NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit', 'allow', 'NODE_OPTIONS + npx tsc');

// Node scripts with env prefix
testCommand('CI=true node .github/scripts/security-validator.js', 'allow', 'CI=true node .github/scripts/...');
testCommand('CI=true node .claude/scripts/generate-dashboard-html.js --collect', 'allow', 'CI=true node .claude/scripts/...');

// cd prefix + env prefix combined
testCommand('cd web && CI=true npm test', 'allow', 'cd + CI=true + npm test');
testCommand('cd web && NODE_ENV=production npm run build', 'allow', 'cd + NODE_ENV + npm run build');

// Compound with env prefix
testCommand('cd C:/Git/project && CI=true node .github/scripts/security-validator.js > /dev/null 2>&1; echo "EXIT CODE: $?"', 'allow', 'original triggering command (cd + CI=true node + echo)');

// Env prefix should NOT allow arbitrary commands
testCommand('CI=true rm -rf /tmp/stuff', 'deny', 'env prefix + rm -rf = denied (deny pattern catches it)');

// =============================================================================
// WRITE PATH TRAVERSAL PREVENTION
// =============================================================================
console.log('\nWrite path traversal prevention');

testCommand('cat > generated-docs/../../evil.txt', 'fallthrough', 'write traversal ../../ = fallthrough');
testCommand('cat > generated-docs/../../../etc/cron.d/evil', 'fallthrough', 'write traversal to system dir = fallthrough');
testCommand("cat > .claude/context/../../../etc/evil << 'EOF'", 'fallthrough', 'heredoc write traversal = fallthrough');
testCommand('cat > generated-docs/../evil.txt', 'fallthrough', 'write traversal one level (no deny keyword) = fallthrough');
testCommand('cat > generated-docs/../secret.env', 'deny', 'write traversal to secret file = denied (deny pattern catches secret)');

// Normal writes still work
testCommand('cat > generated-docs/plan.md', 'allow', 'normal write to generated-docs = allowed');
testCommand("cat > generated-docs/specs/api-spec.yaml << 'EOF'", 'allow', 'heredoc write to generated-docs = allowed');

// Reads with traversal still work
testCommand('cat documentation/../package.json', 'allow', 'read traversal from documentation = allowed');
testCommand('cat web/../CLAUDE.md', 'allow', 'read traversal from web = allowed');

// =============================================================================
// HEAD/TAIL - safe directory file reading
// =============================================================================
console.log('\nHead/tail commands');

testCommand('head documentation/BRD.md', 'allow', 'head documentation file (no flags)');
testCommand('head -5 documentation/BRD.md', 'allow', 'head -5 documentation file');
testCommand('head -n 20 web/src/app/page.tsx', 'allow', 'head -n 20 web file');
testCommand('head -c 100 generated-docs/plan.md', 'allow', 'head -c 100 generated-docs file');
testCommand('head .claude/hooks/bash-permission-checker.ps1', 'allow', 'head .claude file');
testCommand('head -20 .github/workflows/ci.yml', 'allow', 'head -20 .github file');
testCommand('head -5 documentation/file.md 2>/dev/null', 'allow', 'head with 2>/dev/null');

testCommand('tail documentation/BRD.md', 'allow', 'tail documentation file (no flags)');
testCommand('tail -5 documentation/BRD.md', 'allow', 'tail -5 documentation file');
testCommand('tail -n 20 web/src/app/page.tsx', 'allow', 'tail -n 20 web file');
testCommand('tail -n +10 documentation/api-spec.yaml', 'allow', 'tail -n +10 (from line 10 onwards)');
testCommand('tail -c 100 generated-docs/plan.md', 'allow', 'tail -c 100 generated-docs file');
testCommand('tail .claude/hooks/bash-permission-checker.ps1', 'allow', 'tail .claude file');
testCommand('tail -5 documentation/file.md 2>/dev/null', 'allow', 'tail with 2>/dev/null');

testCommand('cd /c/Git/project && head -5 web/package.json', 'allow', 'cd prefix + head');
testCommand('cd /c/Git/project && tail -5 documentation/file.md', 'allow', 'cd prefix + tail');

testCommand('tail -5 /c/Git/project/documentation/file.md', 'allow', 'tail with absolute Unix path to safe dir');
testCommand('head -10 /c/Git/project/web/src/app/page.tsx', 'allow', 'head with absolute Unix path to safe dir');

testCommand('tail -5 /etc/passwd', 'fallthrough', 'tail /etc/passwd = fallthrough');
testCommand('head ~/.bashrc', 'fallthrough', 'head ~/.bashrc = fallthrough');

testCommand('head ~/.ssh/id_rsa', 'deny', 'head SSH key = denied');
testCommand('tail server.pem', 'deny', 'tail .pem file = denied');
testCommand('tail /home/user/.ssh/config', 'deny', 'tail .ssh directory = denied');

// =============================================================================
// WC - safe directory word/line counts
// =============================================================================
console.log('\nWc commands');

testCommand('wc -l documentation/BRD.md', 'allow', 'wc -l documentation file');
testCommand('wc -lw web/src/app/page.tsx', 'allow', 'wc -lw web file');
testCommand('wc -c generated-docs/plan.md', 'allow', 'wc -c generated-docs file');
testCommand('wc .claude/hooks/bash-permission-checker.ps1', 'allow', 'wc .claude file (no flags)');
testCommand('cd /c/Git/project && wc -l documentation/file.md', 'allow', 'cd prefix + wc');
testCommand('wc -l documentation/file.md 2>/dev/null', 'allow', 'wc with 2>/dev/null');
testCommand('wc -l /etc/passwd', 'fallthrough', 'wc /etc/passwd = fallthrough');
testCommand('wc -l ~/.bashrc', 'fallthrough', 'wc ~/.bashrc = fallthrough');

// =============================================================================
// DIFF - safe directory file comparison
// =============================================================================
console.log('\nDiff commands');

testCommand('diff documentation/old.yaml documentation/new.yaml', 'allow', 'diff two documentation files');
testCommand('diff -u web/src/old.tsx web/src/new.tsx', 'allow', 'diff -u two web files');
testCommand('diff --unified documentation/a.md generated-docs/b.md', 'allow', 'diff --unified across safe dirs');
testCommand('diff --color web/src/a.ts .claude/hooks/b.ps1', 'allow', 'diff --color web vs .claude');
testCommand('cd /c/Git/project && diff documentation/a.md documentation/b.md', 'allow', 'cd prefix + diff');
testCommand('diff documentation/a.md /etc/passwd', 'fallthrough', 'diff one safe + one unsafe = fallthrough');
testCommand('diff /etc/passwd /etc/shadow', 'fallthrough', 'diff two unsafe files = fallthrough');
testCommand('diff documentation/a.md documentation/b.md 2>/dev/null', 'allow', 'diff with 2>/dev/null');

// =============================================================================
// CAT piped to HEAD/TAIL
// =============================================================================
console.log('\nCat piped to head/tail');

testCommand('cat documentation/BRD.md | head -20', 'allow', 'cat safe-dir | head');
testCommand('cat web/src/app/page.tsx | tail -5', 'allow', 'cat safe-dir | tail');
testCommand('cat generated-docs/plan.md | head -n 50', 'allow', 'cat safe-dir | head -n 50');
testCommand('cat .claude/hooks/checker.ps1 | tail -c 100', 'allow', 'cat .claude | tail -c 100');
testCommand('cd /c/Git/project && cat documentation/file.md | head -5', 'allow', 'cd + cat safe-dir | head');
testCommand('cat documentation/file.md 2>/dev/null | tail -10', 'allow', 'cat safe-dir 2>/dev/null | tail');
testCommand('cat /etc/passwd | head -5', 'fallthrough', 'cat unsafe dir | head = fallthrough');
testCommand('cat documentation/file.md | head -5 | grep pattern', 'allow', 'cat | head | grep = allowed (pipeline splitting)');

// =============================================================================
// BASH COMMENTS - in compound commands
// =============================================================================
console.log('\nBash comments in compound commands');

testCommand("# Check BRD for authentication mentions\ntail -5 documentation/BRD.md", 'allow', 'comment + tail safe-dir (newline split)');
testCommand("# Install dependencies\nnpm install", 'allow', 'comment + npm install (newline split)');
testCommand("# Verify build\ncd web && npm run build", 'allow', 'comment + cd && npm run build (newline split)');
testCommand("# Step 1\nnpm install\n# Step 2\nnpm test", 'allow', 'multiple comments interspersed with commands');
testCommand('# just a comment', 'fallthrough', 'standalone comment = fallthrough (single cmd, no split)');

// =============================================================================
// DENY PATTERN CONSISTENCY
// =============================================================================
console.log('\nDeny pattern consistency');

testCommand('head secret.env', 'deny', 'head secret file = denied');
testCommand('tail private_key.pem', 'deny', 'tail private key file = denied');
testCommand('sed -n "1p" secret.json', 'deny', 'sed secret file = denied');
testCommand('awk "{print}" private.key', 'deny', 'awk private key file = denied');
testCommand('less secrets.yaml', 'deny', 'less secrets file = denied');
testCommand('more private_rsa_key.txt', 'deny', 'more private key file = denied');

// =============================================================================
// DENY SAFE-DIRECTORY EXCEPTION
// =============================================================================
console.log('\nDeny safe-directory exception');

testCommand('cat web/src/lib/secret-handler.ts', 'allow', 'cat safe-dir file with "secret" in name = allowed (safe dir + allow pattern)');
testCommand('head web/src/lib/secret-handler.ts', 'allow', 'head safe-dir file with "secret" in name = allowed');
testCommand('tail documentation/secrets-management-guide.md', 'allow', 'tail safe-dir file with "secret" in name = allowed');

testCommand('cat secret.env', 'deny', 'cat secret.env (no safe dir) = denied');
testCommand('head secret.env', 'deny', 'head secret.env (no safe dir) = denied');
testCommand('cat /tmp/secret.txt', 'deny', 'cat /tmp/secret.txt = denied');

testCommand('cat secret.env && cat documentation/safe.md', 'deny', 'cat secret.env && cat safe-dir = denied (secret sub-cmd caught)');

testCommand('cat web/src/private-key-handler.ts', 'allow', 'cat safe-dir file with "private.*key" = allowed');

// =============================================================================
// QUOTED PATHS WITH SPACES
// =============================================================================
console.log('\nQuoted paths with spaces');

testCommand('cat "documentation/My File.md"', 'allow', 'cat quoted path with spaces');
testCommand("cat 'documentation/My File.md'", 'allow', 'cat single-quoted path with spaces');
testCommand('type "documentation/My File.md"', 'allow', 'type quoted path with spaces');
testCommand('head -5 "documentation/My File.md"', 'allow', 'head quoted path with spaces');
testCommand('tail -n 20 "web/src/My Component.tsx"', 'allow', 'tail quoted path with spaces');
testCommand('wc -l "documentation/My File.md"', 'allow', 'wc quoted path with spaces');
testCommand('diff "documentation/Old File.md" "documentation/New File.md"', 'allow', 'diff two quoted paths with spaces');
testCommand('cat "documentation/My File.md" | grep "pattern"', 'allow', 'cat quoted with spaces | grep');
testCommand('sed -n "100,406p" "documentation/Api Definition.yaml"', 'allow', 'sed quoted path with spaces');
testCommand("sed -n '100,406p' /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'sed backslash-escaped space in path');
testCommand("cat /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'cat backslash-escaped space in path');
testCommand("head -100 /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'head backslash-escaped space in path');
testCommand("wc -l /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'wc backslash-escaped space in path');
testCommand("wc -l /c/Git/test-repo/documentation/Api\\ Definition.yaml && head -100 /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'wc + head compound with backslash-escaped spaces');
testCommand("grep -i pattern /c/Git/test-repo/documentation/Api\\ Definition.yaml", 'allow', 'grep backslash-escaped space in path');
testCommand("diff /c/Git/test-repo/documentation/Api\\ Definition.yaml /c/Git/test-repo/documentation/Other\\ File.yaml", 'allow', 'diff two backslash-escaped space paths');

testCommand('cat "/etc/My Secret.txt"', 'deny', 'cat quoted unsafe path with "secret" = denied');
testCommand('cat "/tmp/My File.txt"', 'fallthrough', 'cat quoted unsafe path (no deny keyword) = fallthrough');

// =============================================================================
// SPLITTER UNIT TESTS
// =============================================================================
console.log('\nSplitter unit tests');

// Extract splitCompoundCommand and splitPipeline from the script source
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

function testSplitResult(fnName, input, expectedParts, description) {
  // We test splitters indirectly through the main script behavior
  // For direct unit tests, we'd need to export them.
  // Instead, run a tiny inline Node script that sources only the function.

  const helperScript = `
    'use strict';
    ${fnName === 'splitCompoundCommand' ? extractSplitCompoundCommand() : extractSplitPipeline()}
    const input = ${JSON.stringify(input)};
    const result = ${fnName}(input);
    process.stdout.write(JSON.stringify(result));
  `;

  let result;
  try {
    const output = execFileSync('node', ['-e', helperScript], { encoding: 'utf8', timeout: 5000 });
    result = JSON.parse(output);
  } catch (err) {
    failed++;
    errors.push(`FAIL: ${description} (exec error: ${err.message})`);
    console.log(`  \x1b[31mFAIL: ${description} (exec error)\x1b[0m`);
    return;
  }

  if (expectedParts === null) {
    if (result === null) {
      passed++;
      console.log(`  \x1b[32mPASS\x1b[0m: ${description}`);
    } else {
      failed++;
      const msg = `FAIL: ${description} (expected null, got ${Array.isArray(result) ? result.length + ' parts' : result})`;
      errors.push(msg);
      console.log(`  \x1b[31m${msg}\x1b[0m`);
    }
    return;
  }

  if (result === null) {
    failed++;
    const msg = `FAIL: ${description} (expected ${expectedParts.length} parts, got null)`;
    errors.push(msg);
    console.log(`  \x1b[31m${msg}\x1b[0m`);
    return;
  }

  if (result.length !== expectedParts.length) {
    failed++;
    const msg = `FAIL: ${description} (expected ${expectedParts.length} parts, got ${result.length}: ${result.join(' | ')})`;
    errors.push(msg);
    console.log(`  \x1b[31m${msg}\x1b[0m`);
    return;
  }

  for (let j = 0; j < result.length; j++) {
    if (result[j] !== expectedParts[j]) {
      failed++;
      const msg = `FAIL: ${description} (part ${j} expected '${expectedParts[j]}', got '${result[j]}')`;
      errors.push(msg);
      console.log(`  \x1b[31m${msg}\x1b[0m`);
      return;
    }
  }
  passed++;
  console.log(`  \x1b[32mPASS\x1b[0m: ${description}`);
}

function extractSplitCompoundCommand() {
  // Extract the function from the script source
  const start = scriptSource.indexOf('function splitCompoundCommand(');
  if (start === -1) return '// not found';
  let depth = 0;
  let end = start;
  let foundFirst = false;
  for (let i = start; i < scriptSource.length; i++) {
    if (scriptSource[i] === '{') { depth++; foundFirst = true; }
    if (scriptSource[i] === '}') { depth--; }
    if (foundFirst && depth === 0) { end = i + 1; break; }
  }
  return scriptSource.substring(start, end);
}

function extractSplitPipeline() {
  const start = scriptSource.indexOf('function splitPipeline(');
  if (start === -1) return '// not found';
  let depth = 0;
  let end = start;
  let foundFirst = false;
  for (let i = start; i < scriptSource.length; i++) {
    if (scriptSource[i] === '{') { depth++; foundFirst = true; }
    if (scriptSource[i] === '}') { depth--; }
    if (foundFirst && depth === 0) { end = i + 1; break; }
  }
  return scriptSource.substring(start, end);
}

// Compound splitter tests
testSplitResult('splitCompoundCommand', 'npm install && npm test', ['npm install', 'npm test'], 'simple && split');
testSplitResult('splitCompoundCommand', 'npm test || echo "failed"', ['npm test', 'echo "failed"'], 'simple || split');
testSplitResult('splitCompoundCommand', 'npm install ; npm run build', ['npm install', 'npm run build'], 'simple ; split');
testSplitResult('splitCompoundCommand', "npm install\nnpm test", ['npm install', 'npm test'], 'newline split');
testSplitResult('splitCompoundCommand', 'cd web && npm install && npm test', ['cd web', 'npm install', 'npm test'], 'three-way && split');
testSplitResult('splitCompoundCommand', 'echo "foo && bar"', null, 'quoted && returns null (single command)');
testSplitResult('splitCompoundCommand', "echo 'a ; b'", null, 'single-quoted ; returns null (single command)');
testSplitResult('splitCompoundCommand', '(npm test && npm build)', null, 'parenthesized group returns null (single command)');
testSplitResult('splitCompoundCommand', 'cat file | head -5', null, 'single pipe not split (returns null)');
testSplitResult('splitCompoundCommand', 'test -d node_modules && echo "ok" || npm install', ['test -d node_modules', 'echo "ok"', 'npm install'], 'mixed && and || split');
testSplitResult('splitCompoundCommand', "cat > /tmp/test.js << 'EOF'\nsome content\nEOF\nnpm test", ["cat > /tmp/test.js << 'EOF'\nsome content\nEOF", 'npm test'], 'heredoc body not split, newline after EOF splits');
testSplitResult('splitCompoundCommand', 'npm test', null, 'single command returns null');
testSplitResult('splitCompoundCommand', "# this is a comment\ntail -5 file.md", ['# this is a comment', 'tail -5 file.md'], 'comment + command split on newline');
testSplitResult('splitCompoundCommand', "# step 1\nnpm install\n# step 2\nnpm test", ['# step 1', 'npm install', '# step 2', 'npm test'], 'multiple comments and commands split on newlines');

// Pipeline splitter tests
console.log('\nPipeline splitter unit tests');

testSplitResult('splitPipeline', 'cat file | head -5', ['cat file', 'head -5'], 'simple pipe split');
testSplitResult('splitPipeline', 'cat file | grep pattern | head -5', ['cat file', 'grep pattern', 'head -5'], 'three-way pipe split');
testSplitResult('splitPipeline', 'npm test', null, 'no pipe returns null');
testSplitResult('splitPipeline', 'npm test || echo "failed"', null, '|| is not a pipe split (returns null)');
testSplitResult('splitPipeline', 'echo "foo | bar" | grep baz', ['echo "foo | bar"', 'grep baz'], 'quoted pipe not split');
testSplitResult('splitPipeline', "echo 'a | b' | wc -l", ["echo 'a | b'", 'wc -l'], 'single-quoted pipe not split');
testSplitResult('splitPipeline', 'cat file | sort | uniq | wc -l', ['cat file', 'sort', 'uniq', 'wc -l'], 'four-way pipe split');

// =============================================================================
// REDIRECT STRIPPING
// =============================================================================
console.log('\nRedirect stripping');

testCommand('git status 2>&1', 'allow', 'git status 2>&1 = allowed (redirect stripped)');
testCommand('git log --oneline -5 2>&1', 'allow', 'git log 2>&1 = allowed');
testCommand('git diff 2>/dev/null', 'allow', 'git diff 2>/dev/null = allowed');
testCommand('npm test 2>&1', 'allow', 'npm test 2>&1 = allowed');
testCommand('ls -la web/src/ 2>&1', 'allow', 'ls safe dir 2>&1 = allowed');
testCommand('cat web/src/app/page.tsx 2>&1', 'allow', 'cat safe-dir 2>&1 = allowed');
testCommand('find .claude -name "*.json" 2>&1', 'allow', 'find safe-dir 2>&1 = allowed');
testCommand('npx vitest --run 2>&1', 'allow', 'npx vitest 2>&1 = allowed');

testCommand('cat ~/.ssh/id_rsa 2>&1', 'deny', 'cat SSH key 2>&1 = still denied');
testCommand('git push --force 2>&1', 'deny', 'git push --force 2>&1 = still denied');

testCommand('git add . 2>&1 && git status 2>&1', 'allow', 'compound with 2>&1 on each sub-command');

// =============================================================================
// WINDOWS START - open file in default app (safe dirs only)
// =============================================================================
console.log('\nWindows start command');

testCommand('start "" "c:/Users/dev/projects/my-app/generated-docs/dashboard.html"', 'allow', 'start dashboard (absolute path)');
testCommand('start "" "generated-docs/dashboard.html"', 'allow', 'start dashboard (relative path)');
testCommand('start "" "/c/Git/stadium-8/generated-docs/dashboard.html"', 'allow', 'start dashboard (absolute Unix path)');
testCommand('start "" generated-docs/dashboard.html', 'allow', 'start dashboard (no quotes)');
testCommand('start "" "web/src/app/page.tsx"', 'allow', 'start web file');
testCommand('start "" ".claude/hooks/checker.js"', 'allow', 'start .claude file');
testCommand('start "" "c:/Windows/System32/cmd.exe"', 'fallthrough', 'start unsafe path = fallthrough');
testCommand('start "" "/tmp/evil.sh"', 'fallthrough', 'start /tmp file = fallthrough');

// =============================================================================
// PIPELINE SPLITTING
// =============================================================================
console.log('\nPipeline splitting');

testCommand('cat web/src/app/page.tsx | grep "import"', 'allow', 'cat safe-dir | grep pattern');
testCommand('cat documentation/BRD.md | wc -l', 'allow', 'cat safe-dir | wc -l');
testCommand('cat web/package.json | sort', 'allow', 'cat safe-dir | sort');
testCommand('cat web/package.json | sort | uniq', 'allow', 'cat safe-dir | sort | uniq');
testCommand('cat documentation/BRD.md | grep "API" | wc -l', 'allow', 'cat | grep | wc pipeline');
testCommand('cat documentation/BRD.md | head -20 | tail -5', 'allow', 'cat | head | tail pipeline');

testCommand('cat web/src/app/page.tsx 2>&1 | grep "import"', 'allow', 'cat safe-dir 2>&1 | grep (redirect + pipeline)');

testCommand('npm install && cat web/src/app/page.tsx | head -20', 'allow', 'pipeline within compound command');

testCommand('cat /etc/shadow | head -5', 'fallthrough', 'cat unsafe file | head = fallthrough');
testCommand('curl https://example.com | grep pattern', 'fallthrough', 'curl | grep = fallthrough (curl not allowed)');

testCommand('echo "test" | cat ~/.ssh/id_rsa', 'deny', 'pipe to denied command = denied');

// Git push with redirect
withPreferences({ git: { autoApproveCommit: true, autoApprovePush: true } }, () => {
  testCommand('git push origin main 2>&1', 'allow', 'git push origin main 2>&1 = allowed (original bug fix)');
  testCommand('git push -u origin feature-branch 2>/dev/null', 'allow', 'git push -u 2>/dev/null = allowed');
});

// =============================================================================
// DYNAMIC SAFE PATHS - prototype repo read access
// =============================================================================

// --- Without safePaths config (fallthrough by default) ---
withPreferences(null, () => {
  console.log('\nPrototype repo without config (fallthrough)');

  testCommand('cat c:/Git/prototype-project/src/App.tsx', 'fallthrough', 'cat prototype repo without config = fallthrough');
  testCommand('grep -r "import" c:/Git/prototype-project/src/', 'fallthrough', 'grep prototype repo without config = fallthrough');
});

// --- With safePaths.prototypeRepo configured ---
withPreferences({ safePaths: { prototypeRepo: 'c:/Git/prototype-project' } }, () => {
  console.log('\nPrototype repo with safePaths config (read-only allowed)');

  // Basic read commands
  testCommand('cat c:/Git/prototype-project/src/App.tsx', 'allow', 'cat prototype repo file');
  testCommand('cat "c:/Git/prototype-project/src/App.tsx"', 'allow', 'cat prototype repo file (quoted)');
  testCommand('head -20 c:/Git/prototype-project/src/App.tsx', 'allow', 'head prototype repo file');
  testCommand('tail -10 c:/Git/prototype-project/src/utils.ts', 'allow', 'tail prototype repo file');
  testCommand('grep -r "import" c:/Git/prototype-project/src/', 'allow', 'grep prototype repo');
  testCommand('wc -l c:/Git/prototype-project/src/App.tsx', 'allow', 'wc prototype repo file');
  testCommand('ls c:/Git/prototype-project/src/', 'allow', 'ls prototype repo directory');
  testCommand('ls -la c:/Git/prototype-project/', 'allow', 'ls -la prototype repo root');
  testCommand('find c:/Git/prototype-project/src -name "*.tsx"', 'allow', 'find in prototype repo');

  // Quoted paths with spaces
  testCommand('cat "c:/Git/prototype-project/src/my component.tsx"', 'allow', 'cat prototype repo file with spaces (quoted)');

  // Pipeline with prototype repo
  testCommand('cat c:/Git/prototype-project/src/App.tsx | grep "import"', 'allow', 'cat prototype repo | grep pipeline');
  testCommand('grep -r "export" c:/Git/prototype-project/src/ | wc -l', 'allow', 'grep prototype repo | wc pipeline');

  // Node import scripts reading from prototype repo
  testCommand('node .claude/scripts/import-prototype.js --from c:/Git/prototype-project', 'allow', 'node import script with prototype repo arg');

  // Windows backslash paths
  testCommand('cat c:\\Git\\prototype-project\\src\\App.tsx', 'allow', 'cat prototype repo (backslash path)');
  testCommand('type c:\\Git\\prototype-project\\src\\App.tsx', 'allow', 'type prototype repo (backslash path)');

  // Safety: write commands should NOT be auto-approved
  testCommand('sed -i "s/foo/bar/" c:/Git/prototype-project/src/App.tsx', 'fallthrough', 'sed -i prototype repo = fallthrough (write not allowed)');
  testCommand('rm c:/Git/prototype-project/src/App.tsx', 'fallthrough', 'rm prototype repo file = fallthrough');

  // Safety: find with -exec should NOT be auto-approved
  testCommand('find c:/Git/prototype-project/src -name "*.tsx" -exec cat {} \\;', 'fallthrough', 'find prototype repo with -exec = fallthrough');
  testCommand('find c:/Git/prototype-project/src -delete', 'fallthrough', 'find prototype repo with -delete = fallthrough');

  // Safety: other paths still not allowed
  testCommand('cat c:/Git/other-project/src/App.tsx', 'fallthrough', 'cat different repo = fallthrough');
  testCommand('cat /etc/passwd', 'fallthrough', 'cat /etc/passwd still fallthrough');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);

if (errors.length > 0) {
  console.log('\nFailures:');
  for (const err of errors) {
    console.log(`  \x1b[31m${err}\x1b[0m`);
  }
}

console.log('========================================\n');
process.exit(failed === 0 ? 0 : 1);
