import { createRun, completeGame, answerIdentity } from './game.mjs';
import { loadSaved, saveResult, savePreferences, clearSaved } from './storage.mjs';
import * as loop from './minigames/loop.mjs';
import * as revisions from './minigames/revisions.mjs';
import * as mascot from './minigames/mascot.mjs';
import * as system from './minigames/system.mjs';

const modules = { loop, revisions, mascot, system };
const $ = (selector, root = document) => root.querySelector(selector);
const screen = $('#screen');
const notebook = $('#notebook-dialog');
const bonus = $('#bonus-dialog');
const settings = $('#settings-dialog');
const debug = new URLSearchParams(location.search).get('debug') === '1';
const base = new URL('../', import.meta.url);
let storage = null;
try { storage = window.localStorage; } catch { /* Play remains available when storage is blocked. */ }
let saved = loadSaved(storage);
let preferences = { ...saved.preferences };
let chapter;
let run = null;
let activeGame = null;
let stage = 'intro';
let revealed = new Set();
let cleanup = () => {};
let audio;

function applyTheme() {
  document.documentElement.dataset.theme = preferences.darkMode ? 'dark' : 'light';
  $('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
}

function notice(message) {
  $('#storage-warning').textContent = message ?? '';
  $('#storage-warning').hidden = !message;
}

function warnBeforeLeave(event) {
  event.preventDefault();
  event.returnValue = '';
}

function updateStatus(shownScore) {
  const original = stage === 'intro' ? saved.results[chapter?.id] : null;
  const finished = stage === 'result' || Boolean(original);
  $('#score').textContent = String(shownScore ?? run?.score ?? original?.score ?? 0).padStart(3, '0');
  $('#phase-label').textContent = finished ? 'CASE SOLVED' : run ? 'IN PROGRESS' : 'UNOPENED';
  $('#notebook-count').textContent = String(finished ? chapter.games.length : revealed.size);
  $('#progress-caption').textContent = `${finished ? chapter.games.length : revealed.size} / ${chapter.games.length} clues collected`;
  screen.querySelectorAll('[data-action="bonus"]').forEach(button => { button.hidden = !chapter.bonusEvidence; });
  document.querySelectorAll('.progress-steps li').forEach((item, index) => {
    const complete = finished || (index < chapter.games.length && revealed.has(run?.order[index]));
    const active = Boolean(run) && !finished && index === revealed.size;
    item.classList.toggle('is-complete', complete);
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  if (run && !run.finished) window.addEventListener('beforeunload', warnBeforeLeave);
  else window.removeEventListener('beforeunload', warnBeforeLeave);
  if (debug) {
    $('#debug-order').textContent = run ? `Order: ${run.order.join(' → ')}` : 'Open the case to inspect its order.';
    $('#debug-complete').disabled = stage !== 'puzzle';
  }
}

function replaceScreen(markup, nextStage) {
  cleanup();
  cleanup = () => {};
  stage = nextStage;
  screen.innerHTML = markup;
  window.scrollTo(0, 0);
}

function focusTitle() {
  const title = $('#screen-title');
  title.tabIndex = -1;
  title.focus();
}

function renderIntro(focus = false) {
  run = null;
  activeGame = null;
  revealed = new Set();
  const original = saved.results[chapter.id];
  document.title = 'The Curious Files — Science Mystery';
  replaceScreen(`
    <article class="case-dossier" aria-labelledby="screen-title">
      <span class="dossier-folder-tab">CASE 001</span>
      <div class="dossier-cover-line"><span>DEPARTMENT OF CURIOUS THINGS</span><span>SCIENCE / SPECIAL INQUIRY</span></div>
      <div class="dossier-layout">
        <section class="dossier-report" aria-label="Case briefing">
          <div class="dossier-report-heading"><p class="dossier-kicker">Investigation report</p><span>001 / A</span></div>
          <p class="dossier-field-label">Case title</p>
          <h1 id="screen-title"></h1>
          <dl class="dossier-facts">
            <div><dt>Status</dt><dd>${original ? 'Case solved' : 'Open investigation'}</dd></div>
            <div><dt>Identity</dt><dd id="dossier-identity"></dd></div>
            <div><dt>Objective</dt><dd>Identify the mystery creator.</dd></div>
            <div><dt>Evidence</dt><dd>Four recovered exhibits.</dd></div>
          </dl>
          <h2 class="dossier-field-label">Case summary</h2>
          <p class="lead" id="case-intro"></p>
          <div class="dossier-report-bottom"><p>No technical knowledge needed.<br>Follow the evidence. Trust your curiosity.</p><span class="dossier-stamp" aria-hidden="true">${original ? 'CASE<br>SOLVED' : 'IDENTITY<br>UNKNOWN'}</span></div>
        </section>
        <aside class="dossier-evidence" aria-label="Attached evidence previews">
          <h2>Attached evidence / preview</h2>
          <figure class="dossier-slip">
            <figcaption>Exhibit A / the first experiment</figcaption>
            <code>10 PRINT "?"<br>20 GOTO 10</code>
            <p>One message. Again and again.</p>
          </figure>
          <figure class="dossier-slip">
            <figcaption>Exhibit B / nothing lost</figcaption>
            <div class="history-line" aria-hidden="true"><i></i><b></b><i></i><b></b><i></i></div>
            <p>Every change leaves a trace.</p>
          </figure>
          <p class="dossier-attachment-note">Illustrative fragments.<br>Full exhibits inside the case.</p>
        </aside>
      </div>
      <footer class="dossier-footer">
        <div class="case-overview" aria-label="Case rules">
          <div class="overview-stat"><strong>04</strong><span>exhibits to restore</span></div>
          <div class="overview-stat"><strong>350</strong><span>points to discover</span></div>
          <div class="overview-stat"><strong>∞</strong><span>chances to get it right</span></div>
        </div>
        <div class="dossier-open"><p class="quiet">Take your time. No timer. No rush.</p><button type="button" class="button button-primary" data-action="start" id="open-case">${original ? 'Replay case' : 'Open case file'} <span aria-hidden="true">↗</span></button></div>
        <section class="original-panel" id="original-panel" hidden><p id="original-result"></p><button type="button" class="button button-small" data-action="view-saved">View solved case</button><button type="button" class="button button-bonus" data-action="bonus" hidden><span aria-hidden="true">✦</span> Bonus evidence</button></section>
      </footer>
    </article>`, 'intro');
  $('#screen-title').textContent = chapter.title;
  $('#case-intro').textContent = chapter.intro;
  $('#dossier-identity').textContent = original ? chapter.identityAnswer : 'Unknown';
  if (original) {
    $('#original-panel').hidden = false;
    $('#original-result').textContent = `Original result: ${original.score} / 350. Your first completed case is safely kept.`;
  }
  updateStatus();
  if (focus) $('#open-case').focus();
}

function startRun() {
  run = createRun(chapter.games.map(game => game.id));
  revealed = new Set();
  renderPuzzle();
}

function renderPuzzle() {
  activeGame = chapter.games.find(game => game.id === run.order[run.completed.length]);
  const game = activeGame;
  replaceScreen(`
    <header class="section-heading"><p class="eyebrow" id="artifact-label"></p><h1 id="screen-title"></h1><p class="lead" id="puzzle-instructions"></p></header>
    <section class="exhibit-card" id="puzzle" aria-label="Interactive evidence"></section>`, 'puzzle');
  $('#artifact-label').textContent = `EXHIBIT ${String(run.completed.length + 1).padStart(2, '0')} / ${game.artifact}`;
  $('#screen-title').textContent = game.title;
  $('#puzzle-instructions').textContent = game.instructions;
  const container = $('#puzzle');
  container.dataset.type = game.type;
  cleanup = modules[game.type].mount(container, game, () => acceptPuzzle(game));
  updateStatus();
  focusTitle();
}

function acceptPuzzle(game) {
  if (stage !== 'puzzle' || !completeGame(run, game.id)) return;
  stage = 'solved';
  $('#puzzle').querySelectorAll('button, input').forEach(control => { control.disabled = true; });
  screen.insertAdjacentHTML('beforeend', `<section class="success-panel" aria-label="Evidence restored"><div><strong>Evidence restored. +${300 / run.order.length} points.</strong><p>Every fragment has a story. Here is the one behind this exhibit.</p></div><button type="button" class="button button-primary" data-action="story">Read the story</button></section>`);
  if (preferences.sound) {
    audio ??= new Audio(new URL('assets/success.wav', base).href);
    audio.currentTime = 0;
    audio.play().catch(() => { /* Optional audio must never interrupt a completed puzzle. */ });
  }
  updateStatus();
  $('[data-action="story"]').focus();
}

function renderStory() {
  replaceScreen(`
    <div class="story-layout">
      <header class="section-heading"><p class="eyebrow">BEHIND THE EVIDENCE / +${300 / run.order.length} POINTS</p><h1 id="screen-title"></h1><p class="lead">You restored the fragment. Now meet the story behind it.</p></header>
      <section class="story-copy"><div class="evidence-label">What really happened</div><p id="story-text"></p></section>
      <button type="button" class="button button-primary" data-action="clue">Reveal clue</button>
      <p class="quiet">Your clue appears only when you are ready.</p>
      <button type="button" class="button button-bonus bonus-entry" data-action="bonus" hidden><span aria-hidden="true">✦</span> Bonus evidence</button>
    </div>`, 'story');
  $('#screen-title').textContent = activeGame.title;
  $('#story-text').textContent = activeGame.explanation;
  updateStatus();
  focusTitle();
}

function clueCard(game, number) {
  const card = document.createElement('section');
  card.className = 'clue-card';
  const label = document.createElement('p');
  label.className = 'evidence-label';
  label.textContent = `IDENTITY CLUE / ${String(number).padStart(2, '0')}`;
  const text = document.createElement('p');
  text.className = 'clue-text';
  text.textContent = game.clue;
  card.append(label, text);
  return card;
}

function renderClue() {
  revealed.add(activeGame.id);
  replaceScreen(`
    <div class="story-layout"><header class="section-heading"><p class="eyebrow">A PIECE OF THE PERSON</p><h1 id="screen-title">Your next clue.</h1><p class="lead">A small detail. A step closer to the answer.</p></header>
      <div id="clue-slot"></div><button type="button" class="button button-primary" data-action="continue"></button><p class="quiet">Find this clue and its story again in your evidence notebook.</p>
    </div>`, 'clue');
  $('#clue-slot').append(clueCard(activeGame, revealed.size));
  $('[data-action="continue"]').textContent = revealed.size === chapter.games.length ? 'Identify the creator' : 'Continue';
  updateStatus();
  focusTitle();
}

function renderIdentity() {
  replaceScreen(`
    <header class="section-heading"><p class="eyebrow">THE FINAL CONNECTION</p><h1 id="screen-title">Who is behind it all?</h1><p class="lead">Four fragments, one person. Bring your clues together and choose the mystery creator. A correct first answer earns 50 bonus points.</p></header>
    <div class="identity-layout"><section class="identity-clues" id="identity-clues" aria-label="Your four collected clues"></section><section><div class="identity-options" id="identity-options" role="group" aria-label="Choose the mystery creator"></div><p class="feedback" id="identity-feedback" role="status" aria-live="polite"></p><p class="quiet">No rush. If you get it wrong, you can try again.</p></section></div>`, 'identity');
  run.order.forEach((id, index) => {
    $('#identity-clues').append(clueCard(chapter.games.find(game => game.id === id), index + 1));
  });
  for (const name of chapter.identityChoices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button identity-option';
    button.textContent = name;
    button.dataset.action = 'identify';
    button.dataset.choice = name;
    $('#identity-options').append(button);
  }
  updateStatus();
  focusTitle();
}

function identify(button) {
  if (stage !== 'identity') return;
  if (!answerIdentity(run, button.dataset.choice, chapter.identityAnswer)) {
    $('#identity-feedback').textContent = 'Not quite. Your 300 puzzle points are safe. Compare the clues and try another name; the first-answer bonus is no longer available.';
    button.disabled = true;
    $('#identity-options button:not(:disabled)')?.focus();
    return;
  }
  let message;
  if (debug) {
    message = 'Developer sandbox: this chapter result is not saved.';
  } else {
    const outcome = saveResult(storage, chapter.id, { ...run, debug: false, completedAt: new Date().toISOString() });
    saved = loadSaved(storage);
    if (outcome.warning) {
      notice(outcome.warning);
      message = 'This result could not be saved. Your case is still complete; existing saved data has not been replaced.';
    } else if (outcome.saved) {
      message = 'Your first completed result is saved in this browser. Replaying will not change it.';
    } else {
      message = `Original result: ${saved.results[chapter.id].score} / 350. This replay has not changed it.`;
    }
  }
  renderResult(run.score, message);
}

function externalLink(text, url) {
  const link = document.createElement('a');
  link.textContent = text;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function renderResult(score, message) {
  replaceScreen(`
    <section class="result-banner"><div><p class="eyebrow">CASE CLOSED / CURIOSITY REWARDED</p><h2 id="rating"></h2></div><div class="result-total"><strong class="result-score"></strong><span>/ 350</span></div></section>
    <div class="reveal-layout">
      <figure class="portrait-frame"><img id="portrait" width="255" height="345" alt=""><p class="portrait-fallback" id="portrait-fallback" hidden>Portrait unavailable. The case is still solved.</p><figcaption id="portrait-caption"></figcaption></figure>
      <section class="reveal-copy"><p class="eyebrow">THE MIND BEHIND THE MYSTERY</p><h1 id="screen-title"></h1><p id="biography"></p><div class="achievements" id="achievements"></div></section>
    </div>
    <figure class="original-quote"><blockquote id="original-quote"></blockquote><figcaption id="quote-context"></figcaption></figure>
    <div class="result-actions"><button type="button" class="button button-primary" data-action="start">Replay case <span aria-hidden="true">↗</span></button><button type="button" class="button button-secondary" data-action="notebook">Revisit the evidence</button><button type="button" class="button button-bonus" data-action="bonus" hidden><span aria-hidden="true">✦</span> Bonus evidence</button><button type="button" class="button button-secondary" data-action="home">Back to case file</button></div>
    <p class="quiet" id="saved-status" role="status"></p>
    <details class="case-glossary">
      <summary>Case glossary</summary>
      <p class="quiet">Three useful terms, in plain English.</p>
      <dl>
        <div><dt>Kernel</dt><dd>The core of an operating system—the software that runs a computer. It manages memory and helps programs use hardware. Linux is a kernel.</dd></div>
        <div><dt>Open source</dt><dd>Software with a license that allows people to use, study, change, and share its source code—the instructions used to build it.</dd></div>
        <div><dt>Version control</dt><dd>A way to record changes to files over time, compare earlier versions, and work with other people on the same project. Git is a version-control tool.</dd></div>
      </dl>
    </details>
    <details class="sources"><summary>Sources, credits &amp; the finer details</summary><ul id="source-list"></ul><p id="portrait-credit"></p><p>Illustrations and feedback sound were made for this game. Historical sources open in a new tab and need an internet connection; gameplay does not.</p></details>`, 'result');
  $('#rating').textContent = score === 350 ? 'Master detective.' : 'Case solved.';
  $('.result-score').textContent = score;
  $('#screen-title').textContent = chapter.identityAnswer;
  $('#biography').textContent = chapter.biography;
  $('#saved-status').textContent = message;
  $('#original-quote').textContent = `“${chapter.quote}”`;
  $('#quote-context').textContent = chapter.quoteContext;
  const portrait = $('#portrait');
  portrait.alt = chapter.portrait.description;
  portrait.addEventListener('error', () => {
    portrait.hidden = true;
    $('#portrait-fallback').hidden = false;
  }, { once: true });
  portrait.src = new URL(chapter.portrait.path, base).href;
  $('#portrait-caption').textContent = `Portrait: ${chapter.portrait.author} / ${chapter.portrait.license}`;
  for (const item of chapter.achievements) {
    const article = document.createElement('article');
    article.className = 'achievement';
    const year = document.createElement('span');
    year.textContent = item.year;
    const title = document.createElement('h3');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.text;
    article.append(year, title, text);
    $('#achievements').append(article);
  }
  for (const source of chapter.sources) {
    const item = document.createElement('li');
    item.append(externalLink(source.title, source.url));
    $('#source-list').append(item);
  }
  $('#portrait-credit').append(`Portrait by ${chapter.portrait.author}. `,
    externalLink('Image source', chapter.portrait.source), ' · ',
    externalLink(chapter.portrait.license, chapter.portrait.licenseUrl),
    `. ${chapter.portrait.modifications}`);
  document.title = `${chapter.identityAnswer} — The Curious Files`;
  updateStatus(score);
  focusTitle();
}

function openBonusEvidence() {
  if (!chapter?.bonusEvidence) return;
  $('#bonus-title').textContent = 'Bonus evidence';
  $('#bonus-warning').hidden = false;
  $('#bonus-content').replaceChildren();
  $('#bonus-content').hidden = true;
  bonus.showModal();
  bonus.scrollTop = 0;
  $('#bonus-warning-text').focus();
}

function revealBonusEvidence() {
  if (!bonus.open || $('#bonus-warning').hidden) return;
  const evidence = chapter.bonusEvidence;
  const content = $('#bonus-content');
  const introduction = document.createElement('p');
  introduction.textContent = evidence.introduction;
  content.append(introduction);
  for (const item of evidence.items) {
    const entry = document.createElement('figure');
    entry.className = 'bonus-item';
    const title = document.createElement('h3');
    title.textContent = item.title;
    const context = document.createElement('p');
    context.className = 'quiet';
    context.textContent = item.context;
    entry.append(title, context);
    for (const text of item.quotes) {
      const quote = document.createElement('blockquote');
      quote.textContent = text;
      entry.append(quote);
    }
    const source = document.createElement('figcaption');
    source.append(item.source.url ? externalLink(item.source.title, item.source.url) : item.source.title);
    entry.append(source);
    content.append(entry);
  }
  $('#bonus-warning').hidden = true;
  content.hidden = false;
  $('#bonus-title').textContent = evidence.title;
  $('#bonus-title').focus();
}

function openNotebook() {
  if (!chapter) return;
  const content = $('#notebook-content');
  content.replaceChildren();
  const hasSaved = !run && Boolean(saved.results[chapter.id]);
  const ids = hasSaved ? chapter.games.map(game => game.id) : run?.completed ?? [];
  if (!ids.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No evidence collected yet. Restore your first exhibit to start filling these pages.';
    content.append(empty);
  }
  for (const id of ids) {
    const game = chapter.games.find(item => item.id === id);
    const entry = document.createElement('article');
    entry.className = 'notebook-entry';
    const title = document.createElement('h3');
    title.textContent = game.title;
    const story = document.createElement('p');
    story.textContent = game.explanation;
    const clue = document.createElement('p');
    clue.className = 'notebook-clue';
    clue.textContent = revealed.has(id) || hasSaved ? game.clue : 'Clue not yet revealed. Read the story, then choose Reveal clue.';
    entry.append(title, story, clue);
    content.append(entry);
  }
  notebook.showModal();
}

function returnHome() {
  if (run && !run.finished && !window.confirm('Leave this unfinished case? Your current run will be lost. Completed results and preferences will stay saved.')) return;
  renderIntro(true);
}

function validateChapter(value) {
  const text = item => typeof item === 'string' && item.length > 0;
  const https = url => {
    if (!text(url)) return false;
    try { return new URL(url).protocol === 'https:'; } catch { return false; }
  };
  if (!value || !/^[a-z0-9-]+$/.test(value.id) || !text(value.title) || !text(value.intro)
      || !Array.isArray(value.games) || value.games.length !== 4
      || new Set(value.games.map(game => game?.id)).size !== 4
      || new Set(value.games.map(game => game?.type)).size !== 4
      || !Array.isArray(value.identityChoices) || new Set(value.identityChoices).size !== 4
      || !value.identityChoices.every(text) || !value.identityChoices.includes(value.identityAnswer)
      || !text(value.biography) || !Array.isArray(value.achievements)
      || !value.achievements.every(item => text(item.year) && text(item.title) && text(item.text))
      || !text(value.quote) || !text(value.quoteContext)
      || !Array.isArray(value.sources) || !value.sources.every(source => text(source.title) && https(source.url))
      || !value.portrait || !text(value.portrait.path) || value.portrait.path.startsWith('/')
      || new URL(value.portrait.path, base).origin !== location.origin
      || !['author', 'description', 'license', 'modifications'].every(key => text(value.portrait[key]))
       || !https(value.portrait.source) || !https(value.portrait.licenseUrl)) throw new Error('Invalid chapter data');
  const evidence = value.bonusEvidence;
  if (evidence !== undefined && (!evidence || !text(evidence.title) || !text(evidence.introduction)
      || !Array.isArray(evidence.items) || !evidence.items.length
      || !evidence.items.every(item => item && text(item.title) && text(item.context)
        && Array.isArray(item.quotes) && item.quotes.length && item.quotes.every(text)
        && item.source && text(item.source.title)
        && (item.source.url === undefined || https(item.source.url))))) throw new Error('Invalid bonus evidence');
  for (const game of value.games) {
    if (!['id', 'title', 'artifact', 'instructions', 'explanation', 'clue'].every(key => text(game[key]))
        || !text(game.type) || !Object.hasOwn(modules, game.type) || !game.config) throw new Error('Invalid puzzle data');
    const config = game.config;
    if (game.type === 'loop' && (!Array.isArray(config.correctOrder) || config.correctOrder.length !== 2
        || !Array.isArray(config.commands) || config.commands.length !== 2 || !text(config.message)
        || !config.correctOrder.every(id => config.commands.some(command => command.id === id && text(command.label) && text(command.description))))) throw new Error('Invalid loop');
    if (game.type === 'revisions' && (!Array.isArray(config.base) || config.base.length !== 2 || !config.base.every(text)
        || !Array.isArray(config.target) || config.target.length !== 2 || !config.target.every(text)
        || !Array.isArray(config.cards) || config.cards.length !== 3
        || !config.cards.every(card => text(card.id) && text(card.title) && text(card.text) && text(card.description) && [0, 1].includes(card.line)))) throw new Error('Invalid revisions');
    if (game.type === 'mascot' && (!text(config.note) || !config.options || !config.correct
        || !['posture', 'expression', 'shape'].every(key => Array.isArray(config.options[key])
          && config.options[key].every(option => text(option.value) && text(option.label))
           && config.options[key].some(option => option.value === config.correct[key])))) throw new Error('Invalid mascot');
    if (game.type === 'system' && (!Array.isArray(config.parts) || config.parts.length !== 3
        || !config.parts.every(part => part && text(part.id) && text(part.label) && text(part.description))
        || new Set(config.parts.map(part => part.id)).size !== 3
        || new Set(config.parts.map(part => part.label)).size !== 3
        || !Array.isArray(config.jobs) || config.jobs.length !== 3
        || !config.jobs.every(job => job && text(job.id) && text(job.label) && config.parts.some(part => part.id === job.part))
        || new Set(config.jobs.map(job => job.id)).size !== 3
        || new Set(config.jobs.map(job => job.label)).size !== 3
        || new Set(config.jobs.map(job => job.part)).size !== 3)) throw new Error('Invalid system');
  }
}

async function loadChapter() {
  try {
    const response = await fetch(new URL('data/chapter.json', base), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Chapter request failed: ${response.status}`);
    const value = await response.json();
    validateChapter(value);
    chapter = value;
    renderIntro();
  } catch {
    replaceScreen(`<div class="loading-state"><p class="eyebrow">AN ARCHIVE DRAWER IS STUCK</p><h1 id="screen-title">Case file unavailable</h1><p>The chapter could not be loaded. Check that the game files are complete and the local Python server is running. Your saved data has not been changed.</p><button type="button" class="button button-primary" data-action="retry">Retry loading</button></div>`, 'error');
  }
}

screen.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  switch (button.dataset.action) {
    case 'retry': button.disabled = true; loadChapter(); break;
    case 'start': startRun(); break;
    case 'story': if (stage === 'solved') renderStory(); break;
    case 'clue': if (stage === 'story') renderClue(); break;
    case 'continue': if (stage === 'clue') revealed.size === chapter.games.length ? renderIdentity() : renderPuzzle(); break;
    case 'identify': identify(button); break;
    case 'notebook': openNotebook(); break;
    case 'bonus': openBonusEvidence(); break;
    case 'home': returnHome(); break;
    case 'view-saved': renderResult(saved.results[chapter.id].score, 'Your original completed result. Replaying will not change it.'); break;
  }
});
$('#home-link').addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !chapter) return;
  event.preventDefault();
  returnHome();
});
$('#notebook-open').addEventListener('click', openNotebook);
$('#notebook-close').addEventListener('click', () => notebook.close());
$('#bonus-close').addEventListener('click', () => bonus.close());
$('#bonus-skip').addEventListener('click', () => bonus.close());
$('#bonus-reveal').addEventListener('click', revealBonusEvidence);
bonus.addEventListener('close', () => { if (!bonus.open) $('#bonus-content').replaceChildren(); });
$('#settings-open').addEventListener('click', () => {
  $('#sound-toggle').checked = preferences.sound;
  $('#dark-mode-toggle').checked = preferences.darkMode;
  $('#settings-feedback').textContent = '';
  settings.showModal();
});
$('#settings-close').addEventListener('click', () => settings.close());
$('#sound-toggle').addEventListener('change', event => {
  preferences.sound = event.target.checked;
  const outcome = savePreferences(storage, preferences);
  $('#settings-feedback').textContent = outcome.warning ?? 'Preferences saved.';
});
$('#dark-mode-toggle').addEventListener('change', event => {
  preferences.darkMode = event.target.checked;
  applyTheme();
  const outcome = savePreferences(storage, preferences);
  $('#settings-feedback').textContent = outcome.warning ?? 'Preferences saved.';
});
$('#clear-saved').addEventListener('click', () => {
  if (!window.confirm('Clear this game’s completed results and preferences? Your current run will also be discarded. Other sites, browser cache, and history will not be touched.')) return;
  const outcome = clearSaved(storage);
  if (!outcome.cleared) {
    $('#settings-feedback').textContent = outcome.warning;
    return;
  }
  saved = loadSaved(storage);
  preferences = { ...saved.preferences };
  applyTheme();
  settings.close();
  if (chapter) renderIntro(true);
  notice('This game’s saved data has been cleared. Browser cache and history were not changed.');
});
$('#debug-panel').hidden = !debug;
$('#debug-complete').addEventListener('click', () => {
  if (debug && stage === 'puzzle') acceptPuzzle(activeGame);
});
applyTheme();
notice(saved.warning);
loadChapter();
