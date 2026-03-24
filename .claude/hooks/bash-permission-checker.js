#!/usr/bin/env node
/**
 * PreToolUse hook that auto-approves safe Bash commands for Claude Code.
 *
 * Receives tool call JSON via stdin, checks against deny/allow patterns,
 * and outputs permission decision JSON.
 *
 * Exit codes:
 * - 0 with JSON output: Command approved
 * - 0 without output: Falls through to normal permission system
 * - 2: Block the command
 *
 * Location: .claude/hooks/bash-permission-checker.js
 * Ported from: .claude/hooks/bash-permission-checker.ps1
 */
'use strict';

const fs = require('fs');
const path = require('path');

// =============================================================================
// READ STDIN
// =============================================================================
let inputJson;
try {
  const raw = fs.readFileSync(0, 'utf8'); // fd 0 = stdin
  inputJson = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (inputJson.tool_name !== 'Bash') process.exit(0);

let command = inputJson.tool_input?.command;
if (!command) process.exit(0);

// =============================================================================
// HELPERS
// =============================================================================

function writeAllowAndExit(reason) {
  const output = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
    },
  });
  process.stdout.write(output);
  process.exit(0);
}

function denyAndExit(msg) {
  process.stderr.write(msg + '\n');
  process.exit(2);
}

/** Case-insensitive regex test (for one-off checks only; hot-path loops use pre-compiled) */
function iMatch(str, re) {
  return re.test(str);
}

// =============================================================================
// NORMALIZATION - strip harmless trailing stderr redirects
// =============================================================================

function stripTrailingRedirect(cmd) {
  return cmd.replace(/\s+2>(?:&1|\/dev\/null)\s*$/, '').trim();
}

/** Collapse bash line continuations (backslash-newline) into a single space */
function collapseLineContinuations(cmd) {
  return cmd.replace(/\\\n\s*/g, ' ');
}

command = collapseLineContinuations(command);
command = stripTrailingRedirect(command);

// =============================================================================
// COMPOUND COMMAND SPLITTER
// =============================================================================

function splitCompoundCommand(text) {
  const commands = [];
  let current = '';
  let i = 0;
  const len = text.length;
  let state = 'NORMAL';
  let heredocDelimiter = null;
  let parenDepth = 0;

  while (i < len) {
    const c = text[i];

    if (state === 'SINGLE_QUOTE') {
      current += c;
      if (c === "'") state = 'NORMAL';
      i++;
      continue;
    }

    if (state === 'DOUBLE_QUOTE') {
      current += c;
      if (c === '\\' && i + 1 < len && text[i + 1] === '"') {
        current += text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') state = 'NORMAL';
      i++;
      continue;
    }

    if (state === 'HEREDOC') {
      current += c;
      if (c === '\n') {
        let lineEnd = text.indexOf('\n', i + 1);
        if (lineEnd === -1) lineEnd = len;
        const line = text.substring(i + 1, lineEnd).trim();
        if (line === heredocDelimiter) {
          current += text.substring(i + 1, lineEnd);
          i = lineEnd;
          state = 'NORMAL';
          heredocDelimiter = null;
          continue;
        }
      }
      i++;
      continue;
    }

    // state === 'NORMAL'
    if (c === "'" && parenDepth === 0) {
      current += c;
      state = 'SINGLE_QUOTE';
      i++;
      continue;
    }
    if (c === '"' && parenDepth === 0) {
      current += c;
      state = 'DOUBLE_QUOTE';
      i++;
      continue;
    }

    if (c === '(') {
      parenDepth++;
      current += c;
      i++;
      continue;
    }
    if (c === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += c;
      i++;
      continue;
    }

    if (parenDepth > 0) {
      current += c;
      i++;
      continue;
    }

    // Heredoc detection: << [-] ['"]DELIM['"]
    if (c === '<' && i + 1 < len && text[i + 1] === '<') {
      current += '<<';
      i += 2;
      while (i < len && (text[i] === '-' || /\s/.test(text[i])) && text[i] !== '\n') {
        current += text[i];
        i++;
      }
      let quoteChar = null;
      if (i < len && (text[i] === "'" || text[i] === '"')) {
        quoteChar = text[i];
        current += text[i];
        i++;
      }
      const delimStart = i;
      while (i < len && /\w/.test(text[i])) {
        current += text[i];
        i++;
      }
      heredocDelimiter = text.substring(delimStart, i);
      if (quoteChar && i < len && text[i] === quoteChar) {
        current += text[i];
        i++;
      }
      if (heredocDelimiter.length > 0) state = 'HEREDOC';
      continue;
    }

    // Split on &&
    if (c === '&' && i + 1 < len && text[i + 1] === '&') {
      const trimmed = current.trim();
      if (trimmed) commands.push(trimmed);
      current = '';
      i += 2;
      continue;
    }

    // Split on || (but NOT single |)
    if (c === '|' && i + 1 < len && text[i + 1] === '|') {
      const trimmed = current.trim();
      if (trimmed) commands.push(trimmed);
      current = '';
      i += 2;
      continue;
    }

    // Split on ;
    if (c === ';') {
      const trimmed = current.trim();
      if (trimmed) commands.push(trimmed);
      current = '';
      i++;
      continue;
    }

    // Split on newline
    if (c === '\n') {
      const trimmed = current.trim();
      if (trimmed) commands.push(trimmed);
      current = '';
      i++;
      continue;
    }

    // Single pipe is NOT a split point
    current += c;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) commands.push(trimmed);

  if (state !== 'NORMAL' || parenDepth !== 0) return null;
  if (commands.length <= 1) return null;
  return commands;
}

// =============================================================================
// PIPELINE SPLITTER
// =============================================================================

function splitPipeline(text) {
  if (text.indexOf('|') === -1) return null;

  const segments = [];
  let current = '';
  let i = 0;
  const len = text.length;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  while (i < len) {
    const c = text[i];

    if (inSingleQuote) {
      current += c;
      if (c === "'") inSingleQuote = false;
      i++;
      continue;
    }

    if (inDoubleQuote) {
      current += c;
      if (c === '\\' && i + 1 < len && text[i + 1] === '"') {
        current += text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inDoubleQuote = false;
      i++;
      continue;
    }

    if (c === "'") {
      current += c;
      inSingleQuote = true;
      i++;
      continue;
    }

    if (c === '"') {
      current += c;
      inDoubleQuote = true;
      i++;
      continue;
    }

    // || is NOT a pipe split
    if (c === '|' && i + 1 < len && text[i + 1] === '|') {
      current += '||';
      i += 2;
      continue;
    }

    // Single | is a split point
    if (c === '|') {
      const trimmed = current.trim();
      if (trimmed) segments.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += c;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) segments.push(trimmed);

  if (inSingleQuote || inDoubleQuote) return null;
  if (segments.length <= 1) return null;
  return segments;
}

// =============================================================================
// PREFERENCES
// =============================================================================

function getPreferences() {
  try {
    const configPath = path.join(__dirname, '..', 'preferences.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }
}

const prefs = getPreferences();

// =============================================================================
// DENY PATTERNS
// =============================================================================

const fileReadCmdsBase = 'cat|type|Get-Content|more|less|head|tail|sed|awk';
const fileReadCmds = '(' + fileReadCmdsBase + ')';
const safeDirs = '(documentation|web|generated-docs|\\.claude|\\.github)';
const safeDirsWrite = '(web|\\.claude[/\\\\](?:context|scripts)|generated-docs)';

const denyPatterns = [
  'rm\\s+-rf\\s+/',
  fileReadCmds + '.*id_rsa',
  fileReadCmds + '.*\\.pem\\b',
  fileReadCmds + '.*credentials',
  fileReadCmds + '.*[/\\\\]\\.ssh[/\\\\]',
  fileReadCmds + '.*private.*key',
  fileReadCmds + '.*secret',
  'git\\s+push\\s+.*--force',
  'git\\s+push\\s+.*-f\\b',
  'git\\s+push\\s+.*--delete',
  'git\\s+push\\s+.*--no-verify',
  'git\\s+commit\\s+.*--no-verify',
  'git\\s+commit\\s+.*--amend',
].map(p => new RegExp(p, 'i'));

// Safe-directory file path pattern
const fileReadCmdsExt = '(' + fileReadCmdsBase + '|wc|diff)';
const cdPrefix = '(?:cd\\s+["\']?[\\w./:~\\\\-]+["\']?\\s*&&\\s*)?';
const safeDirFilePattern = new RegExp(
  '^\\s*' + cdPrefix + fileReadCmdsExt + '\\s+(?:[-+]?[\\w-]+\\s+)*["\']?[\\w./:~\\\\-]*' + safeDirs + '[/\\\\]',
  'i'
);

function isSafeDirCommand(cmd) {
  return safeDirFilePattern.test(cmd);
}

// Hoist once
const commandIsSafeDir = isSafeDirCommand(command);

for (const pattern of denyPatterns) {
  if (iMatch(command, pattern)) {
    if (commandIsSafeDir) continue;
    denyAndExit('Blocked by security policy: Command matches deny pattern');
  }
}

// =============================================================================
// ALLOW PATTERNS
// =============================================================================

const winPath = '["\']?[\\w./:~\\\\-]*';
const subPath = '[\\w./\\\\-]';
const subPathW = '(?:(?!\\.\\.[/\\\\])[\\w./\\\\-])';  // write-safe: no path traversal
const subPathQ = '[\\w./\\\\ -]';                       // subpath chars including space
const subPathE = '(?:[\\w./\\\\-]|\\\\ )';              // subpath chars including backslash-escaped space
const npmPrefix = '(?:--prefix\\s+["\']?[\\w./:~\\\\-]+["\']?\\s+)?';
const envPrefix = '(?:[A-Z_][A-Z0-9_]*=[\\w./:~=-]+\\s+)*';  // optional VAR=value prefixes
const cdEnvPrefix = cdPrefix + envPrefix;

let allowPatterns = [
  // --- NPM ---
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'ci(?:\\s+--[\\w-]+)*\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'install(?:\\s+--[\\w-]+)*\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'i(?:\\s+--[\\w-]+)*\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'install(?:\\s+--[\\w-]+)*(?:\\s+@types/[\\w-]+)+\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'i(?:\\s+--[\\w-]+)*(?:\\s+@types/[\\w-]+)+\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'install(?:\\s+--[\\w-]+)*(?:\\s+@radix-ui/[\\w-]+)+\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'i(?:\\s+--[\\w-]+)*(?:\\s+@radix-ui/[\\w-]+)+\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'install(?:\\s+--[\\w-]+)*\\s+msw(?:\\s+--[\\w-]+)*\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'i(?:\\s+--[\\w-]+)*\\s+msw(?:\\s+--[\\w-]+)*\\s*$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'test(?:\\s+.*)?$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 't(?:\\s+.*)?$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'run\\s+(build|lint|dev|format|test|typecheck|check|generate)(?::\\w+)?(?:\\s+.*)?$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'audit(?:\\s+.*)?$',
  cdEnvPrefix + 'npm\\s+' + npmPrefix + 'exec\\s+(?:--\\s+)?(tsc|vitest|eslint|next|msw|prettier|shadcn)(?:\\s+.*)?$',
  cdPrefix + '(?:test\\s+-d|\\[\\s+-d)\\s+node_modules\\s*\\]?(?:\\s*[&|]+\\s*(?:echo\\s+["\'].*["\']|\\(echo\\s+["\'].*["\']\\)|\\(?npm\\s+install\\)?)\\s*)*$',
  cdPrefix + 'if\\s+exist\\s+["\']?node_modules[/\\\\]?["\']?\\s*(?:\\(.*\\)\\s*)?(?:else\\s*\\(.*\\)\\s*)?$',

  // --- NPX / bare dev tools ---
  cdEnvPrefix + 'npx\\s+tsc(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+shadcn(?:@[\\w.]+)?(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+vitest(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+next(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+eslint(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+msw(?:\\s+.*)?$',
  cdEnvPrefix + 'node_modules[/\\\\]\\.bin[/\\\\](eslint|msw|next|tsc|vitest|prettier|shadcn)(?:\\s+.*)?$',
  cdEnvPrefix + 'npx\\s+prettier(?:\\s+.*)?$',
  cdEnvPrefix + '(tsc|vitest|eslint|prettier)(?:\\s+.*)?$',

  // --- Node scripts (safe directories only) ---
  cdEnvPrefix + 'node\\s+' + winPath + '\\.claude[/\\\\]scripts[/\\\\]' + subPath + '+["\']?(?:\\s+.*)?$',
  cdEnvPrefix + 'node\\s+' + winPath + 'web[/\\\\]' + subPath + '+["\']?(?:\\s+.*)?$',
  cdEnvPrefix + 'node\\s+' + winPath + 'generated-docs[/\\\\]' + subPath + '+["\']?(?:\\s+.*)?$',
  cdEnvPrefix + 'node\\s+' + winPath + '\\.github[/\\\\]scripts[/\\\\]' + subPath + '+["\']?(?:\\s+.*)?$',

  // --- Directory operations (safe directories) ---
  cdPrefix + 'mkdir\\s+(?:-p\\s+)?(?:' + winPath + safeDirs + '[/\\\\]?' + subPath + '*["\']?\\s*)+$',

  // --- File reading (safe directories only) ---
  cdPrefix + 'sed\\s+-n\\s+.+\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + 'cat\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + 'cat\\s+node_modules/[\\w@.*/-]+\\.\\w+\\s*$',
  cdPrefix + 'type\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + 'cat\\s+' + winPath + '[\\w.-]+\\.config\\.[\\w]+["\']?\\s*$',
  cdPrefix + 'type\\s+' + winPath + '[\\w.-]+\\.config\\.[\\w]+["\']?\\s*$',
  cdPrefix + 'grep(?:\\s+-[\\w]+)*\\s+(?:["\'][^"\']*["\']|\\S+)\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + '(head|tail)(?:\\s+[-+]?[\\w]+)*\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + 'wc(?:\\s+-[lwcmL]+)*\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',
  cdPrefix + 'diff(?:\\s+--?[\\w-]+)*\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s*$',

  // --- Quoted paths with spaces ---
  cdPrefix + 'sed\\s+-n\\s+.+\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',
  cdPrefix + 'cat\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',
  cdPrefix + 'type\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',
  cdPrefix + '(head|tail)(?:\\s+[-+]?[\\w]+)*\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',
  cdPrefix + 'wc(?:\\s+-[lwcmL]+)*\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',
  cdPrefix + 'diff(?:\\s+--?[\\w-]+)*\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s*$',

  // --- Pipeline filter commands (no file argument) ---
  cdPrefix + 'grep(?:\\s+-[\\w]+)*\\s+(?:["\'][^"\']*["\']|\\S+)\\s*$',
  cdPrefix + '(head|tail)(?:\\s+[-+]?[\\w]+)*\\s*$',
  cdPrefix + 'wc(?:\\s+-[lwcmL]+)*\\s*$',
  cdPrefix + 'sort(?:\\s+[-\\w]+)*\\s*$',
  cdPrefix + 'uniq(?:\\s+[-\\w]+)*\\s*$',

  // --- File copy (read from safe dirs, write to write-safe dirs, no path traversal in dest) ---
  cdPrefix + 'cp(?:\\s+-[\\w]+)*\\s+' + winPath + safeDirs + '[/\\\\]' + subPathE + '+["\']?\\s+' + winPath + safeDirsWrite + '[/\\\\]' + subPathW + '+["\']?\\s*$',
  cdPrefix + 'cp(?:\\s+-[\\w]+)*\\s+["\'][\\w./:~\\\\ -]*' + safeDirs + '[/\\\\]' + subPathQ + '+["\']\\s+["\'][\\w./:~\\\\ -]*' + safeDirsWrite + '[/\\\\](?:(?!\\.\\.[/\\\\])[\\w./\\\\ -])+["\']\\s*$',

  // --- File writing (safe directories only, write-safe subpath blocks ../ traversal) ---
  cdPrefix + 'cat\\s*>\\s*' + winPath + safeDirsWrite + '[/\\\\]' + subPathW + '+["\']?\\s*$',
  cdPrefix + 'cat\\s*>\\s*' + winPath + safeDirsWrite + '[/\\\\]' + subPathW + '+["\']?\\s*<<\\s*-?\\s*[\'"]?\\w+[\'"]?',
  cdPrefix + 'sed\\s+-i\\S*\\s+.+\\s+' + winPath + safeDirsWrite + '[/\\\\]' + subPathW + '+["\']?\\s*$',
  cdPrefix + 'sed\\s+-i\\S*\\s+.+\\s+["\'][\\w./:~\\\\ -]*' + safeDirsWrite + '[/\\\\](?:(?!\\.\\.[/\\\\])[\\w./\\\\ -])+["\']\\s*$',

  // --- Find (any path, read-only flags only: no -exec, -execdir, -delete, -ok) ---
  cdPrefix + 'find\\s+["\']?[\\w./:~\\\\-]+["\']?(?:\\s+(?:-(?:name|iname|type|maxdepth|mindepth|path)\\s+["\']?[\\w.*?/\\\\:-]+["\']?|-(?:empty|print0?)|!|-not|-o|\\\\[()]?))*\\s*$',

  // --- Directory listing ---
  cdPrefix + 'ls(?:\\s+-[\\w]+)*(?:\\s+["\']?[\\w./:~\\\\*?-]+["\']?)*\\s*$',
  cdPrefix + 'ls(?:\\s+-[\\w]+)*\\s+["\']?[\\w./:~\\\\-]*' + safeDirs + '[/\\\\]?[\\w./\\\\*?-]*["\']?(?:\\s+.*)?$',
  cdPrefix + 'dir(?:\\s+' + winPath + '["\']?)*\\s*$',
  cdPrefix + 'Get-ChildItem(?:\\s+.*)?$',

  // --- PowerShell ---
  'powershell\\s+-Command\\s+.*(Get-Content|Select-Object).*' + winPath + safeDirs,
  'powershell\\s+-Command\\s+.*Set-Content.*' + winPath + safeDirsWrite,

  // --- Utility commands ---
  cdPrefix + 'which\\s+\\w+',
  cdPrefix + 'where\\.exe\\s+\\w+',
  cdPrefix + 'command\\s+-v\\s+\\w+',
  cdPrefix + 'node\\s+--version\\s*$',
  cdPrefix + 'npm\\s+--version\\s*$',
  cdPrefix + 'git\\s+--version\\s*$',
  cdPrefix + 'git\\s+status(?:\\s+.*)?$',
  cdPrefix + 'git\\s+log(?:\\s+.*)?$',
  cdPrefix + 'git\\s+diff(?:\\s+.*)?$',
  cdPrefix + 'git\\s+show(?:\\s+.*)?$',
  cdPrefix + 'git\\s+branch(?:\\s+(?:-[avrl]+|--(?:list|all|remotes|contains|merged|no-merged)))*\\s*$',
  cdPrefix + 'git\\s+rev-parse(?:\\s+.*)?$',
  cdPrefix + 'git\\s+remote(?:\\s+-v)?\\s*$',
  cdPrefix + 'git\\s+stash\\s+list(?:\\s+.*)?$',
  cdPrefix + 'git\\s+describe(?:\\s+.*)?$',
  cdPrefix + 'git\\s+tag(?:\\s+(?:-l|--list)(?:\\s+.*)?)?$',
  cdPrefix + 'git\\s+pull(?:\\s+(?:--rebase|--ff-only|--no-rebase|[\\w./-]+))*\\s*$',
  cdPrefix + 'git\\s+add\\s+.+$',
  cdPrefix + 'pwd\\s*$',
  cdPrefix + 'echo\\s+\\$[\\w]+\\s*$',

  // --- Standalone commands ---
  'cd\\s+["\']?[\\w./:~\\\\-]+["\']?\\s*$',
  'echo\\s+["\'].*["\']\\s*$',
  'echo\\s+[\\w./:~\\\\-]+\\s*$',
  'cat\\s*<<\\s*-?\\s*[\'"]?\\w+[\'"]?',
  'cat\\s*>\\s*["\']?/tmp/' + subPath + '+["\']?\\s*<<\\s*-?\\s*[\'"]?\\w+[\'"]?',
  'cat\\s+["\']?/tmp/' + subPath + '+["\']?\\s*$',
  '(?:test\\s+-[defrsxw]|\\[\\s+-[defrsxw])\\s+["\']?[\\w./:~\\\\-]+["\']?(?:\\s+-[oa]\\s+-[defrsxw]\\s+["\']?[\\w./:~\\\\-]+["\']?)*\\s*\\]?\\s*$',
  'true\\s*$',
  'false\\s*$',

  // --- Windows: open file in default app (safe directories only) ---
  'start\\s+""\\s+["\']?' + winPath + safeDirs + '[/\\\\]' + subPath + '+["\']?\\s*$',
];

// =============================================================================
// CONFIG-CONDITIONAL PATTERNS
// =============================================================================

if (prefs?.git?.autoApproveCommit === true) {
  allowPatterns.push(
    cdPrefix + 'git\\s+commit(?:\\s+(?:-[av]|--allow-empty))*\\s+(?:-m|--message)\\s+[\\s\\S]+$'
  );
}

if (prefs?.git?.autoApprovePush === true) {
  allowPatterns.push(
    cdPrefix + 'git\\s+push(?:\\s+(?:-u|--set-upstream|--tags|[\\w./-]+))*\\s*$'
  );
}

// --- Dynamic safe paths (e.g. prototype repo specified during INTAKE) ---
if (prefs?.safePaths?.prototypeRepo) {
  const rawPath = String(prefs.safePaths.prototypeRepo);
  // Escape regex special chars (including backslash), then normalize path separators
  const escapedPath = rawPath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[\\/]+/g, '[/\\\\]');

  // Read-only commands against the prototype repo (no trailing catch-all)
  const protoReadCmds = [
    'cat', 'type', 'head', 'tail', 'less', 'more',
    'wc', 'ls', 'dir',
  ];
  const flagsOpt = '(?:\\s+[-+]?[\\w-]+)*';
  const protoPath = escapedPath + '[/\\\\]?' + subPath + '*';
  const protoPathQ = escapedPath + '[/\\\\]?' + subPathQ + '*';
  for (const cmd of protoReadCmds) {
    allowPatterns.push(
      cdPrefix + cmd + flagsOpt + '\\s+["\']?' + protoPath + '["\']?\\s*$'
    );
    allowPatterns.push(
      cdPrefix + cmd + flagsOpt + '\\s+["\'][\\w./:~\\\\ -]*' + protoPathQ + '["\']\\s*$'
    );
  }
  // diff: requires both paths to be in the prototype repo (mirrors static diff pattern)
  allowPatterns.push(
    cdPrefix + 'diff' + flagsOpt + '\\s+["\']?' + protoPath + '["\']?\\s+["\']?' + protoPath + '["\']?\\s*$'
  );
  // find: read-only flags only (mirrors static find pattern — no -exec, -execdir, -delete, -ok)
  allowPatterns.push(
    cdPrefix + 'find\\s+["\']?' + protoPath + '["\']?(?:\\s+(?:-(?:name|iname|type|maxdepth|mindepth|path)\\s+["\']?[\\w.*?/\\\\:-]+["\']?|-(?:empty|print0?)|!|-not|-o|\\\\[()]?))*\\s*$'
  );
  // grep: needs a pattern argument before the path
  const grepPatternArg = '(?:\\s+(?:["\'][^"\']*["\']|\\S+))';
  allowPatterns.push(
    cdPrefix + 'grep' + flagsOpt + grepPatternArg + '\\s+["\']?' + protoPath + '["\']?\\s*$'
  );
  allowPatterns.push(
    cdPrefix + 'grep' + flagsOpt + grepPatternArg + '\\s+["\'][\\w./:~\\\\ -]*' + protoPathQ + '["\']\\s*$'
  );
  // node import scripts reading from the prototype repo
  allowPatterns.push(
    cdEnvPrefix + 'node\\s+' + winPath + '\\.claude[/\\\\]scripts[/\\\\]' + subPath + '+["\']?\\s+.*' + escapedPath + '.*$'
  );
}

// Anchor all patterns to start
const anchoredAllowPatterns = allowPatterns.map(p => new RegExp('^' + p, 'i'));

// Check if command matches any allow pattern
for (const re of anchoredAllowPatterns) {
  if (re.test(command)) {
    writeAllowAndExit('Auto-approved: matches safe command pattern');
  }
}

// =============================================================================
// PIPELINE SPLITTING
// =============================================================================

function testPipelineAllowed(cmdText) {
  const segments = splitPipeline(cmdText);
  if (!segments) return false;

  for (let seg of segments) {
    seg = stripTrailingRedirect(seg);

    const segIsSafeDir = isSafeDirCommand(seg);
    for (const pattern of denyPatterns) {
      if (iMatch(seg, pattern)) {
        if (segIsSafeDir) return false;
        denyAndExit('Blocked by security policy: Pipe segment matches deny pattern');
      }
    }

    let segAllowed = false;
    for (const re of anchoredAllowPatterns) {
      if (re.test(seg)) {
        segAllowed = true;
        break;
      }
    }
    if (!segAllowed) return false;
  }

  return true;
}

if (testPipelineAllowed(command)) {
  writeAllowAndExit('Auto-approved: all pipeline segments match safe patterns');
}

// =============================================================================
// COMPOUND COMMAND SPLITTING
// =============================================================================

function testSubCommandAllowed(subCmd) {
  subCmd = stripTrailingRedirect(subCmd);

  // Bash comments are no-ops
  if (/^\s*#/.test(subCmd)) return true;

  const subCmdIsSafeDir = isSafeDirCommand(subCmd);
  for (const pattern of denyPatterns) {
    if (iMatch(subCmd, pattern)) {
      if (subCmdIsSafeDir) return false;
      denyAndExit('Blocked by security policy: Sub-command matches deny pattern');
    }
  }

  for (const re of anchoredAllowPatterns) {
    if (re.test(subCmd)) return true;
  }

  if (testPipelineAllowed(subCmd)) return true;

  // If wrapped in parentheses, strip and recursively check
  let stripped = subCmd;
  let parenMatch;
  while ((parenMatch = /^\s*\((.+)\)\s*$/.exec(stripped))) {
    stripped = parenMatch[1].trim();
  }
  if (stripped !== subCmd) {
    const innerCommands = splitCompoundCommand(stripped);
    if (innerCommands && innerCommands.length > 1) {
      for (const inner of innerCommands) {
        if (!testSubCommandAllowed(inner)) return false;
      }
      return true;
    }
    for (const re of anchoredAllowPatterns) {
      if (re.test(stripped)) return true;
    }
  }

  return false;
}

const subCommands = splitCompoundCommand(command);

if (subCommands && subCommands.length > 1) {
  let allAllowed = true;
  for (const sub of subCommands) {
    if (!testSubCommandAllowed(sub)) {
      allAllowed = false;
      break;
    }
  }
  if (allAllowed) {
    writeAllowAndExit('Auto-approved: all sub-commands match safe patterns');
  }
}

// Third pass: parenthesized commands
if (/^\s*\(/.test(command)) {
  if (testSubCommandAllowed(command)) {
    writeAllowAndExit('Auto-approved: parenthesized command contains safe sub-commands');
  }
}

// No match - fall through
process.exit(0);
