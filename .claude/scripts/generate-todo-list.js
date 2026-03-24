#!/usr/bin/env node
/**
 * generate-todo-list.js
 * Reads workflow-state.json and outputs a TodoWrite-compatible JSON array.
 *
 * Usage:
 *   node .claude/scripts/generate-todo-list.js
 *
 * Output: JSON array of { content, status, activeForm } objects to stdout.
 *
 * The list uses "smart expansion":
 *   - Completed epics → single collapsed item each
 *   - Current epic → expanded with per-story items
 *   - Current story → expanded with sub-phase items (REALIGN, TEST-DESIGN, WRITE-TESTS, IMPLEMENT, QA)
 *   - Future stories in current epic → collapsed into one "Stories N-M: Remaining stories" item
 *   - Future epics → collapsed into one "Epics N-M: Remaining epics" item
 *   - Single remaining epic/story → shown individually by name
 */

const fs = require('fs');
const path = require('path');
const helpers = require('./lib/workflow-helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const STORIES_DIR = path.join(ROOT, 'generated-docs/stories');

// Sub-phase order for per-story TDD cycle (from shared constants)
const STORY_SUB_PHASES = helpers.STORY_PHASES;

// Human-readable labels for sub-phases
const SUB_PHASE_LABELS = {
  'REALIGN': { content: 'Review impacts (REALIGN)', activeForm: 'Reviewing impacts' },
  'TEST-DESIGN': { content: 'Design test scenarios (TEST-DESIGN)', activeForm: 'Designing test scenarios' },
  'WRITE-TESTS': { content: 'Write failing tests (WRITE-TESTS)', activeForm: 'Writing tests' },
  'IMPLEMENT': { content: 'Implement code (no suppressions, tests must pass)', activeForm: 'Implementing code' },
  'QA': { content: 'Code review & QA (all gates must exit 0)', activeForm: 'Reviewing & running QA' }
};

// =============================================================================
// HELPERS
// =============================================================================


function getEpicDisplayName(epicNum) {
  if (!fs.existsSync(STORIES_DIR)) return `Epic ${epicNum}`;
  try {
    const dirs = fs.readdirSync(STORIES_DIR).filter(d => d.match(new RegExp(`^epic-${epicNum}-`)));
    if (dirs.length > 0) {
      return dirs[0].replace(/^epic-\d+-/, '').replace(/-/g, ' ');
    }
  } catch { /* ignore */ }
  return `Epic ${epicNum}`;
}

function getStoryDisplayName(epicNum, storyNum) {
  if (!fs.existsSync(STORIES_DIR)) return `Story ${storyNum}`;
  try {
    const epicDirs = fs.readdirSync(STORIES_DIR).filter(d => d.match(new RegExp(`^epic-${epicNum}`)));
    if (epicDirs.length === 0) return `Story ${storyNum}`;
    const epicDir = path.join(STORIES_DIR, epicDirs[0]);
    const storyFiles = fs.readdirSync(epicDir).filter(f => f.match(new RegExp(`^story-${storyNum}-`)));
    if (storyFiles.length > 0) {
      return storyFiles[0].replace('.md', '').replace(/^story-\d+-/, '').replace(/-/g, ' ');
    }
  } catch { /* ignore */ }
  return `Story ${storyNum}`;
}

/**
 * Determine the status of a sub-phase for the current story.
 * Phase order: REALIGN → TEST-DESIGN → WRITE-TESTS → IMPLEMENT → QA → COMPLETE
 */
function getSubPhaseStatus(subPhase, currentPhase, phaseStatus) {
  const order = [...STORY_SUB_PHASES, 'COMPLETE'];
  const currentIdx = order.indexOf(currentPhase);
  const targetIdx = order.indexOf(subPhase);

  if (targetIdx < 0 || currentIdx < 0) return 'pending';

  if (targetIdx < currentIdx) return 'completed';
  if (targetIdx === currentIdx) {
    return phaseStatus === 'in_progress' ? 'in_progress' : 'pending';
  }
  return 'pending';
}

/**
 * Check if the workflow included an INTAKE phase by looking at history.
 */
function hadIntakePhase(state) {
  if (!state.history) return false;
  return state.history.some(h => h.to === 'INTAKE' || h.from === 'INTAKE');
}

/**
 * Determine INTAKE sub-step completion by checking artifacts on disk.
 * Returns { intakeAgentDone, brdReviewAgentDone }
 */
function getIntakeSubStepStatus() {
  const manifestPath = path.join(ROOT, 'generated-docs/context/intake-manifest.json');
  const frsPath = path.join(ROOT, 'generated-docs/specs/feature-requirements.md');
  return {
    intakeAgentDone: fs.existsSync(manifestPath),
    brdReviewAgentDone: fs.existsSync(frsPath)
  };
}


/**
 * Check if the workflow included a DESIGN phase by looking at history.
 */
function hadDesignPhase(state) {
  if (!state.history) return false;
  return state.history.some(h => h.to === 'DESIGN' || h.from === 'DESIGN');
}

/**
 * Determine if SCOPE is completed based on the current workflow position.
 * SCOPE is complete once we've moved past it (to STORIES or any per-story phase).
 */
function isScopeComplete(state) {
  const pastScopePhases = ['STORIES', ...helpers.STORY_PHASES, 'COMPLETE'];
  if (pastScopePhases.includes(state.currentPhase)) return true;
  // Also check if any epic has moved past SCOPE
  if (state.epics) {
    for (const epic of Object.values(state.epics)) {
      if (epic.phase && !helpers.GLOBAL_PHASES.includes(epic.phase)) return true;
    }
  }
  return false;
}

/**
 * Determine if DESIGN is completed.
 */
function isDesignComplete(state) {
  if (state.currentPhase !== 'DESIGN') {
    // If we had a design phase and are now past it, it's complete
    if (hadDesignPhase(state)) return true;
  }
  return false;
}


/**
 * Determine DESIGN sub-step completion by checking artifacts on disk.
 * Returns { apiSpecDone, designTokensCssDone, designTokensMdDone, wireframesDone }
 */
function getDesignSubStepStatus() {
  return {
    apiSpecDone: fs.existsSync(path.join(ROOT, 'generated-docs/specs/api-spec.yaml')),
    designTokensCssDone: fs.existsSync(path.join(ROOT, 'generated-docs/specs/design-tokens.css')),
    designTokensMdDone: fs.existsSync(path.join(ROOT, 'generated-docs/specs/design-tokens.md')),
    wireframesDone: (() => {
      try {
        return fs.readdirSync(path.join(ROOT, 'generated-docs/specs/wireframes')).some(f => f.endsWith('.md'));
      } catch {
        return false;
      }
    })()
  };
}

/**
 * Determine which DESIGN sub-steps are needed based on the manifest.
 * Returns array of { key, label, activeForm, done } objects.
 */
function getDesignExpectedSteps(manifest, status) {
  const steps = [];
  if (!manifest || !manifest.artifacts) return steps;
  const arts = manifest.artifacts;

  if (arts.apiSpec && (arts.apiSpec.generate || arts.apiSpec.userProvided)) {
    steps.push({
      key: 'apiSpec',
      label: 'Generate API spec (design-api-agent)',
      activeForm: 'Generating API spec',
      done: status.apiSpecDone
    });
  }

  // designTokensCss and designTokensMd both map to design-style-agent — show as one step
  const needsCss = arts.designTokensCss && (arts.designTokensCss.generate || arts.designTokensCss.userProvided);
  const needsMd = arts.designTokensMd && (arts.designTokensMd.generate || arts.designTokensMd.userProvided);
  if (needsCss || needsMd) {
    const tokensDone = (!needsCss || status.designTokensCssDone) && (!needsMd || status.designTokensMdDone);
    steps.push({
      key: 'designTokens',
      label: 'Generate design tokens (design-style-agent)',
      activeForm: 'Generating design tokens',
      done: tokensDone
    });
  }

  if (arts.wireframes && (arts.wireframes.generate || arts.wireframes.userProvided)) {
    steps.push({
      key: 'wireframes',
      label: 'Generate wireframes (design-wireframe-agent)',
      activeForm: 'Generating wireframes',
      done: status.wireframesDone
    });
  }

  return steps;
}

/**
 * Get the total number of epics (known or estimated).
 */
function getTotalEpics(state) {
  if (state.totalEpics) return state.totalEpics;
  if (state.epics) return Math.max(...Object.keys(state.epics).map(Number), 0);
  return 0;
}

/**
 * Get total stories for an epic.
 */
function getTotalStories(epicState, epicNum) {
  if (!epicState) return 0;
  if (epicState.totalStories) return epicState.totalStories;
  // Count story files on disk to avoid undercounting unstarted stories
  if (epicNum) {
    const epicDir = path.join(STORIES_DIR, epicState.name || `epic-${epicNum}`);
    if (fs.existsSync(epicDir)) {
      const count = fs.readdirSync(epicDir).filter(f => f.startsWith('story-') && f.endsWith('.md')).length;
      if (count > 0) return count;
    }
  }
  if (epicState.stories) return Object.keys(epicState.stories).length;
  return 0;
}

/**
 * Check if an epic is fully complete.
 */
function isEpicComplete(epicState, epicNum) {
  if (!epicState) return false;
  if (epicState.phase === 'COMPLETE') return true;
  // Check if all stories are complete
  const totalStories = getTotalStories(epicState, epicNum);
  if (totalStories === 0) return false;
  const completedStories = Object.values(epicState.stories || {})
    .filter(s => s.phase === 'COMPLETE').length;
  return completedStories >= totalStories;
}

// =============================================================================
// MAIN LIST BUILDER
// =============================================================================

function buildTodoList(state) {
  const items = [];

  // --- INTAKE phase (only if workflow included it) ---
  if (hadIntakePhase(state)) {
    const { intakeAgentDone, brdReviewAgentDone } = getIntakeSubStepStatus();
    const intakeComplete = intakeAgentDone && brdReviewAgentDone;
    const isIntakeActive = state.currentPhase === 'INTAKE';

    if (intakeComplete) {
      // Collapsed: single completed item
      items.push({
        content: 'Gather requirements (INTAKE)',
        status: 'completed',
        activeForm: 'Gathering requirements'
      });
    } else {
      // Expanded: show sub-steps
      // intake-agent sub-step
      const intakeAgentStatus = intakeAgentDone ? 'completed' :
        (isIntakeActive && !intakeAgentDone ?
          (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending') : 'pending');
      items.push({
        content: 'Scan docs & gather basics (intake-agent)',
        status: intakeAgentStatus,
        activeForm: 'Scanning docs & gathering basics'
      });

      // brd-review-agent sub-step
      const brdReviewStatus = brdReviewAgentDone ? 'completed' :
        (isIntakeActive && intakeAgentDone ?
          (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending') : 'pending');
      items.push({
        content: 'Review completeness & produce FRS (brd-review-agent)',
        status: brdReviewStatus,
        activeForm: 'Reviewing requirements & producing FRS'
      });
    }
  }

  // --- DESIGN phase (only if workflow included it) ---
  if (hadDesignPhase(state)) {
    const designComplete = isDesignComplete(state);
    const isDesignActive = state.currentPhase === 'DESIGN';
    const manifest = helpers.readIntakeManifest();
    const designStatus = getDesignSubStepStatus();
    const expectedSteps = getDesignExpectedSteps(manifest, designStatus);

    if (designComplete) {
      // Collapsed: single completed item
      items.push({
        content: 'Generate design artifacts (DESIGN)',
        status: 'completed',
        activeForm: 'Generating design artifacts'
      });
    } else if (expectedSteps.length > 0) {
      // Expanded: show sub-steps based on manifest
      for (let i = 0; i < expectedSteps.length; i++) {
        const step = expectedSteps[i];
        let stepStatus;
        if (step.done) {
          stepStatus = 'completed';
        } else if (isDesignActive) {
          // The first incomplete step is the active one
          const isFirstIncomplete = expectedSteps.slice(0, i).every(s => s.done);
          stepStatus = isFirstIncomplete
            ? (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending')
            : 'pending';
        } else {
          stepStatus = 'pending';
        }
        items.push({
          content: step.label,
          status: stepStatus,
          activeForm: step.activeForm
        });
      }
    } else {
      // No manifest — fallback to single generic item
      items.push({
        content: 'Generate design artifacts (DESIGN)',
        status: isDesignActive
          ? (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending')
          : 'pending',
        activeForm: 'Generating design artifacts'
      });
    }
  }

  // --- SCOPE phase ---
  const scopeComplete = isScopeComplete(state);
  const isScopeActive = state.currentPhase === 'SCOPE';
  const totalEpics = getTotalEpics(state);
  const scopeSuffix = scopeComplete && totalEpics > 0 ? ` (${totalEpics} epic${totalEpics !== 1 ? 's' : ''})` : '';

  items.push({
    content: `Define epics (SCOPE)${scopeSuffix}`,
    status: scopeComplete ? 'completed' : (isScopeActive ?
      (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending') : 'pending'),
    activeForm: 'Defining epics'
  });

  // If still in a global phase (INTAKE, DESIGN, SCOPE), no epic items to show yet
  if (helpers.GLOBAL_PHASES.includes(state.currentPhase) && !scopeComplete) {
    return items;
  }

  // --- PER-EPIC ITEMS ---
  // First pass: separate completed, current, and future epics
  const futureEpics = [];

  for (let e = 1; e <= totalEpics; e++) {
    const epicState = state.epics?.[e];
    const isCurrentEpic = (e === state.currentEpic) && !state.featureComplete;
    const epicName = getEpicDisplayName(e);
    const epicComplete = isEpicComplete(epicState, e);

    if (epicComplete && !isCurrentEpic) {
      // COLLAPSED: completed epic
      const totalStories = getTotalStories(epicState, e);
      const storySuffix = totalStories > 0 ? ` - ${totalStories} stories` : '';
      items.push({
        content: `Epic ${e}: ${epicName} (complete${storySuffix})`,
        status: 'completed',
        activeForm: `Completing Epic ${e}`
      });
      continue;
    }

    if (!isCurrentEpic) {
      // Collect future epics to collapse into a single item
      futureEpics.push(e);
      continue;
    }

    // EXPANDED: current epic
    // --- STORIES phase item for this epic ---
    const storiesPhaseComplete = epicState && epicState.phase !== 'STORIES' &&
      getTotalStories(epicState, e) > 0;
    const isStoriesActive = state.currentPhase === 'STORIES' && isCurrentEpic;
    const totalStories = getTotalStories(epicState, e);
    const storiesSuffix = storiesPhaseComplete && totalStories > 0 ?
      ` (${totalStories} stor${totalStories !== 1 ? 'ies' : 'y'})` : '';

    items.push({
      content: `Epic ${e}: Define stories (STORIES)${storiesSuffix}`,
      status: storiesPhaseComplete ? 'completed' : (isStoriesActive ?
        (state.phaseStatus === 'in_progress' ? 'in_progress' : 'pending') : 'pending'),
      activeForm: `Defining stories for Epic ${e}`
    });

    // If still in STORIES phase for this epic, don't show story items yet
    if (isStoriesActive || (!storiesPhaseComplete && !isStoriesActive)) {
      continue;
    }

    // --- PER-STORY ITEMS for current epic ---
    const futureStories = [];

    for (let s = 1; s <= totalStories; s++) {
      const storyState = epicState?.stories?.[s];
      const isCurrentStory = isCurrentEpic && s === state.currentStory;
      const storyName = getStoryDisplayName(e, s);
      const storyComplete = storyState?.phase === 'COMPLETE';

      if (storyComplete) {
        // Completed story - single collapsed item
        items.push({
          content: `  Story ${s}: ${storyName} (complete)`,
          status: 'completed',
          activeForm: `Completing Story ${s}`
        });
        continue;
      }

      if (!isCurrentStory) {
        // Collect future stories to collapse into a single item
        futureStories.push(s);
        continue;
      }

      // EXPANDED: current story - show sub-phase items
      for (const sp of STORY_SUB_PHASES) {
        const labels = SUB_PHASE_LABELS[sp];
        const spStatus = getSubPhaseStatus(sp, state.currentPhase, state.phaseStatus);

        items.push({
          content: `  Story ${s}: ${labels.content}`,
          status: spStatus,
          activeForm: `${labels.activeForm} for Story ${s}`
        });
      }
    }

    // COLLAPSED: remaining stories in current epic
    if (futureStories.length === 1) {
      const s = futureStories[0];
      const storyName = getStoryDisplayName(e, s);
      items.push({
        content: `  Story ${s}: ${storyName}`,
        status: 'pending',
        activeForm: `Working on Story ${s}`
      });
    } else if (futureStories.length > 1) {
      const first = futureStories[0];
      const last = futureStories[futureStories.length - 1];
      items.push({
        content: `  Stories ${first}-${last}: Remaining stories`,
        status: 'pending',
        activeForm: `Working on remaining stories`
      });
    }
  }

  // COLLAPSED: remaining epics (future, not completed, not current)
  if (futureEpics.length === 1) {
    const e = futureEpics[0];
    const epicName = getEpicDisplayName(e);
    items.push({
      content: `Epic ${e}: ${epicName}`,
      status: 'pending',
      activeForm: `Working on Epic ${e}`
    });
  } else if (futureEpics.length > 1) {
    const first = futureEpics[0];
    const last = futureEpics[futureEpics.length - 1];
    items.push({
      content: `Epics ${first}-${last}: Remaining epics`,
      status: 'pending',
      activeForm: `Working on remaining epics`
    });
  }

  return items;
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const state = helpers.readWorkflowState();

  if (!state) {
    console.log(JSON.stringify([
      { content: 'Start workflow with /start', status: 'pending', activeForm: 'Starting workflow' }
    ]));
    return;
  }

  // Handle feature complete
  if (state.featureComplete || state.phaseStatus === 'complete') {
    const items = buildTodoList(state);
    // Ensure all items show as completed
    const completedItems = items.map(item => ({ ...item, status: 'completed' }));
    console.log(JSON.stringify(completedItems));
    return;
  }

  const items = buildTodoList(state);
  console.log(JSON.stringify(items));
}

main();
