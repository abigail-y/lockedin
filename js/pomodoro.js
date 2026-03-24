/* ============================================================
   LOCKED IN FACTORY — Pomodoro Timer

   STATE FIELDS  (mirrors the React state you described)
   ─────────────────────────────────────────────────────────
   currentTime:    number   — seconds remaining (counts down)
   isRunning:      boolean  — whether the interval is ticking
   mode:           string   — 'focus' | 'break'
   focusDuration:  number   — focus length in minutes
   breakDuration:  number   — break length in minutes

   useEffect EQUIVALENTS
   ─────────────────────────────────────────────────────────
   effect_isRunning()    — React: useEffect([isRunning])
                           Starts or clears the setInterval
                           whenever isRunning flips.

   effect_currentTime()  — React: useEffect([currentTime])
                           Updates the DOM display, the SVG
                           ring offset, and triggers mode
                           switch when currentTime hits 0.

   effect_mode()         — React: useEffect([mode])
                           Swaps colors, labels, tab styles,
                           and resets currentTime to the new
                           mode's duration.
   ============================================================ */

// ── SVG Ring constant ──────────────────────────────────────
const RING_RADIUS        = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 565.49

// ── Pomodoro tips shown in the sidebar card ────────────────
const TIPS = [
  'After 4 focus sessions, take a longer 15–20 min break.',
  'Remove your phone from the desk during focus time.',
  'Write down distracting thoughts — deal with them later.',
  'Close all unrelated browser tabs before starting.',
  'Drink water before each focus session.',
  'Treat the Pomodoro as a unit of effort, not time.',
];

// ── State ──────────────────────────────────────────────────
// All five fields the spec requires.
const state = {
  currentTime:   25 * 60,  // seconds remaining
  isRunning:     false,
  mode:          'focus',  // 'focus' | 'break'
  focusDuration: 25,       // minutes
  breakDuration: 5,        // minutes
};

// Internal: interval handle managed by effect_isRunning
let _intervalId = null;

// Completed sessions logged this page session
let _completedToday = [];

// ── Entry Point ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  loadSavedDurations();
  loadTodayLog();
  renderTip();

  // Initial render — reflect starting state in the DOM
  effect_mode();       // sets ring color, labels, tab style
  effect_currentTime(); // sets display + ring offset
  effect_isRunning();   // ensures interval matches isRunning (false → no interval)

  wireControls();
});

// ══════════════════════════════════════════════════════════
//  useEffect EQUIVALENTS
// ══════════════════════════════════════════════════════════

/**
 * effect_isRunning — React: useEffect(() => { ... }, [isRunning])
 *
 * Manages the setInterval lifecycle.
 * • isRunning = true  → start a 1-second interval that calls tick()
 * • isRunning = false → clear the interval (pause)
 *
 * Always clears before potentially restarting to avoid stacking intervals.
 */
function effect_isRunning() {
  // Cleanup (equivalent to the useEffect return/cleanup function)
  clearInterval(_intervalId);
  _intervalId = null;

  if (state.isRunning) {
    _intervalId = setInterval(tick, 1000);
  }

  // Sync the start/pause button label
  const btn = $id('start-pause-btn');
  if (state.isRunning) {
    btn.textContent = '⏸ Pause';
    btn.classList.add('is-running');
    if (state.mode === 'break') btn.classList.add('break-mode');
  } else {
    btn.textContent = state.mode === 'focus' ? '▶ Start' : '▶ Start Break';
    btn.classList.remove('is-running', 'break-mode');
    if (state.mode === 'break') btn.classList.add('break-mode');
  }
}

/**
 * effect_currentTime — React: useEffect(() => { ... }, [currentTime])
 *
 * Runs every second (called from tick) and on resets/mode switches.
 * Updates:
 *   1. The MM:SS time display
 *   2. The SVG ring stroke-dashoffset
 *   3. If currentTime === 0, fires handleTimerEnd()
 */
function effect_currentTime() {
  const totalSeconds = (state.mode === 'focus'
    ? state.focusDuration
    : state.breakDuration) * 60;

  // 1. Update the text display
  const mm = String(Math.floor(state.currentTime / 60)).padStart(2, '0');
  const ss = String(state.currentTime % 60).padStart(2, '0');
  $id('timer-display').textContent = `${mm}:${ss}`;

  // 2. Update browser tab title
  const modeLabel = state.mode === 'focus' ? 'Focus' : 'Break';
  document.title = `${mm}:${ss} — ${modeLabel} | Locked In Factory`;

  // 3. Update the SVG ring offset
  //    offset = circumference × (1 − progress)
  //    full ring (start) = 0 offset; empty ring (done) = full circumference
  const progress = totalSeconds > 0 ? state.currentTime / totalSeconds : 0;
  const offset   = RING_CIRCUMFERENCE * (1 - progress);
  $id('ring-fill').style.strokeDashoffset = offset;

  // 4. Check for completion
  if (state.currentTime === 0) {
    handleTimerEnd();
  }
}

/**
 * effect_mode — React: useEffect(() => { ... }, [mode])
 *
 * Updates all visual indicators when the mode changes:
 *   - Ring stroke color
 *   - Mode label text + color
 *   - Active tab highlight
 *   - Start button style
 *   - Resets currentTime to the new mode's duration
 */
function effect_mode() {
  const ringFill  = $id('ring-fill');
  const modeLabel = $id('timer-mode-label');
  const isFocus   = state.mode === 'focus';

  // Ring color
  ringFill.classList.toggle('break-mode', !isFocus);

  // Center mode label
  modeLabel.textContent = isFocus ? 'FOCUS' : 'BREAK';
  modeLabel.classList.toggle('break-mode', !isFocus);

  // Tab active state
  $id('tab-focus').classList.toggle('mode-tab--active', isFocus);
  $id('tab-focus').setAttribute('aria-selected', isFocus);
  $id('tab-break').classList.toggle('mode-tab--active', !isFocus);
  $id('tab-break').setAttribute('aria-selected', !isFocus);

  // Reset currentTime to the correct duration for this mode
  state.currentTime = (isFocus ? state.focusDuration : state.breakDuration) * 60;

  // Re-run time effect to update display and ring position
  effect_currentTime();

  // Re-run isRunning effect to update button label/style
  effect_isRunning();
}

// ══════════════════════════════════════════════════════════
//  CORE TIMER LOGIC
// ══════════════════════════════════════════════════════════

/**
 * tick — called by setInterval every 1000ms.
 * Decreases currentTime by 1. Stops at 0.
 * effect_currentTime handles the 0 case (mode switch).
 */
function tick() {
  if (state.currentTime > 0) {
    state.currentTime -= 1;
  }
  // Always run the display effect after each tick
  effect_currentTime();
}

/**
 * handleTimerEnd — called by effect_currentTime when currentTime === 0.
 *
 * 1. Stops the running interval
 * 2. Plays an audio notification
 * 3. If completing a FOCUS session → log it, show toast
 * 4. Switches to the next mode (focus → break, break → focus)
 */
function handleTimerEnd() {
  // Stop the interval first
  state.isRunning = false;
  effect_isRunning();

  // Visual feedback on ring
  const ring = $qs('.timer-ring');
  ring.classList.add('complete');
  setTimeout(() => ring.classList.remove('complete'), 1100);

  // Audio beep
  playBeep();

  if (state.mode === 'focus') {
    // Log the completed focus session
    const entry = logCompletedPomodoro();
    renderTodayLog();
    showToast(`🍅 Focus session done! ${entry.duration} min logged.`, 'success');
    // Switch to break
    switchMode('break');
  } else {
    // Break finished → back to focus
    showToast('☕ Break over — time to focus!', 'teal');
    switchMode('focus');
  }
}

/**
 * Switch to a new mode and reset the timer.
 * Equivalent to calling setMode() + setCurrentTime() together in React.
 * @param {'focus'|'break'} newMode
 */
function switchMode(newMode) {
  state.mode      = newMode;
  state.isRunning = false;
  effect_mode(); // resets currentTime, updates UI, stops interval
}

// ══════════════════════════════════════════════════════════
//  CONTROLS: Start / Pause / Reset / Skip
// ══════════════════════════════════════════════════════════

function handleStartPause() {
  state.isRunning = !state.isRunning;
  effect_isRunning();
}

/**
 * Reset — stop the timer and return currentTime to the
 * full duration of the current mode.
 */
function handleReset() {
  state.isRunning   = false;
  state.currentTime = (state.mode === 'focus'
    ? state.focusDuration
    : state.breakDuration) * 60;

  effect_isRunning();
  effect_currentTime();

  // Shake animation on the display
  const display = $id('timer-display');
  display.classList.add('shake');
  setTimeout(() => display.classList.remove('shake'), 400);
}

/**
 * Skip — immediately jump to the next mode without logging.
 */
function handleSkip() {
  const next = state.mode === 'focus' ? 'break' : 'focus';
  switchMode(next);
}

/**
 * Manual mode tab click — only allowed when timer is not running.
 * @param {'focus'|'break'} newMode
 */
function handleTabClick(newMode) {
  if (state.isRunning) {
    showToast('Pause the timer before switching modes.', 'warning');
    return;
  }
  if (newMode === state.mode) return;
  switchMode(newMode);
}

// ══════════════════════════════════════════════════════════
//  DURATION SETTINGS
// ══════════════════════════════════════════════════════════

/**
 * Adjust a duration by delta (±1 minute).
 * Range: focus 1–90 min, break 1–30 min.
 * If the current mode matches the changed duration and the timer
 * is not running, reset currentTime to reflect the change.
 * @param {'focus'|'break'} target
 * @param {number} delta  — +1 or -1
 */
function adjustDuration(target, delta) {
  if (state.isRunning) {
    showToast('Pause the timer to change durations.', 'warning');
    return;
  }

  const max = target === 'focus' ? 90 : 30;
  const min = 1;

  if (target === 'focus') {
    state.focusDuration = clamp(state.focusDuration + delta, min, max);
    $id('focus-dur-display').textContent = state.focusDuration;
  } else {
    state.breakDuration = clamp(state.breakDuration + delta, min, max);
    $id('break-dur-display').textContent = state.breakDuration;
  }

  // If we changed the active mode's duration, update currentTime
  if (target === state.mode) {
    state.currentTime = (target === 'focus'
      ? state.focusDuration
      : state.breakDuration) * 60;
    effect_currentTime();
  }

  saveDurations();
}

/**
 * Persist durations to localStorage settings so they survive page reload.
 */
function saveDurations() {
  const settings = getSettings();
  settings.pomodoroFocusDuration = state.focusDuration;
  settings.pomodoroBreakDuration = state.breakDuration;
  saveSettings(settings);
}

/**
 * Load saved durations from settings on page load.
 */
function loadSavedDurations() {
  const settings = getSettings();
  if (settings.pomodoroFocusDuration) {
    state.focusDuration = settings.pomodoroFocusDuration;
  }
  if (settings.pomodoroBreakDuration) {
    state.breakDuration = settings.pomodoroBreakDuration;
  }
  state.currentTime = state.focusDuration * 60;

  $id('focus-dur-display').textContent = state.focusDuration;
  $id('break-dur-display').textContent = state.breakDuration;
}

// ══════════════════════════════════════════════════════════
//  POMODORO LOG
// ══════════════════════════════════════════════════════════

const LOG_KEY = 'sp_pomodoro_log';

/**
 * Log a completed focus session.
 * @returns {object} the entry that was saved
 */
function logCompletedPomodoro() {
  const entry = {
    id:          generateId(),
    date:        todayKey(),
    duration:    state.focusDuration,
    completedAt: new Date().toISOString(),
  };

  const log = getAll(LOG_KEY);
  log.push(entry);
  saveAll(LOG_KEY, log);
  _completedToday.push(entry);

  return entry;
}

/**
 * Load today's completed pomodoros from localStorage.
 */
function loadTodayLog() {
  const today  = todayKey();
  const allLog = getAll(LOG_KEY);
  _completedToday = allLog.filter(e => e.date === today);
  renderTodayLog();
}

/**
 * Render the pomodoro dot log in the sidebar.
 */
function renderTodayLog() {
  const dotsEl   = $id('log-dots');
  const emptyEl  = $id('log-empty');
  const totalEl  = $id('log-total');
  const summaryEl = $id('log-summary');

  const count = _completedToday.length;
  summaryEl.textContent = `${count} session${count !== 1 ? 's' : ''}`;

  if (count === 0) {
    dotsEl.innerHTML = '';
    show(emptyEl);
    totalEl.textContent = '';
    return;
  }

  hide(emptyEl);
  dotsEl.innerHTML = '';

  _completedToday.forEach(entry => {
    const item = createElement('div', { cls: 'log-dot-item' });
    item.appendChild(createElement('span', { cls: 'log-dot-emoji', text: '🍅' }));
    item.appendChild(createElement('span', {
      cls:  'log-dot-time',
      text: formatTime(entry.completedAt),
    }));
    dotsEl.appendChild(item);
  });

  const totalMins = _completedToday.reduce((s, e) => s + e.duration, 0);
  totalEl.textContent = `Total focus time: ${formatMinutes(totalMins)}`;

  // Also update the in-ring pomodoro count
  renderRingPomodoros(count);
}

/**
 * Show small tomato dots inside the SVG ring center.
 * Shows max 4, then "+N" text.
 */
function renderRingPomodoros(count) {
  const el = $id('timer-pomodoros');
  el.innerHTML = '';
  const display = Math.min(count, 4);
  for (let i = 0; i < display; i++) {
    el.appendChild(createElement('span', { cls: 'pomo-dot', text: '🍅' }));
  }
  if (count > 4) {
    el.appendChild(createElement('span', {
      cls:  'pomo-dot',
      text: `+${count - 4}`,
      attrs: { style: 'font-size: 0.65rem; color: var(--color-text-subtle);' },
    }));
  }
}

// ══════════════════════════════════════════════════════════
//  AUDIO NOTIFICATION
// ══════════════════════════════════════════════════════════

/**
 * Play a short two-tone beep using the Web Audio API.
 * Gracefully fails if the browser blocks audio.
 */
function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    [[440, 0, 0.15], [550, 0.2, 0.15]].forEach(([freq, start, dur]) => {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch {
    // Audio unavailable — no-op
  }
}

// ══════════════════════════════════════════════════════════
//  TIPS
// ══════════════════════════════════════════════════════════

function renderTip() {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  $id('tip-text').textContent = `💡 ${tip}`;
}

// ══════════════════════════════════════════════════════════
//  WIRE UP EVENT LISTENERS
// ══════════════════════════════════════════════════════════

function wireControls() {
  // Start / Pause
  $id('start-pause-btn').addEventListener('click', handleStartPause);

  // Reset
  $id('reset-btn').addEventListener('click', handleReset);

  // Skip
  $id('skip-btn').addEventListener('click', handleSkip);

  // Mode tabs
  $qsa('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => handleTabClick(tab.dataset.mode));
  });

  // Duration adjusters — use event delegation on each settings row
  $qsa('.dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adjustDuration(btn.dataset.target, Number(btn.dataset.delta));
    });
  });

  // Keyboard shortcut: Space = start/pause, R = reset, S = skip
  document.addEventListener('keydown', (e) => {
    // Ignore if focus is in an input
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space')  { e.preventDefault(); handleStartPause(); }
    if (e.code === 'KeyR')   handleReset();
    if (e.code === 'KeyS')   handleSkip();
  });
}
