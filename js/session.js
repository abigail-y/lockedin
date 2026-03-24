/* ============================================================
   LOCKED IN FACTORY — Session Page JS

   Responsibilities:
   1. Check if API is reachable (online/offline mode)
   2. Populate subject dropdown from localStorage
   3. Start session → POST /api/sessions/start + localStorage
   4. Live timer tick during active session
   5. End session → POST /api/sessions/end + localStorage
   6. Toggle dark focus mode (body.session-active)
   7. Load recent sessions from API (falls back to localStorage)
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';

// ── State ──────────────────────────────────────────────────
let timerInterval = null;   // setInterval handle for the live clock
let selectedMood  = 'neutral';
let apiOnline     = false;

// ── Entry Point ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  ensureUserId();
  populateSubjectDropdown();

  apiOnline = await checkApiAvailable();
  showApiBanner(apiOnline);

  // If a session was already in progress (page refresh mid-session), restore it
  const active = getActiveSession();
  if (active) {
    enterFocusMode(active);
  }

  // Check for ?subject= URL param (coming from dashboard quick-start)
  const params    = new URLSearchParams(window.location.search);
  const preselect = params.get('subject');
  if (preselect) {
    const select = $id('subject-select');
    if (select) select.value = preselect;
  }

  loadRecentSessions();
  wireButtons();
});

// ── User ID ────────────────────────────────────────────────
/**
 * Generate and persist a userId in localStorage if one doesn't exist.
 * This ties MongoDB sessions to a specific browser without requiring auth.
 */
function ensureUserId() {
  if (!localStorage.getItem('sp_user_id')) {
    localStorage.setItem('sp_user_id', crypto.randomUUID());
  }
}

function getUserId() {
  return localStorage.getItem('sp_user_id') || 'anonymous';
}

// ── API Availability ───────────────────────────────────────
async function checkApiAvailable() {
  try {
    const res = await fetch(`${API_BASE}/sessions/ping`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function showApiBanner(online) {
  const banner = $id('api-banner');
  const text   = $id('api-banner-text');
  if (!banner) return;

  banner.classList.remove('hidden', 'api-banner--online', 'api-banner--offline');

  if (online) {
    banner.classList.add('api-banner--online');
    text.textContent = '🟢 Connected to server — sessions are saved to the database.';
  } else {
    banner.classList.add('api-banner--offline');
    text.textContent = '🟡 Server offline — sessions are saved locally only. Start the server with: npm run dev';
  }

  show(banner);

  // Auto-hide the "online" banner after 4s to keep the UI clean
  if (online) {
    setTimeout(() => hide(banner), 4000);
  }
}

// ── Subject Dropdown ───────────────────────────────────────
function populateSubjectDropdown() {
  const select   = $id('subject-select');
  const subjects = getActiveSubjects();

  select.innerHTML = '<option value="">— Select subject —</option>';
  subjects.forEach(s => {
    const opt = createElement('option', {
      text:  `${s.icon || '📚'} ${s.name}`,
      attrs: { value: s.id },
    });
    select.appendChild(opt);
  });

  if (subjects.length === 0) {
    show($id('no-subjects-msg'));
  } else {
    hide($id('no-subjects-msg'));
  }
}

// ── Wire Buttons ───────────────────────────────────────────
function wireButtons() {
  $id('start-btn').addEventListener('click', handleStartSession);
  $id('end-btn').addEventListener('click', showEndPanel);
  $id('cancel-end-btn').addEventListener('click', hideEndPanel);
  $id('confirm-end-btn').addEventListener('click', handleEndSession);
  $id('minimize-btn').addEventListener('click', handleMinimize);

  // Mini timer expand event dispatched by utils.js when widget is clicked on session page
  document.addEventListener('mini-timer-expand', () => {
    const active = getActiveSession();
    if (active) enterFocusMode(active);
  });

  // Mood selector
  $qsa('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $qsa('.mood-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      selectedMood = btn.dataset.mood;
    });
  });
}

// ── Start Session ──────────────────────────────────────────
async function handleStartSession() {
  const subjectId   = $id('subject-select').value;
  const preNotes    = $id('session-notes-pre').value.trim();
  const subjects    = getActiveSubjects();
  const subject     = subjects.find(s => s.id === subjectId) || null;
  const subjectName = subject?.name || 'General';

  let sessionData;

  if (apiOnline) {
    // ── Online: persist to MongoDB ──
    try {
      const res  = await fetch(`${API_BASE}/sessions/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          userId:      getUserId(),
          subjectId:   subjectId || null,
          subjectName,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to start session');

      sessionData = {
        mongoId:     data.session._id,
        subjectId:   subjectId || null,
        subjectName,
        subjectColor: subject?.color || null,
        subjectIcon:  subject?.icon  || '📚',
        startTime:   data.session.startTime,
        notes:       preNotes,
      };

      if (data.resumed) {
        showToast('Resumed an existing open session.', 'teal');
      }

    } catch (err) {
      console.error('API start failed:', err);
      showToast('Could not reach server. Saving locally.', 'warning');
      apiOnline = false;
      sessionData = buildLocalSession(subjectId, subjectName, subject, preNotes);
    }
  } else {
    // ── Offline: localStorage only ──
    sessionData = buildLocalSession(subjectId, subjectName, subject, preNotes);
  }

  // Persist active session to localStorage so it survives a page refresh
  localStorage.setItem('sp_active_session', JSON.stringify(sessionData));

  enterFocusMode(sessionData);
}

function buildLocalSession(subjectId, subjectName, subject, notes) {
  return {
    mongoId:      null,
    subjectId:    subjectId || null,
    subjectName,
    subjectColor: subject?.color || null,
    subjectIcon:  subject?.icon  || '📚',
    startTime:    new Date().toISOString(),
    notes,
  };
}

// ── End Session ────────────────────────────────────────────
function showEndPanel() {
  const active = getActiveSession();
  if (!active) return;

  const elapsed = Math.floor((Date.now() - new Date(active.startTime)) / 60000);
  $id('end-duration-display').textContent = formatMinutes(elapsed) || '< 1m';
  show($id('end-panel'));
}

function hideEndPanel() {
  hide($id('end-panel'));
}

async function handleEndSession() {
  const active = getActiveSession();
  if (!active) return;

  const endTime         = new Date();
  const durationMinutes = Math.round((endTime - new Date(active.startTime)) / 60000);
  const notes           = $id('session-notes-active').value.trim()
                        || active.notes
                        || '';

  // ── 1. Call API if online and we have a mongoId ──────────
  if (apiOnline && active.mongoId) {
    try {
      const res = await fetch(`${API_BASE}/sessions/end`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sessionId: active.mongoId,
          notes,
          mood: selectedMood,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('API end failed:', err.error);
      }
    } catch (err) {
      console.error('API end error:', err);
    }
  }

  // ── 2. Always save to localStorage as well ───────────────
  const localSession = {
    id:              generateId(),
    subjectId:       active.subjectId,
    date:            toDateKey(new Date(active.startTime)),
    startTime:       active.startTime,
    endTime:         endTime.toISOString(),
    durationMinutes,
    notes,
    mood:            selectedMood,
    tags:            [],
  };

  saveSession(localSession);

  // ── 3. Clear the active session ──────────────────────────
  localStorage.removeItem('sp_active_session');

  // ── 4. Exit focus mode ───────────────────────────────────
  exitFocusMode();

  showToast(`Session saved! You studied for ${formatMinutes(durationMinutes)}.`, 'success');
  loadRecentSessions();
}

// ── Focus Mode (Dark UI) ───────────────────────────────────
function enterFocusMode(sessionData) {
  // Ensure dark theme is on
  document.body.classList.add('session-active');

  // Hide mini timer (we're in full-screen focus — no need for corner widget)
  hideMiniTimer();

  // Lock scroll behind the overlay
  document.body.classList.add('focus-mode');

  // Hide idle view, show focus overlay
  hide($id('idle-view'));
  show($id('active-view'));
  hide($id('end-panel'));

  // Populate subject info
  $id('focus-subject-icon').textContent = sessionData.subjectIcon || '📚';
  $id('focus-subject-name').textContent = sessionData.subjectName || 'General';

  // Restore any notes already typed
  $id('session-notes-active').value = sessionData.notes || '';

  // Start the live focus timer
  startTimer(sessionData.startTime);
}

/**
 * Minimize: collapse full-screen overlay → floating corner widget.
 * Dark mode stays on. User can still navigate the site.
 */
function handleMinimize() {
  // Stop the large focus timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Restore scroll + hide overlay, but keep dark theme
  document.body.classList.remove('focus-mode');
  hide($id('active-view'));
  show($id('idle-view'));
  hide($id('end-panel'));

  // Show the floating mini timer in the corner
  const active = getActiveSession();
  if (active) renderMiniTimer(active);
}

function exitFocusMode() {
  // Stop the focus timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Session is done — remove dark theme and mini timer entirely
  removeMiniTimer(); // clears dark class + widget

  document.body.classList.remove('focus-mode');

  // Show idle view, hide focus overlay
  show($id('idle-view'));
  hide($id('active-view'));
  hide($id('end-panel'));

  // Reset end panel state
  selectedMood = 'neutral';
  $qsa('.mood-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
  $id('session-notes-active').value = '';
}

// ── Live Timer ─────────────────────────────────────────────
function startTimer(startTimeIso) {
  if (timerInterval) clearInterval(timerInterval);

  function tick() {
    const elapsed = Math.floor((Date.now() - new Date(startTimeIso)) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    $id('focus-timer').textContent = `${h}:${m}:${s}`;
  }

  tick(); // immediate first render
  timerInterval = setInterval(tick, 1000);
}

// ── Recent Sessions ────────────────────────────────────────
let currentSkip  = 0;
const PAGE_SIZE  = 10;

async function loadRecentSessions(append = false) {
  const list    = $id('recent-list');
  const empty   = $id('recent-empty');
  const loadBtn = $id('load-more-btn');
  const countEl = $id('sessions-count');

  if (!append) {
    currentSkip  = 0;
    list.innerHTML = '';
  }

  let sessions = [];
  let total    = 0;

  if (apiOnline) {
    try {
      const res  = await fetch(
        `${API_BASE}/sessions?userId=${getUserId()}&limit=${PAGE_SIZE}&skip=${currentSkip}`
      );
      const data = await res.json();
      sessions   = data.sessions || [];
      total      = data.total    || 0;
    } catch {
      sessions = getLocalSessions();
      total    = sessions.length;
    }
  } else {
    const all = getSessions()
      .filter(s => s.durationMinutes > 0)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
    sessions = all.slice(currentSkip, currentSkip + PAGE_SIZE);
    total    = all.length;
  }

  if (sessions.length === 0 && currentSkip === 0) {
    show(empty);
    hide(loadBtn);
    countEl.textContent = '';
    return;
  }

  hide(empty);
  countEl.textContent = `${total} total`;

  sessions.forEach(s => list.appendChild(buildRecentItem(s)));

  currentSkip += sessions.length;
  toggleVisibility(loadBtn, currentSkip < total);

  if (!append) {
    loadBtn.onclick = () => loadRecentSessions(true);
  }
}

/**
 * Normalise a session from MongoDB or localStorage into a display item.
 */
function buildRecentItem(s) {
  // MongoDB sessions use startTime as ISO string or Date
  // localStorage sessions also use startTime ISO string
  const start   = new Date(s.startTime);
  const dateStr = toDateKey(start);
  const subject = s.subjectId ? getSubjectById(s.subjectId) : null;
  const color   = subject?.color || s.subjectColor || 'var(--color-neutral)';
  const name    = subject?.name  || s.subjectName  || 'General';
  const dur     = s.durationMinutes || Math.round((new Date(s.endTime) - start) / 60000) || 0;

  const moodEmoji = { focused: '😊', neutral: '😐', distracted: '😵' };

  const item = createElement('li', { cls: 'recent-item' });

  // Color dot
  const dot = createElement('span', { cls: 'recent-item__dot' });
  dot.style.backgroundColor = color;

  // Info
  const info = createElement('div', { cls: 'recent-item__info' });
  info.appendChild(createElement('div', { cls: 'recent-item__subject', text: name }));
  info.appendChild(createElement('div', {
    cls:  'recent-item__date',
    text: isToday(dateStr) ? 'Today' : formatDateKey(dateStr, { weekday: 'short', month: 'short', day: 'numeric' }),
  }));

  // Mood
  const mood = createElement('span', {
    cls:  'recent-item__mood',
    text: moodEmoji[s.mood] || '😐',
    attrs: { title: s.mood || 'neutral' }
  });

  // Duration + notes
  const meta = createElement('div', { cls: 'recent-item__meta' });
  meta.appendChild(createElement('div', { cls: 'recent-item__duration', text: formatMinutes(dur) }));
  if (s.notes) {
    meta.appendChild(createElement('div', { cls: 'recent-item__notes', text: s.notes }));
  }

  item.appendChild(dot);
  item.appendChild(info);
  item.appendChild(mood);
  item.appendChild(meta);
  return item;
}

/**
 * Get completed sessions from localStorage for offline fallback.
 */
function getLocalSessions() {
  return getSessions()
    .filter(s => s.durationMinutes > 0)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, PAGE_SIZE);
}
