#!/usr/bin/env node
/**
 * generate-dashboard-html.js
 *
 * Reads JSON from collect-dashboard-data.js and produces a self-contained HTML
 * dashboard file. The HTML includes a <meta http-equiv="refresh"> tag so the
 * browser auto-reloads from disk, picking up new data each time the file is
 * regenerated.
 *
 * Usage:
 *   node .claude/scripts/collect-dashboard-data.js --format=json | node .claude/scripts/generate-dashboard-html.js
 *   node .claude/scripts/generate-dashboard-html.js < data.json
 *   node .claude/scripts/generate-dashboard-html.js --output generated-docs/dashboard.html < data.json
 *
 * Or combined:
 *   node .claude/scripts/generate-dashboard-html.js --collect
 *   (runs collect-dashboard-data.js internally)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- CLI args ---
const args = process.argv.slice(2);
const collectFlag = args.includes('--collect');
let outputPath = 'generated-docs/dashboard.html';
const outputIdx = args.indexOf('--output');
if (outputIdx !== -1 && args[outputIdx + 1]) {
  outputPath = args[outputIdx + 1];
}

// --- Get data ---
let data;
if (collectFlag) {
  try {
    const raw = execSync('node .claude/scripts/collect-dashboard-data.js --format=json', {
      encoding: 'utf-8',
      cwd: process.cwd()
    });
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to collect dashboard data:', e.message);
    process.exit(1);
  }
} else {
  let input = '';
  const fd = fs.openSync('/dev/stdin', 'r');
  const buf = Buffer.alloc(65536);
  let n;
  while ((n = fs.readSync(fd, buf)) > 0) {
    input += buf.toString('utf-8', 0, n);
  }
  fs.closeSync(fd);
  if (!input.trim()) {
    console.error('No input. Use --collect or pipe JSON from collect-dashboard-data.js');
    process.exit(1);
  }
  data = JSON.parse(input.trim());
}

// --- Helpers ---
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timestamp() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

const { friendlyName, GLOBAL_PHASES, STORY_PHASES, AGENT_DISPLAY_NAMES } = require('./lib/workflow-helpers');

function phaseTagClass(phase) {
  const map = {
    'COMPLETE': 'tag-green', 'QA': 'tag-teal', 'IMPLEMENT': 'tag-primary',
    'WRITE-TESTS': 'tag-yellow', 'TEST-DESIGN': 'tag-secondary', 'STORIES': 'tag-primary', 'REALIGN': 'tag-peach',
    'PENDING': 'tag-gray', 'DESIGN': 'tag-primary', 'INTAKE': 'tag-secondary',
    'SCOPE': 'tag-teal'
  };
  return map[phase] || 'tag-gray';
}

// --- Build sections ---
const w = data.workflow || {};
const currentPhase = w.currentPhase || 'NONE';
const featureNameRaw = w.featureName || 'Untitled Feature';
const featureSlug = featureNameRaw.replace(/[^a-zA-Z0-9-]/g, '_');
// Friendly display name: replace hyphens/underscores with spaces, title-case first word
const featureName = (() => {
  const words = featureNameRaw.replace(/[-_]+/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return featureNameRaw;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
})();

// Phase groupings
const phaseOrder = ['INTAKE', 'DESIGN', 'SCOPE', 'STORIES', 'REALIGN', 'TEST-DESIGN', 'WRITE-TESTS', 'IMPLEMENT', 'QA'];
const currentIdx = phaseOrder.indexOf(currentPhase);
const tier1Phases = GLOBAL_PHASES;
const tier3Phases = STORY_PHASES;
// Check if any story has traceability data (for test-coverage section visibility)
const hasAnyTraceability = (data.epics || []).some(e =>
  (e.stories || []).some(s => s.traceability && s.traceability.criteria.length > 0)
);

// Current epic/story info
const totalEpics = data.epics?.length || 0;
const currentEpic = data.epics?.find(e => e.number === w.currentEpic);
const currentEpicName = friendlyName(currentEpic?.name, 'epic') || (w.currentEpic ? `Epic ${w.currentEpic}` : '');
const currentStoryObj = currentEpic?.stories?.find(s => s.number === w.currentStory);
const currentStoryName = friendlyName(currentStoryObj?.name, 'story') || (w.currentStory ? `Story ${w.currentStory}` : '');
const totalStories = currentEpic?.totalStories || currentEpic?.stories?.length || 0;
const completedStoriesInEpic = (currentEpic?.stories || []).filter(s => s.phase === 'COMPLETE').length;

function stepHTML(phase) {
  let cls = 'step';
  if (w.featureComplete) {
    cls += ' done';
  } else if (phase === currentPhase) {
    cls += ' active';
  } else {
    const pIdx = phaseOrder.indexOf(phase);
    if (pIdx >= 0 && pIdx < currentIdx) {
      cls += ' done';
    }
  }
  return `<div class="${cls}">${esc(phase)}</div>`;
}

function pipelineHTML() {
  // Tier 1: Project Setup
  const tier1Done = w.featureComplete || currentIdx > phaseOrder.indexOf('SCOPE');
  const tier1Class = tier1Done && !tier1Phases.includes(currentPhase) ? ' tier-done' : '';
  const tier1Annotation = tier1Done ? '' : '<span class="tier-note">(run once)</span>';
  const tier1Steps = tier1Phases.map((p, i) => {
    const arrow = i < tier1Phases.length - 1 ? '<span class="arrow">&#8250;</span>' : '';
    return stepHTML(p) + arrow;
  }).join('');

  // Tier 2: Per Epic
  const tier2Done = w.featureComplete;
  const tier2Class = tier2Done ? ' tier-done' : '';
  const storiesStep = (() => {
    let cls = 'step';
    if (w.featureComplete) cls += ' done';
    else if (currentPhase === 'STORIES') cls += ' active';
    else if (currentIdx > phaseOrder.indexOf('STORIES')) cls += ' done';
    return `<div class="${cls}">STORIES</div>`;
  })();

  let tier2Annotation = '';
  if (w.currentEpic) {
    const epicPct = totalStories > 0 ? Math.round(completedStoriesInEpic / totalStories * 100) : 0;
    const epicLabel = currentEpicName.replace(/^Epic \d+:\s*/, '');
    tier2Annotation = `<span class="tier-info">Epic ${w.currentEpic} of ${totalEpics}: ${esc(epicLabel)}</span>
      <div class="tier-progress"><div class="progress-bar" style="width:80px"><div class="fill ${tier2Done ? 'green' : 'primary'}" style="width:${epicPct}%"></div></div><span class="label-sub">${completedStoriesInEpic}/${totalStories}</span></div>`;
  }

  // Tier 3: Per Story
  const tier3Class = w.featureComplete ? ' tier-done' : '';
  const tier3Steps = tier3Phases.map((p, i) => {
    let s = '';
    if (p === 'REALIGN' && currentPhase === 'REALIGN' && data.discoveredImpacts?.impactCount > 0) {
      s = stepHTML(p) + `<span class="impact-badge">${data.discoveredImpacts.impactCount}</span>`;
    } else {
      s = stepHTML(p);
    }
    const arrow = i < tier3Phases.length - 1 ? '<span class="arrow">&#8250;</span>' : '';
    return s + arrow;
  }).join('');

  let tier3Annotation = '';
  if (w.currentStory && w.currentEpic) {
    const storyLabel = currentStoryName.replace(/^Story \d+:\s*/, '');
    tier3Annotation = `<span class="tier-info">Story ${w.currentStory} of ${totalStories}: ${esc(storyLabel)}</span>`;
  } else if (w.currentEpic && !w.currentStory) {
    tier3Annotation = `<span class="tier-info" style="color:var(--sub);font-style:italic">Awaiting story definitions</span>`;
  }

  return `
    <div class="tier${tier1Class}">
      <span class="tier-label">Project Setup</span>
      <div class="tier-steps"><div class="pipeline">${tier1Steps}</div></div>
      <div class="tier-right">${tier1Annotation}</div>
    </div>
    <div class="tier${tier2Class}">
      <span class="tier-label"><span class="loop-icon">&#8635;</span> Per Epic</span>
      <div class="tier-steps"><div class="pipeline">${storiesStep}</div></div>
      <div class="tier-right">${tier2Annotation}</div>
    </div>
    <div class="tier${tier3Class}">
      <span class="tier-label"><span class="loop-icon">&#8635;</span> Per Story</span>
      <div class="tier-steps"><div class="pipeline">${tier3Steps}</div></div>
      <div class="tier-right">${tier3Annotation}</div>
    </div>`;
}

// SVG logo
const logoSVG = `<svg width="32" height="16" viewBox="0 0 32 16" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="s8grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#10B981"/></linearGradient></defs>
  <path d="M8 2C4.5 2 2 4.5 2 8s2.5 6 6 6c2 0 3.5-1 4.5-2.5L16 8l-3.5-3.5C11.5 3 10 2 8 2zm16 0c-2 0-3.5 1-4.5 2.5L16 8l3.5 3.5C20.5 13 22 14 24 14c3.5 0 6-2.5 6-6s-2.5-6-6-6z" fill="none" stroke="url(#s8grad)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// Artifacts section
function artifactsHTML() {
  if (!data.designArtifacts) return '';
  const da = data.designArtifacts;
  const items = [
    { name: 'Feature Spec (FRS)', ok: da.frs, path: 'specs/feature-requirements.md' },
    { name: 'API Spec (OpenAPI)', ok: da.apiSpec, path: 'specs/api-spec.yaml' },
    { name: 'Design Tokens (CSS)', ok: da.designTokens, path: 'specs/design-tokens.css' },
    { name: 'Mock Handlers (MSW)', ok: da.mocks, path: null },
    { name: `Wireframes (${da.wireframes || 0})`, ok: (da.wireframes || 0) > 0, path: null },
  ];
  const rows = items.map(i => {
    const label = i.ok && i.path
      ? `<a class="artifact-link" href="${i.path}" target="_blank">${esc(i.name)}</a>`
      : esc(i.name);
    return `<div class="artifact"><span class="dot ${i.ok ? 'yes' : 'no'}"></span> ${label}</div>`;
  }).join('\n          ');
  return `
      <div class="card">
        <h2>Design Artifacts</h2>
        <div class="artifacts">${rows}</div>
      </div>`;
}

// Design agents section
function agentsHTML() {
  if (!data.design) return '';
  const all = [...(data.design.agents || []), ...(data.design.autonomous || [])];
  if (all.length === 0) return '';
  const names = AGENT_DISPLAY_NAMES;
  const icons = { complete: '&#10003;', in_progress: '&#8987;', pending: '&#183;' };
  const iconCls = { complete: 'complete', in_progress: 'in_progress', pending: 'pending' };
  const rows = all.map(a => `
        <div class="agent-row">
          <div class="agent-icon ${iconCls[a.status] || 'pending'}">${icons[a.status] || '&#183;'}</div>
          <span class="agent-name">${esc(names[a.name] || a.name)}</span>
          <span class="agent-status">${esc(a.status)}</span>
        </div>`
  ).join('');
  return `
      <div class="card">
        <h2>Design Agents</h2>
        ${rows}
      </div>`;
}

// Epics section (no outer wrapper — collapsible section adds it)
function epicsHTML() {
  if (!data.epics || data.epics.length === 0) return '';
  const epicBlocks = data.epics.map(epic => {
    const completedStories = (epic.stories || []).filter(s => s.phase === 'COMPLETE').length;
    const total = epic.totalStories || epic.stories.length || 0;
    const pct = total > 0 ? Math.round(completedStories / total * 100) : 0;

    let totalAC = 0, checkedAC = 0, hasAC = false;
    for (const s of (epic.stories || [])) {
      if (s.acceptance) { hasAC = true; totalAC += s.acceptance.total; checkedAC += s.acceptance.checked; }
    }
    const acStr = hasAC ? `${checkedAC}/${totalAC}` : '&mdash;';

    const storyRows = (epic.stories || []).map(s => {
      let marker = '&#9675;';
      let markerStyle = '';
      if (s.phase === 'COMPLETE') { marker = '&#10003;'; }
      else if (w.currentStory === s.number && w.currentEpic === epic.number) {
        marker = '&#9654;'; markerStyle = ' style="color:var(--primary)"';
      }
      const sAC = s.acceptance ? `${s.acceptance.checked}/${s.acceptance.total}` : '&mdash;';
      const phaseTag = s.phase !== 'PENDING' && s.phase !== 'COMPLETE' ?
        `<span class="phase-tag ${phaseTagClass(s.phase)}">${esc(s.phase)}</span>` : '';
      return `
              <div class="story-row">
                <span class="epic-summary-cell epic-name" style="padding-left:12px"><span class="story-marker"${markerStyle}>${marker}</span>${esc(friendlyName(s.name, 'story') || `Story ${s.number}`)}</span>
                <span class="epic-summary-cell epic-phase">${s.phase === 'COMPLETE' ? `<span class="phase-tag tag-green">COMPLETE</span>` : phaseTag}</span>
                <span class="epic-summary-cell epic-progress"></span>
                <span class="epic-summary-cell epic-ac">${sAC}</span>
              </div>`;
    }).join('');

    // Expand current/in-progress epic; collapse completed and pending
    const isCurrentEpic = w.currentEpic === epic.number;
    const epicDefaultOpen = isCurrentEpic && !w.featureComplete;
    const epicId = `epic-${epic.number}`;

    return `
          <details id="${epicId}" class="epic-details" data-default-open="${epicDefaultOpen}"${epicDefaultOpen ? ' open' : ''}>
            <summary class="epic-summary">
              <span class="epic-summary-cell epic-name">${esc(friendlyName(epic.name, 'epic') || `Epic ${epic.number}`)}</span>
              <span class="epic-summary-cell epic-phase"><span class="phase-tag ${phaseTagClass(epic.phase)}">${esc(epic.phase)}</span></span>
              <span class="epic-summary-cell epic-progress">
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar" style="width:100px"><div class="fill ${epic.phase === 'COMPLETE' ? 'green' : 'primary'}" style="width:${pct}%"></div></div>
                  <span class="label-sub">${completedStories}/${total}</span>
                </div>
              </span>
              <span class="epic-summary-cell epic-ac">${acStr}</span>
            </summary>
            <div class="epic-story-list">${storyRows}
            </div>
          </details>`;
  }).join('');

  return `
        <div class="epic-header-row">
          <span class="epic-header-cell epic-name">Epic</span>
          <span class="epic-header-cell epic-phase">Phase</span>
          <span class="epic-header-cell epic-progress">Stories</span>
          <span class="epic-header-cell epic-ac">Criteria</span>
        </div>
        ${epicBlocks}`;
}

// API coverage section (no outer wrapper)
function apiHTML() {
  if (!data.api) return '';
  const api = data.api;
  const unmocked = api.totalEndpoints - api.mockCoverage;

  const endpointRows = (api.endpoints || []).map(ep => {
    const methodCls = (ep.method || 'GET').toUpperCase();
    return `
          <div class="endpoint">
            <span class="method-badge ${methodCls}">${esc(methodCls)}</span>
            <span>${esc(ep.path)}</span>
            <span class="mock-dot ${ep.hasMock ? 'yes' : 'no'}"></span>
          </div>`;
  }).join('');

  return `
        <div class="api-section">
          <div class="api-summary">
            <div class="api-stat"><div class="num">${api.totalEndpoints}</div><div class="label-sub">Endpoints</div></div>
            <div class="api-stat"><div class="num" style="color:var(--green)">${api.mockCoverage}</div><div class="label-sub">Mocked</div></div>
            <div class="api-stat"><div class="num" style="color:var(--red)">${unmocked}</div><div class="label-sub">Unmocked</div></div>
            <div class="api-stat"><div class="num" style="color:var(--yellow)">${api.drifted || 0}</div><div class="label-sub">Drifted</div></div>
          </div>
          <div class="endpoint-list">${endpointRows}
          </div>
        </div>`;
}

// Requirements section
function requirementsHTML() {
  if (!data.intake) return '';
  const i = data.intake;
  const mCheck = i.manifestExists ? 'yes' : 'no';
  const fCheck = i.frsExists ? 'yes' : 'no';
  const counts = i.requirementCount != null
    ? `<div style="margin-top:8px;font-size:13px;color:var(--text)">${i.requirementCount} requirements, ${i.businessRuleCount || 0} business rules</div>`
    : '';
  return `
      <div class="card">
        <h2>Requirements</h2>
        <div class="artifact"><span class="dot ${mCheck}"></span> ${i.manifestExists ? '<a class="artifact-link" href="context/intake-manifest.json" target="_blank">Intake Manifest</a>' : 'Intake Manifest'}</div>
        <div class="artifact" style="margin-top:6px"><span class="dot ${fCheck}"></span> ${i.frsExists ? '<a class="artifact-link" href="specs/feature-requirements.md" target="_blank">Feature Requirements Spec</a>' : 'Feature Requirements Spec'}</div>
        ${counts}
      </div>`;
}

// --- Collapsible section helpers ---
function sectionOpen(sectionId) {
  switch (sectionId) {
    case 'project-setup': return tier1Phases.includes(currentPhase);
    case 'epic-progress': return data.epics && data.epics.length > 0;
    case 'test-coverage': return hasAnyTraceability;
    case 'api-coverage': return apiSectionDefaultOpen();
    default: return false;
  }
}

function projectSetupSummary() {
  const parts = [];
  if (data.intake?.requirementCount != null) {
    parts.push(`${data.intake.requirementCount} requirements`);
    if (data.intake.businessRuleCount) parts.push(`${data.intake.businessRuleCount} business rules`);
  }
  return parts.join(', ') || '';
}

function epicProgressSummary() {
  if (!data.epics || data.epics.length === 0) return 'No epics yet';
  const completedEpics = data.epics.filter(e => e.phase === 'COMPLETE').length;
  let s = `Epic ${completedEpics}/${data.epics.length}`;
  if (w.currentStory) s += `, Story ${completedStoriesInEpic}/${totalStories}`;
  return s;
}

function apiBadge() {
  if (!data.api) return '';
  const api = data.api;
  const ds = api.dataSource || '';
  if ((api.drifted || 0) > 0) return '<span class="api-badge badge-red">Drift Detected</span>';
  if (ds === 'existing-api' && api.mockCoverage === 0) return '<span class="api-badge badge-green">All Live</span>';
  if (api.mockCoverage === api.totalEndpoints && api.totalEndpoints > 0) return '<span class="api-badge badge-yellow">Mocked</span>';
  if (api.mockCoverage > 0 && api.mockCoverage < api.totalEndpoints) return '<span class="api-badge badge-orange">Mixed</span>';
  if (ds === 'api-in-development' && api.mockCoverage === 0) return '<span class="api-badge badge-primary">Awaiting Mocks</span>';
  if (ds === 'new-api') return '<span class="api-badge badge-gray">No Backend Yet</span>';
  return '<span class="api-badge badge-gray">API Defined</span>';
}

function apiCoverageSummary() {
  if (!data.api) return '';
  return `${data.api.totalEndpoints} endpoints, ${data.api.mockCoverage} mocked`;
}

function apiSectionDefaultOpen() {
  if (!data.api) return false;
  const ds = data.api.dataSource || '';
  // Collapsed for existing-api with no mocks; expanded otherwise
  if (ds === 'existing-api' && data.api.mockCoverage === 0 && (data.api.drifted || 0) === 0) return false;
  return true;
}

// Footer
function footerHTML() {
  const parts = [];
  if (w.featureComplete) {
    parts.push('<span>Feature complete</span>');
    parts.push('<span><code>/quality-check</code> before PR</span>');
  } else {
    if (w.currentEpic) {
      let resume = `Resume: <strong>${esc(currentEpicName)}`;
      if (w.currentStory) resume += `, ${esc(currentStoryName)}`;
      resume += '</strong>';
      parts.push(`<span>${resume}</span>`);
    }
    parts.push('<span><code>/continue</code> to resume</span>');
    parts.push('<span><code>/quality-check</code> before PR</span>');
  }
  return parts.join('\n    ');
}

function activeSection() {
  if (w.featureComplete) return null;
  if (tier1Phases.includes(currentPhase)) return 'project-setup';
  if (hasAnyTraceability && tier3Phases.includes(currentPhase)) return 'test-coverage';
  if (['STORIES', 'REALIGN', 'QA'].includes(currentPhase)) return 'epic-progress';
  return null;
}
const activeSectionId = activeSection();

// --- Assemble collapsible sections ---
function buildSections() {
  let sections = '';

  // Section 1: Project Setup
  const hasSetup = data.intake || data.designArtifacts || data.design;
  if (hasSetup) {
    const isOpen = sectionOpen('project-setup');
    const reqHTML = requirementsHTML();
    const artHTML = artifactsHTML();
    const agtHTML = agentsHTML();
    const setupContent = `
    <div class="grid">
      ${reqHTML || artHTML}
      ${reqHTML ? artHTML : agtHTML}
    </div>
    ${reqHTML && agtHTML ? `<div class="grid">${agtHTML}<div></div></div>` : ''}`;
    sections += `
<details id="section-project-setup"${activeSectionId === 'project-setup' ? ' class="section-active"' : ''} data-default-open="${isOpen}"${isOpen ? ' open' : ''}>
  <summary class="section-summary">Project Setup <span class="section-meta">${esc(projectSetupSummary())}</span></summary>
  <div class="section-body">${setupContent}</div>
</details>`;
  }

  // Section 2: Epic & Story Progress
  if (data.epics && data.epics.length > 0) {
    const isOpen = sectionOpen('epic-progress');
    sections += `
<details id="section-epic-progress"${activeSectionId === 'epic-progress' ? ' class="section-active"' : ''} data-default-open="${isOpen}"${isOpen ? ' open' : ''}>
  <summary class="section-summary">Epic &amp; Story Progress <span class="section-meta">${esc(epicProgressSummary())}</span></summary>
  <div class="section-body">
    <div class="card">${epicsHTML()}</div>
  </div>
</details>`;
  }

  // Section 3: Test Coverage (per-story traceability — persists through all phases)
  if (hasAnyTraceability) {
    const isOpen = sectionOpen('test-coverage');

    // Gather all stories with traceability data
    const storiesWithTrace = [];
    for (const epic of (data.epics || [])) {
      for (const s of (epic.stories || [])) {
        if (s.traceability && s.traceability.criteria.length > 0) {
          storiesWithTrace.push({ epic, story: s });
        }
      }
    }

    // Overall counts across all stories
    let globalTotal = 0, globalChecked = 0;
    for (const { story } of storiesWithTrace) {
      for (const c of story.traceability.criteria) {
        globalTotal++;
        if (c.checked) globalChecked++;
      }
    }

    // Build per-story cards
    const storyCards = storiesWithTrace.map(({ epic, story }) => {
      const tr = story.traceability;
      const criteria = tr.criteria;
      const checkedCount = criteria.filter(c => c.checked).length;
      const isCurrent = epic.number === w.currentEpic && story.number === w.currentStory;
      const storyLabel = friendlyName(story.name, 'story') || `Story ${story.number}`;
      const epicLabel = friendlyName(epic.name, 'epic') || `Epic ${epic.number}`;
      const phaseTag = story.phase && story.phase !== 'PENDING'
        ? `<span class="phase-tag ${phaseTagClass(story.phase)}" style="margin-left:8px;font-size:11px">${esc(story.phase)}</span>`
        : '';
      const currentMarker = isCurrent ? ' style="border-left:3px solid var(--primary);padding-left:12px"' : '';

      const rows = criteria.map(c => {
        const designedIcon = c.designed ? '&#10003;' : '&mdash;';
        const testedIcon = c.tested ? '&#10003;' : '&mdash;';
        // Status: checked (verified) > designed+tested > designed only > not started
        let statusIcon, statusCls;
        if (c.checked) { statusIcon = '&#10003;'; statusCls = 'color:var(--green)'; }
        else if (c.designed && c.tested) { statusIcon = '&#10003;'; statusCls = 'color:var(--teal)'; }
        else if (c.designed) { statusIcon = '&#9888;'; statusCls = 'color:var(--yellow)'; }
        else { statusIcon = '&#10007;'; statusCls = 'color:var(--red)'; }
        const truncText = c.text.length > 60 ? esc(c.text.slice(0, 57)) + '...' : esc(c.text);
        return `<tr>
              <td style="font-weight:600;white-space:nowrap">${esc(c.id)}</td>
              <td title="${esc(c.text)}">${truncText}</td>
              <td style="text-align:center;color:${c.designed ? 'var(--green)' : 'var(--sub)'}">${designedIcon}</td>
              <td style="text-align:center;color:${c.tested ? 'var(--green)' : 'var(--sub)'}">${testedIcon}</td>
              <td style="text-align:center;${statusCls}">${statusIcon}</td>
            </tr>`;
      }).join('');

      const baWarning = tr.baDecisionsPending > 0
        ? `<div style="margin-top:8px;font-size:12px;color:var(--peach)">&#9888; ${tr.baDecisionsPending} BA decision${tr.baDecisionsPending > 1 ? 's' : ''} pending</div>`
        : '';

      return `
        <div class="card" style="margin-bottom:12px"${currentMarker}>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <span style="font-weight:600">${esc(epicLabel)} &rsaquo; ${esc(storyLabel)}</span>${phaseTag}
            </div>
            <span class="label-sub">${checkedCount}/${criteria.length} verified</span>
          </div>
          <table class="trace-table">
            <thead><tr><th>AC</th><th>Criterion</th><th style="text-align:center">Designed</th><th style="text-align:center">Tested</th><th style="text-align:center">&#9679;</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${baWarning}
        </div>`;
    }).join('');

    const testContent = storyCards + `
      <div style="margin-top:4px;font-size:11px;color:var(--sub)">&#10003; verified/covered &nbsp; &#9888; designed only &nbsp; &#10007; not started</div>`;

    const summaryMeta = `${globalChecked}/${globalTotal} criteria verified`;
    sections += `
<details id="section-test-coverage"${activeSectionId === 'test-coverage' ? ' class="section-active"' : ''} data-default-open="${isOpen}"${isOpen ? ' open' : ''}>
  <summary class="section-summary">Test Coverage <span class="section-meta">${esc(summaryMeta)}</span></summary>
  <div class="section-body">${testContent}</div>
</details>`;
  }

  // Section 4: API Coverage
  if (data.api) {
    const isOpen = sectionOpen('api-coverage');
    sections += `
<details id="section-api-coverage" data-default-open="${isOpen}"${isOpen ? ' open' : ''}>
  <summary class="section-summary">API Coverage ${apiBadge()} <span class="section-meta">${esc(apiCoverageSummary())}</span></summary>
  <div class="section-body">
    <div class="card">${apiHTML()}</div>
  </div>
</details>`;
  }

  return sections;
}

// localStorage persistence script
const localStorageScript = `
<script>
(function() {
  var slug = '${featureSlug}';
  var prefix = 'stadium8-' + slug + '-';

  document.addEventListener('DOMContentLoaded', function() {
    var sections = document.querySelectorAll('details[id][data-default-open]');
    sections.forEach(function(el) {
      var key = prefix + el.id;
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(key)); } catch(e) {}
      if (saved && saved.defaultOpen === el.getAttribute('data-default-open')) {
        if (saved.open && !el.open) el.open = true;
        if (!saved.open && el.open) el.removeAttribute('open');
      } else {
        try { localStorage.removeItem(key); } catch(e) {}
      }
    });

    document.addEventListener('toggle', function(e) {
      var el = e.target;
      if (el.tagName === 'DETAILS' && el.id && el.hasAttribute('data-default-open')) {
        var key = prefix + el.id;
        try {
          localStorage.setItem(key, JSON.stringify({
            open: el.open,
            defaultOpen: el.getAttribute('data-default-open')
          }));
        } catch(e) {}
      }
    }, true);
  });
})();
</script>`;

// Completion summary card
function completionCardHTML() {
  if (!w.featureComplete) return '';
  const epicCount = data.epics?.length || 0;
  const storyCount = (data.epics || []).reduce((sum, e) => sum + (e.stories?.length || 0), 0);
  let totalAC = 0;
  for (const e of (data.epics || [])) {
    for (const s of (e.stories || [])) {
      if (s.acceptance) totalAC += s.acceptance.total;
    }
  }
  const parts = [];
  if (epicCount) parts.push(`${epicCount} epic${epicCount > 1 ? 's' : ''}`);
  if (storyCount) parts.push(`${storyCount} stor${storyCount > 1 ? 'ies' : 'y'}`);
  if (totalAC) parts.push(`${totalAC} acceptance criteria`);
  return `
<div class="completion-card">
  <div class="completion-icon">&#10003;</div>
  <div class="completion-text">
    <div class="completion-title">Feature complete</div>
    <div class="completion-detail">${parts.join(' &middot; ')}</div>
  </div>
</div>`;
}

// --- Assemble HTML ---
const noStateMessage = data.status === 'no_state'
  ? `<div class="card" style="text-align:center;padding:40px"><div style="margin-bottom:12px">${logoSVG}</div><h2 style="color:var(--text);font-size:16px">No workflow state found</h2><p style="color:var(--sub);margin-top:8px">Run <code>/start</code> to begin the TDD workflow.</p></div>`
  : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="10">
<title>${esc(featureName)} - Stadium 8 Dashboard</title>
<style>
  :root {
    --bg: #111113;
    --surface: #1C1C1F;
    --surface2: #2A2A2E;
    --border: #3A3A3F;
    --text: #E4E4E7;
    --sub: #A1A1AA;
    --primary: #3B82F6;
    --secondary: #10B981;
    --green: #a6e3a1;
    --yellow: #f9e2af;
    --red: #f38ba8;
    --teal: #94e2d5;
    --peach: #fab387;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5;
  }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
  .header-brand { display: flex; align-items: center; gap: 10px; }
  .header-titles h1 { font-size: 20px; font-weight: 600; line-height: 1.2; }
  .header-titles .subtitle { font-size: 11px; color: var(--sub); letter-spacing: 1.5px; text-transform: uppercase; }
  .phase-badge { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
  .timestamp { margin-left: auto; font-size: 12px; color: var(--sub); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .grid.full { grid-template-columns: 1fr; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .card h2 { font-size: 13px; font-weight: 600; color: var(--sub); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; }

  /* Three-tier pipeline */
  .workflow-tiers { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .tier { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--surface2); }
  .tier:last-child { border-bottom: none; }
  .tier-done { opacity: 0.6; }
  .tier-label { min-width: 100px; font-size: 11px; font-weight: 600; color: var(--sub); text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; }
  .tier-steps { flex: 1; }
  .tier-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .tier-note { font-size: 10px; color: var(--sub); font-style: italic; }
  .tier-info { font-size: 11px; color: var(--text); }
  .tier-progress { display: flex; align-items: center; gap: 6px; }
  .loop-icon { font-size: 12px; color: var(--sub); }
  .impact-badge { background: rgba(250,179,135,0.2); color: var(--peach); font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 8px; margin-left: 2px; }

  .pipeline { display: flex; gap: 4px; align-items: center; }
  .step { flex: 1; text-align: center; padding: 6px 4px; border-radius: 6px; font-size: 10px; font-weight: 600; background: var(--surface2); color: var(--sub); }
  .step.done { background: rgba(166,227,161,0.15); color: var(--green); }
  .step.active { background: rgba(59,130,246,0.15); color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }

  .arrow { color: var(--border); font-size: 14px; flex-shrink: 0; }
  .artifacts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .artifact { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .dot.yes { background: var(--green); }
  .dot.no { background: var(--border); }
  .artifact-link { color: var(--text); text-decoration: none; border-bottom: 1px dashed var(--sub); transition: color 0.15s, border-color 0.15s; }
  .artifact-link:hover { color: var(--primary); border-color: var(--primary); }
  .agent-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--surface2); }
  .agent-row:last-child { border-bottom: none; }
  .agent-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .agent-icon.complete { background: rgba(166,227,161,0.2); color: var(--green); }
  .agent-icon.pending { background: var(--surface2); color: var(--sub); }
  .agent-icon.in_progress { background: rgba(249,226,175,0.2); color: var(--yellow); }
  .agent-name { flex: 1; }
  .agent-status { font-size: 11px; color: var(--sub); }
  .epic-table { width: 100%; border-collapse: collapse; }
  .epic-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--sub); padding: 6px 8px; border-bottom: 1px solid var(--border); }
  .epic-table td { padding: 8px; font-size: 13px; border-bottom: 1px solid var(--surface2); }
  .epic-table tr:last-child td { border-bottom: none; }
  .story-row td { padding-left: 28px; font-size: 12px; color: var(--sub); }
  .story-marker { margin-right: 6px; }
  .progress-bar { width: 100%; height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .fill { height: 100%; border-radius: 3px; }
  .fill.green { background: var(--green); }
  .fill.primary { background: var(--primary); }
  .fill.yellow { background: var(--yellow); }
  .phase-tag { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .tag-green { background: rgba(166,227,161,0.15); color: var(--green); }
  .tag-primary { background: rgba(59,130,246,0.15); color: var(--primary); }
  .tag-yellow { background: rgba(249,226,175,0.15); color: var(--yellow); }
  .tag-teal { background: rgba(148,226,213,0.15); color: var(--teal); }
  .tag-secondary { background: rgba(16,185,129,0.15); color: var(--secondary); }
  .tag-peach { background: rgba(250,179,135,0.15); color: var(--peach); }
  .tag-gray { background: var(--surface2); color: var(--sub); }
  .api-section { display: flex; gap: 32px; }
  .api-summary { display: flex; flex-direction: column; gap: 12px; min-width: 120px; }
  .api-stat { text-align: center; }
  .api-stat .num { font-size: 22px; font-weight: 700; }
  .api-stat .label-sub { font-size: 11px; color: var(--sub); }
  .endpoint-list { flex: 1; max-height: 200px; overflow-y: auto; font-size: 12px; }
  .endpoint { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .method-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; min-width: 42px; text-align: center; }
  .method-badge.GET { background: rgba(59,130,246,0.2); color: var(--primary); }
  .method-badge.POST { background: rgba(166,227,161,0.2); color: var(--green); }
  .method-badge.PUT { background: rgba(249,226,175,0.2); color: var(--yellow); }
  .method-badge.DELETE { background: rgba(243,139,168,0.2); color: var(--red); }
  .method-badge.PATCH { background: rgba(250,179,135,0.2); color: var(--peach); }
  .mock-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-left: auto; }
  .mock-dot.yes { background: var(--green); }
  .mock-dot.no { background: var(--red); }
  .api-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 8px; margin-left: 4px; }
  .badge-green { background: rgba(166,227,161,0.15); color: var(--green); }
  .badge-yellow { background: rgba(249,226,175,0.15); color: var(--yellow); }
  .badge-orange { background: rgba(250,179,135,0.15); color: var(--peach); }
  .badge-red { background: rgba(243,139,168,0.15); color: var(--red); }
  .badge-primary { background: rgba(59,130,246,0.15); color: var(--primary); }
  .badge-gray { background: var(--surface2); color: var(--sub); }
  .epic-header-row { display: flex; align-items: center; padding: 6px 8px 6px 24px; border-bottom: 1px solid var(--border); }
  .epic-header-cell { font-size: 11px; font-weight: 600; color: var(--sub); text-transform: uppercase; }
  .epic-details { border-bottom: 1px solid var(--surface2); }
  .epic-details:last-child { border-bottom: none; }
  .epic-summary { display: flex; align-items: center; padding: 8px 8px 8px 0; cursor: pointer; list-style: none; }
  .epic-summary::-webkit-details-marker { display: none; }
  .epic-summary::before { content: '\\25B8'; color: var(--sub); font-size: 10px; width: 20px; text-align: center; flex-shrink: 0; transition: transform 0.15s; }
  .epic-details[open] > .epic-summary::before { transform: rotate(90deg); }
  .epic-summary-cell { font-size: 13px; }
  .epic-name { flex: 1; font-weight: 600; }
  .epic-phase { width: 100px; }
  .epic-progress { width: 140px; }
  .epic-ac { width: 70px; text-align: center; }
  .epic-story-list { padding-left: 20px; }
  .story-row { display: flex; align-items: center; padding: 4px 8px 4px 0; border-top: 1px solid var(--surface2); font-size: 12px; color: var(--sub); }
  .story-row .epic-name { font-weight: 400; }
  .story-marker { margin-right: 6px; }
  .trace-table { width: 100%; border-collapse: collapse; }
  .trace-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--sub); padding: 6px 8px; border-bottom: 1px solid var(--border); }
  .trace-table td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid var(--surface2); }
  .trace-table tr:last-child td { border-bottom: none; }
  .label-sub { font-size: 11px; color: var(--sub); }

  /* Collapsible sections */
  details { margin-bottom: 16px; }
  .section-summary { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; cursor: pointer; font-size: 14px; font-weight: 600; list-style: none; border-left: 3px solid transparent; }
  .section-active > .section-summary { border-left: 3px solid; border-image: linear-gradient(180deg, var(--primary), var(--secondary)) 1; }
  .section-summary::-webkit-details-marker { display: none; }
  .section-summary::before { content: '\\25B8'; color: var(--sub); font-size: 12px; transition: transform 0.15s; }
  details[open] > .section-summary::before { transform: rotate(90deg); }
  details[open] > .section-summary { border-radius: 10px 10px 0 0; margin-bottom: 0; }
  .section-meta { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--sub); }
  .section-body { background: var(--surface); border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; padding: 16px; }
  .section-body .card { border: none; padding: 0; background: transparent; }
  .section-body .grid { margin-bottom: 8px; }
  .section-body .grid:last-child { margin-bottom: 0; }

  .completion-card { display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08)); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 16px 20px; margin-bottom: 16px; }
  .completion-icon { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .completion-title { font-size: 16px; font-weight: 600; }
  .completion-detail { font-size: 13px; color: var(--sub); margin-top: 2px; }
  .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 12px; color: var(--sub); display: flex; align-items: center; gap: 24px; }
  .footer code { background: var(--surface2); padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .footer-brand { margin-left: auto; font-size: 10px; color: var(--sub); opacity: 0.6; letter-spacing: 1px; text-transform: uppercase; }
  .auto-refresh { font-size: 10px; color: var(--sub); opacity: 0.5; margin-top: 8px; text-align: right; }
</style>
</head>
<body>

${noStateMessage || `<div class="header">
  <div class="header-brand">
    ${logoSVG}
    <div class="header-titles">
      <h1>${esc(featureName)}</h1>
      <div class="subtitle">Stadium 8</div>
    </div>
  </div>
  <span class="phase-badge">${esc(currentPhase)}</span>
  <span class="timestamp">Updated ${timestamp()}</span>
</div>

<div class="workflow-tiers">
  ${pipelineHTML()}
</div>

${completionCardHTML()}
${buildSections()}

<div class="footer">
  ${footerHTML()}
  <span class="footer-brand">Stadium 8</span>
</div>`}

<div class="auto-refresh">Auto-refreshes every 10 seconds</div>

${localStorageScript}

</body>
</html>`;

// --- Write output ---
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(outputPath, html, 'utf-8');

const stats = fs.statSync(outputPath);
console.log(JSON.stringify({
  status: 'ok',
  path: outputPath,
  bytes: stats.size,
  timestamp: timestamp()
}));
