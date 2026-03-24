#!/usr/bin/env node

/**
 * Progress Index Generator
 *
 * Scans generated-docs/stories/ and generates a PROGRESS.md file
 * with a high-level view of feature progress.
 *
 * Triggered automatically via Claude Code PostToolUse hook when
 * files in generated-docs/stories/ are written or edited.
 *
 * Status detection:
 * - Complete: All acceptance test checkboxes checked
 * - In Progress: At least one checkbox checked, but not all
 * - Planned: No checkboxes checked
 */

const fs = require('fs');
const path = require('path');

// Status indicators
const STATUS = {
  COMPLETE: { label: 'Complete', icon: '\u2705' },
  IN_PROGRESS: { label: 'In Progress', icon: '\uD83D\uDD04' },
  PLANNED: { label: 'Planned', icon: '\u23F3' },
};

/**
 * Read and parse JSON input from stdin (hook input)
 * @returns {Promise<object|null>} Parsed hook input or null if not available
 */
function readStdinInput() {
  return new Promise((resolve) => {
    let inputData = '';

    // Set a short timeout - if no data, we're likely running manually
    const timeout = setTimeout(() => {
      resolve(null);
    }, 100);

    process.stdin.on('data', (chunk) => {
      clearTimeout(timeout);
      inputData += chunk;
    });

    process.stdin.on('end', () => {
      clearTimeout(timeout);
      if (!inputData.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(inputData));
      } catch {
        resolve(null);
      }
    });

    // Handle case where stdin is not being piped
    if (process.stdin.isTTY) {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

/**
 * Check if a file path is within the stories directory
 * @param {string} filePath - The file path to check
 * @returns {boolean}
 */
function isStoriesPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('generated-docs/stories/');
}

/**
 * Main function
 */
async function main() {
  try {
    // Read hook input from stdin
    const hookInput = await readStdinInput();

    // If we have hook input, check if the file is in stories directory
    if (hookInput && hookInput.tool_input) {
      const filePath = hookInput.tool_input.file_path;
      if (!isStoriesPath(filePath)) {
        // Not a stories file, exit silently
        process.exit(0);
      }
    }

    // Find project root (look for package.json or .git)
    const projectRoot = findProjectRoot();
    if (!projectRoot) {
      console.error('Could not find project root');
      process.exit(0); // Exit gracefully, don't block Claude
    }

    const storiesDir = path.join(projectRoot, 'generated-docs', 'stories');
    const generatedDocsDir = path.join(projectRoot, 'generated-docs');

    // Check if stories directory exists
    if (!fs.existsSync(storiesDir)) {
      // No stories yet, exit gracefully
      process.exit(0);
    }

    // Parse feature overview
    const featureData = parseFeatureOverview(storiesDir);
    if (!featureData) {
      // No feature overview yet, exit gracefully
      process.exit(0);
    }

    // Scan epic directories
    const epicDirs = scanEpicDirectories(storiesDir);

    // Process each epic and its stories
    const processedEpics = [];
    for (const epicDirName of epicDirs) {
      const epicDir = path.join(storiesDir, epicDirName);
      const epicData = parseEpicOverview(epicDir);

      if (!epicData) {
        continue;
      }

      // Process each story in the epic
      const storyStatuses = [];
      for (const story of epicData.stories) {
        const storyPath = path.join(epicDir, story.file);
        const checkboxes = parseStoryCheckboxes(storyPath);
        const status = calculateStatus(checkboxes);

        storyStatuses.push({
          ...story,
          checkboxes,
          status,
        });
      }

      // Calculate epic status
      const epicStatus = calculateEpicStatus(storyStatuses);

      processedEpics.push({
        ...epicData,
        directory: epicDirName,
        stories: storyStatuses,
        status: epicStatus,
        storyCount: storyStatuses.length,
        completedCount: storyStatuses.filter(
          (s) => s.status.label === STATUS.COMPLETE.label
        ).length,
      });
    }

    // Calculate feature status
    const featureStatus = calculateFeatureStatus(processedEpics);

    // Build feature summary
    const feature = {
      ...featureData,
      epics: processedEpics,
      status: featureStatus,
      epicCount: processedEpics.length,
      storyCount: processedEpics.reduce((sum, e) => sum + e.storyCount, 0),
      completedCount: processedEpics.reduce(
        (sum, e) => sum + e.completedCount,
        0
      ),
    };

    // Generate PROGRESS.md content
    const progressContent = generateProgressMarkdown(feature);

    // Write PROGRESS.md
    const progressPath = path.join(generatedDocsDir, 'PROGRESS.md');
    fs.writeFileSync(progressPath, progressContent, 'utf-8');

    process.exit(0);
  } catch (error) {
    console.error('Error generating progress index:', error.message);
    process.exit(0); // Exit gracefully, don't block Claude
  }
}

/**
 * Generate the full PROGRESS.md markdown content
 * @param {object} feature - Processed feature data with epics and stories
 * @returns {string} Full markdown content
 */
function generateProgressMarkdown(feature) {
  const sections = [
    '# Project Progress Index',
    '',
    '*Auto-generated. Do not edit manually.*',
    '',
    '## Features Overview',
    '',
    generateFeaturesOverviewTable([feature]),
    '',
    '---',
    '',
    generateEpicBreakdownTable(feature),
  ];

  // Add story details for in-progress epics
  const inProgressEpics = feature.epics.filter(
    (e) => e.status.label === STATUS.IN_PROGRESS.label
  );

  if (inProgressEpics.length > 0) {
    sections.push('', '---', '');
    for (const epic of inProgressEpics) {
      sections.push(generateStoryDetailsTable(epic), '');
    }
  }

  return sections.join('\n');
}

/**
 * Parse _feature-overview.md to extract feature name and epic list
 * @param {string} storiesDir - Path to the stories directory
 * @returns {object|null} Feature data with name, summary, and epics array
 *
 * Expected format:
 * # Feature: [Feature Name]
 * ## Summary
 * [Brief description]
 * ## Epics
 * 1. **Epic 1: [Name]** - [Description]
 *    - Status: Pending
 *    - Directory: `epic-1-[slug]/`
 */
function parseFeatureOverview(storiesDir) {
  const overviewPath = path.join(storiesDir, '_feature-overview.md');

  if (!fs.existsSync(overviewPath)) {
    return null;
  }

  const content = fs.readFileSync(overviewPath, 'utf-8');
  const lines = content.split('\n');

  const feature = {
    name: '',
    summary: '',
    epics: [],
  };

  let inSummary = false;
  let inEpics = false;
  let currentEpic = null;

  for (const line of lines) {
    // Parse feature name: # Feature: [Name]
    const featureMatch = line.match(/^#\s+Feature:\s*(.+)$/i);
    if (featureMatch) {
      feature.name = featureMatch[1].trim();
      continue;
    }

    // Track sections
    if (line.match(/^##\s+Summary/i)) {
      inSummary = true;
      inEpics = false;
      continue;
    }
    if (line.match(/^##\s+Epics/i)) {
      inSummary = false;
      inEpics = true;
      continue;
    }
    if (line.match(/^##\s+/)) {
      inSummary = false;
      inEpics = false;
      continue;
    }

    // Parse summary (first non-empty line after ## Summary)
    if (inSummary && !feature.summary && line.trim()) {
      feature.summary = line.trim();
      continue;
    }

    // Parse epics: 1. **Epic 1: [Name]** - [Description]
    if (inEpics) {
      const epicMatch = line.match(
        /^\d+\.\s+\*\*Epic\s+\d+:\s*([^*]+)\*\*\s*-?\s*(.*)$/i
      );
      if (epicMatch) {
        currentEpic = {
          name: epicMatch[1].trim(),
          description: epicMatch[2].trim(),
          directory: '',
          status: 'Pending',
        };
        feature.epics.push(currentEpic);
        continue;
      }

      // Parse epic directory: - Directory: `epic-1-[slug]/`
      if (currentEpic) {
        const dirMatch = line.match(/^\s*-\s*Directory:\s*`([^`]+)`/i);
        if (dirMatch) {
          currentEpic.directory = dirMatch[1].replace(/\/$/, ''); // Remove trailing slash
          continue;
        }

        // Parse epic status: - Status: Pending
        const statusMatch = line.match(/^\s*-\s*Status:\s*(.+)$/i);
        if (statusMatch) {
          currentEpic.status = statusMatch[1].trim();
          continue;
        }
      }
    }
  }

  return feature.name ? feature : null;
}

/**
 * Parse _epic-overview.md to extract epic name and story list
 * @param {string} epicDir - Full path to the epic directory
 * @returns {object|null} Epic data with name, description, and stories array
 *
 * Expected format:
 * # Epic 1: [Name]
 * ## Description
 * [Detailed description]
 * ## Stories
 * 1. **[Story title]** - [Description]
 *    - File: `story-1-[slug].md`
 *    - Status: Pending
 */
function parseEpicOverview(epicDir) {
  const overviewPath = path.join(epicDir, '_epic-overview.md');

  if (!fs.existsSync(overviewPath)) {
    return null;
  }

  const content = fs.readFileSync(overviewPath, 'utf-8');
  const lines = content.split('\n');

  const epic = {
    name: '',
    description: '',
    stories: [],
  };

  let inDescription = false;
  let inStories = false;
  let currentStory = null;

  for (const line of lines) {
    // Parse epic name: # Epic 1: [Name]
    const epicMatch = line.match(/^#\s+Epic\s+\d+:\s*(.+)$/i);
    if (epicMatch) {
      epic.name = epicMatch[1].trim();
      continue;
    }

    // Track sections
    if (line.match(/^##\s+Description/i)) {
      inDescription = true;
      inStories = false;
      continue;
    }
    if (line.match(/^##\s+Stories/i)) {
      inDescription = false;
      inStories = true;
      continue;
    }
    if (line.match(/^##\s+/)) {
      inDescription = false;
      inStories = false;
      continue;
    }

    // Parse description (first non-empty line after ## Description)
    if (inDescription && !epic.description && line.trim()) {
      epic.description = line.trim();
      continue;
    }

    // Parse stories: 1. **[Story title]** - [Description]
    if (inStories) {
      const storyMatch = line.match(/^\d+\.\s+\*\*([^*]+)\*\*\s*-?\s*(.*)$/);
      if (storyMatch) {
        currentStory = {
          title: storyMatch[1].trim(),
          description: storyMatch[2].trim(),
          file: '',
          status: 'Pending',
        };
        epic.stories.push(currentStory);
        continue;
      }

      // Parse story file: - File: `story-1-[slug].md`
      if (currentStory) {
        const fileMatch = line.match(/^\s*-\s*File:\s*`([^`]+)`/i);
        if (fileMatch) {
          currentStory.file = fileMatch[1];
          continue;
        }

        // Parse story status: - Status: Pending
        const statusMatch = line.match(/^\s*-\s*Status:\s*(.+)$/i);
        if (statusMatch) {
          currentStory.status = statusMatch[1].trim();
          continue;
        }
      }
    }
  }

  return epic.name ? epic : null;
}

/**
 * Parse a story file to count checkbox status in Acceptance Tests section
 * @param {string} storyPath - Full path to the story file
 * @returns {object} Checkbox counts { checked: number, unchecked: number, total: number }
 *
 * Looks for checkboxes in ## Acceptance Tests section:
 * - [ ] unchecked
 * - [x] checked
 */
function parseStoryCheckboxes(storyPath) {
  const result = {
    checked: 0,
    unchecked: 0,
    total: 0,
  };

  if (!fs.existsSync(storyPath)) {
    return result;
  }

  const content = fs.readFileSync(storyPath, 'utf-8');
  const lines = content.split('\n');

  let inAcceptanceTests = false;

  for (const line of lines) {
    // Track when we enter Acceptance Tests section
    if (line.match(/^##\s+Acceptance Tests/i)) {
      inAcceptanceTests = true;
      continue;
    }

    // Exit when we hit another ## section
    if (inAcceptanceTests && line.match(/^##\s+/)) {
      inAcceptanceTests = false;
      continue;
    }

    // Count checkboxes in Acceptance Tests section
    if (inAcceptanceTests) {
      // Match checked checkbox: - [x] or - [X]
      if (line.match(/^\s*-\s*\[x\]/i)) {
        result.checked++;
        result.total++;
        continue;
      }

      // Match unchecked checkbox: - [ ]
      if (line.match(/^\s*-\s*\[\s*\]/)) {
        result.unchecked++;
        result.total++;
        continue;
      }
    }
  }

  return result;
}

/**
 * Calculate status based on checkbox counts
 * @param {object} checkboxes - Checkbox counts { checked, unchecked, total }
 * @returns {object} Status object from STATUS constant
 *
 * Logic:
 * - Complete: All checkboxes checked (checked > 0 && unchecked === 0)
 * - In Progress: Some checkboxes checked (checked > 0 && unchecked > 0)
 * - Planned: No checkboxes checked (checked === 0)
 */
function calculateStatus(checkboxes) {
  const { checked, unchecked } = checkboxes;

  if (checked > 0 && unchecked === 0) {
    return STATUS.COMPLETE;
  }
  if (checked > 0 && unchecked > 0) {
    return STATUS.IN_PROGRESS;
  }
  return STATUS.PLANNED;
}

/**
 * Calculate aggregate status for an epic based on its stories
 * @param {object[]} storyStatuses - Array of { status, checkboxes } for each story
 * @returns {object} Aggregate status object from STATUS constant
 *
 * Logic:
 * - Complete: All stories are complete
 * - In Progress: At least one story has progress (checked > 0)
 * - Planned: No stories have any progress
 */
function calculateEpicStatus(storyStatuses) {
  if (storyStatuses.length === 0) {
    return STATUS.PLANNED;
  }

  const allComplete = storyStatuses.every(
    (s) => s.status.label === STATUS.COMPLETE.label
  );
  if (allComplete) {
    return STATUS.COMPLETE;
  }

  const anyProgress = storyStatuses.some((s) => s.checkboxes.checked > 0);
  if (anyProgress) {
    return STATUS.IN_PROGRESS;
  }

  return STATUS.PLANNED;
}

/**
 * Calculate aggregate status for a feature based on its epics
 * @param {object[]} epicStatuses - Array of epic status objects
 * @returns {object} Aggregate status object from STATUS constant
 */
function calculateFeatureStatus(epicStatuses) {
  if (epicStatuses.length === 0) {
    return STATUS.PLANNED;
  }

  const allComplete = epicStatuses.every(
    (e) => e.status.label === STATUS.COMPLETE.label
  );
  if (allComplete) {
    return STATUS.COMPLETE;
  }

  const anyProgress = epicStatuses.some(
    (e) =>
      e.status.label === STATUS.IN_PROGRESS.label ||
      e.status.label === STATUS.COMPLETE.label
  );
  if (anyProgress) {
    return STATUS.IN_PROGRESS;
  }

  return STATUS.PLANNED;
}

/**
 * Generate markdown table for Features Overview section
 * @param {object[]} features - Array of feature data with computed stats
 * @returns {string} Markdown table string
 *
 * Output format:
 * | Feature | Epics | Stories | Completed | Status |
 * |---------|-------|---------|-----------|--------|
 * | User Auth | 4 | 12 | 8 | In Progress |
 */
function generateFeaturesOverviewTable(features) {
  const lines = [
    '| Feature | Epics | Stories | Completed | Status |',
    '|---------|-------|---------|-----------|--------|',
  ];

  for (const feature of features) {
    const statusText = `${feature.status.icon} ${feature.status.label}`;
    lines.push(
      `| ${feature.name} | ${feature.epicCount} | ${feature.storyCount} | ${feature.completedCount} | ${statusText} |`
    );
  }

  return lines.join('\n');
}

/**
 * Generate markdown table for per-feature Epic breakdown
 * @param {object} feature - Feature data with epics array
 * @returns {string} Markdown section string
 *
 * Output format:
 * ## Feature Name
 * > Source: [feature-overview.md](stories/_feature-overview.md)
 *
 * | Epic | Stories | Completed | Status |
 * |------|---------|-----------|--------|
 * | Basic Auth | 4 | 4 | Complete |
 */
function generateEpicBreakdownTable(feature) {
  const lines = [
    `## ${feature.name}`,
    '',
    `> [Feature Overview](stories/_feature-overview.md)`,
    '',
    '| Epic | Stories | Completed | Status |',
    '|------|---------|-----------|--------|',
  ];

  for (const epic of feature.epics) {
    const statusText = `${epic.status.icon} ${epic.status.label}`;
    const epicLink = epic.directory
      ? `[${epic.name}](stories/${epic.directory}/_epic-overview.md)`
      : epic.name;
    lines.push(
      `| ${epicLink} | ${epic.storyCount} | ${epic.completedCount} | ${statusText} |`
    );
  }

  return lines.join('\n');
}

/**
 * Generate markdown table for in-progress epic story details
 * Only shows stories for epics that are currently in progress
 * @param {object} epic - Epic data with stories array
 * @returns {string} Markdown section string
 *
 * Output format:
 * ### Epic Name (In Progress)
 * | Story | Status |
 * |-------|--------|
 * | [Story title](stories/epic-1/story-1.md) | Complete |
 */
function generateStoryDetailsTable(epic) {
  const lines = [
    `### ${epic.name} (${epic.status.label})`,
    '',
    '| Story | Status |',
    '|-------|--------|',
  ];

  for (const story of epic.stories) {
    const statusText = `${story.status.icon} ${story.status.label}`;
    const storyLink = story.file
      ? `[${story.title}](stories/${epic.directory}/${story.file})`
      : story.title;
    lines.push(`| ${storyLink} | ${statusText} |`);
  }

  return lines.join('\n');
}

/**
 * Scan for epic directories in the stories folder
 * @param {string} storiesDir - Path to the stories directory
 * @returns {string[]} Array of epic directory names (e.g., ['epic-1-auth', 'epic-2-dashboard'])
 */
function scanEpicDirectories(storiesDir) {
  const entries = fs.readdirSync(storiesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('epic-'))
    .map((entry) => entry.name)
    .sort((a, b) => {
      // Sort by epic number (epic-1-xxx before epic-2-xxx)
      const numA = parseInt(a.match(/epic-(\d+)/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/epic-(\d+)/)?.[1] || '0', 10);
      return numA - numB;
    });
}

/**
 * Find the project root directory
 * @returns {string|null}
 */
function findProjectRoot() {
  let dir = process.env.CLAUDE_PROJECT_DIR;
  if (dir && fs.existsSync(dir)) {
    return dir;
  }

  // Fallback: walk up from current directory
  dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) ||
      fs.existsSync(path.join(dir, '.git'))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Run main function
main();
