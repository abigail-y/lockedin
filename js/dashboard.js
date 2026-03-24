/* ============================================================
   LOCKED IN FACTORY — Dashboard JS
   Reads from localStorage via storage.js helpers and
   renders all dashboard widgets.

   Init order (DOMContentLoaded):
   1. initNavbar()          — from utils.js
   2. renderGreeting()      — page header text
   3. renderStats()         — 4 stat cards
   4. renderSessionWidget() — subject dropdown, active session check
   5. renderAssignments()   — upcoming deadlines list
   6. renderProgress()      — daily/weekly bars + subject breakdown
   7. renderCalendar()      — mini calendar grid
   8. renderFlashcards()    — deck/card counts
   9. initModals()          — profile dropdown, edit name, add subject
   ============================================================ */

// ── Subject colors available in the Add Subject modal ─────
const SUBJECT_COLORS = [
  '#94C7B4', '#638872', '#C3C88C', '#30253E', '#808981',
  '#7ecfa8', '#5b8fa8', '#c4836a', '#a67bb5', '#d4a843',
];

let selectedColor = SUBJECT_COLORS[0];

// ── Entry Point ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  renderGreeting();
  renderStats();
  renderSessionWidget();
  renderAssignments();
  renderProgress();
  renderCalendar();
  renderFlashcards();
  initModals();
  initProfileDropdown();
});

// ── Greeting & Date ────────────────────────────────────────
function renderGreeting() {
  const settings = getSettings();
  const name     = settings.userName || 'there';
  const hour     = new Date().getHours();

  let timeOfDay = 'Good evening';
  if (hour < 12) timeOfDay = 'Good morning';
  else if (hour < 17) timeOfDay = 'Good afternoon';

  $id('greeting').textContent   = `${timeOfDay}, ${name} 👋`;
  $id('today-date').textContent = formatDateKey(todayKey(), {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

// ── Stats Strip ────────────────────────────────────────────
function renderStats() {
  // Streak
  $id('stat-streak').textContent = getStreak();

  // Today's minutes
  const daily = getDailyProgress();
  $id('stat-today').textContent     = formatMinutes(daily.minutes);
  $id('stat-today-goal').textContent = `/ ${formatMinutes(getGoals().dailyTargetMinutes)} goal`;

  // Weekly %
  const weekly = getWeeklyProgress();
  $id('stat-weekly').textContent = `${weekly.percent}%`;

  // Upcoming deadlines (next 7 days)
  const upcoming = getUpcomingAssignments(7);
  $id('stat-due').textContent = upcoming.length;
}

// ── Session Widget ─────────────────────────────────────────
function renderSessionWidget() {
  const subjects       = getActiveSubjects();
  const select         = $id('session-subject-select');
  const startBtn       = $id('start-session-btn');
  const noSubjectsHint = $id('no-subjects-hint');
  const activeBanner   = $id('active-session-banner');

  // Populate subject dropdown
  select.innerHTML = '<option value="">— Select subject —</option>';
  subjects.forEach(s => {
    const opt = createElement('option', { text: s.name, attrs: { value: s.id } });
    select.appendChild(opt);
  });

  if (subjects.length === 0) {
    show(noSubjectsHint);
    startBtn.classList.add('btn--secondary');
    startBtn.classList.remove('btn--primary');
  } else {
    hide(noSubjectsHint);
  }

  // Wire up start button — passes selected subject to session page via URL param
  startBtn.addEventListener('click', (e) => {
    const subjectId = select.value;
    if (subjectId) {
      e.preventDefault();
      window.location.href = `./pages/session.html?subject=${subjectId}`;
    }
    // If no subject selected, the <a> href navigates normally to session.html
  });

  // Check for an active session in localStorage
  const active = getActiveSession();
  if (active) {
    show(activeBanner);
    const subjectName = active.subjectId
      ? (getSubjectById(active.subjectId)?.name || 'Unknown subject')
      : 'General';
    $id('active-session-label').textContent = `${subjectName} — `;
    tickActiveSessionTimer(active.startTime);
  }
}

/**
 * Update the elapsed time display on the active session banner every second.
 */
function tickActiveSessionTimer(startTimeIso) {
  function update() {
    const elapsed = Math.floor((Date.now() - new Date(startTimeIso)) / 1000);
    $id('active-session-elapsed').textContent = formatSeconds(elapsed);
  }
  update();
  setInterval(update, 1000);
}

/**
 * Read the active session from localStorage.
 * Returns null if none is in progress.
 */
function getActiveSession() {
  try {
    const raw = localStorage.getItem('sp_active_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Assignments Widget ─────────────────────────────────────
function renderAssignments() {
  const list     = $id('assignments-list');
  const empty    = $id('assignments-empty');
  const upcoming = getUpcomingAssignments(14).slice(0, 5); // show max 5

  list.innerHTML = '';

  if (upcoming.length === 0) {
    hide(list);
    show(empty);
    return;
  }

  show(list);
  hide(empty);

  // Sort by due date ascending
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  upcoming.forEach(assignment => {
    const subject = assignment.subjectId
      ? getSubjectById(assignment.subjectId)
      : null;

    const item = createElement('li', { cls: 'assignment-item' });

    // Subject color dot
    const dot = createElement('span', { cls: 'assignment-item__subject-dot' });
    dot.style.backgroundColor = subject?.color || 'var(--color-neutral)';

    // Info
    const info = createElement('div', { cls: 'assignment-item__info' });
    info.appendChild(createElement('div', { cls: 'assignment-item__title', text: assignment.title }));
    info.appendChild(createElement('div', {
      cls:  'assignment-item__subject',
      text: subject?.name || 'No subject'
    }));

    // Due badge
    const dueWrap = createElement('div', { cls: 'assignment-item__due' });
    const badge   = createElement('span', {
      cls:  `badge ${dueDateBadgeClass(assignment.dueDate, assignment.completed)}`,
      text: dueDateLabel(assignment.dueDate)
    });
    dueWrap.appendChild(badge);

    item.appendChild(dot);
    item.appendChild(info);
    item.appendChild(dueWrap);
    list.appendChild(item);
  });
}

// ── Progress Widget ────────────────────────────────────────
function renderProgress() {
  const daily  = getDailyProgress();
  const weekly = getWeeklyProgress();
  const goals  = getGoals();

  // Daily bar
  $id('daily-progress-bar').style.width  = `${daily.percent}%`;
  $id('daily-progress-label').textContent =
    `${formatMinutes(daily.minutes)} / ${formatMinutes(goals.dailyTargetMinutes)}`;

  // Weekly bar
  $id('weekly-progress-bar').style.width  = `${weekly.percent}%`;
  $id('weekly-progress-label').textContent =
    `${formatMinutes(weekly.minutes)} / ${formatMinutes(goals.weeklyTargetMinutes)}`;

  // Subject breakdown for this week
  const breakdown = getWeeklySubjectBreakdown();
  const container = $id('subject-breakdown');
  const emptyEl   = $id('progress-empty');

  const entries = Object.entries(breakdown).filter(([, mins]) => mins > 0);

  if (entries.length === 0 && daily.minutes === 0) {
    show(emptyEl);
    container.innerHTML = '';
    return;
  }

  hide(emptyEl);
  container.innerHTML = '';

  if (entries.length === 0) return;

  const sectionTitle = createElement('p', {
    cls: 'text-xs text-subtle font-semibold',
    text: 'BY SUBJECT THIS WEEK',
    attrs: { style: 'letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: var(--space-2);' }
  });
  container.appendChild(sectionTitle);

  entries
    .sort(([, a], [, b]) => b - a)
    .forEach(([subjectId, minutes]) => {
      const subject = getSubjectById(subjectId);
      const row = createElement('div', { cls: 'subject-breakdown__item' });

      const dot = createElement('span', { cls: 'subject-breakdown__dot' });
      dot.style.backgroundColor = subject?.color || 'var(--color-neutral)';

      const name = createElement('span', {
        cls:  'subject-breakdown__name',
        text: subject?.name || 'Unknown'
      });

      const time = createElement('span', {
        cls:  'subject-breakdown__time',
        text: formatMinutes(minutes)
      });

      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(time);
      container.appendChild(row);
    });
}

// ── Mini Calendar ──────────────────────────────────────────

let calendarYear  = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0-indexed

function renderCalendar() {
  const grid      = $id('cal-grid');
  const monthLabel = $id('cal-month-label');
  const sessions  = getSessions();
  const assignments = getAssignments();

  // Build sets for fast lookup (YYYY-MM-DD keys)
  const sessionDates  = new Set(sessions.map(s => s.date));
  const deadlineDates = new Set(
    assignments.filter(a => !a.completed).map(a => a.dueDate)
  );

  const firstDay  = new Date(calendarYear, calendarMonth, 1);
  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today     = todayKey();

  // Week starts Monday: getDay() returns 0=Sun, so shift
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6; // Sunday → offset 6

  monthLabel.textContent = firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  grid.innerHTML = '';

  // Day headers
  ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
    grid.appendChild(createElement('div', { cls: 'cal-day-header', text: d }));
  });

  // Empty cells before day 1
  for (let i = 0; i < startOffset; i++) {
    grid.appendChild(createElement('div', { cls: 'cal-day cal-day--empty' }));
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const mm   = String(calendarMonth + 1).padStart(2, '0');
    const dd   = String(day).padStart(2, '0');
    const key  = `${calendarYear}-${mm}-${dd}`;

    const cell  = createElement('div', { cls: 'cal-day' });
    const label = createElement('span', { text: String(day) });
    cell.appendChild(label);

    if (key === today) cell.classList.add('cal-day--today');

    // Dots
    const hasSessions  = sessionDates.has(key);
    const hasDeadlines = deadlineDates.has(key);

    if (hasSessions || hasDeadlines) {
      const dots = createElement('div', { cls: 'cal-day__dots' });
      if (hasSessions)  dots.appendChild(createElement('span', { cls: 'cal-day__dot cal-day__dot--session' }));
      if (hasDeadlines) dots.appendChild(createElement('span', { cls: 'cal-day__dot cal-day__dot--deadline' }));
      cell.appendChild(dots);
    }

    // Clicking a day on the mini calendar navigates to the full calendar
    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      window.location.href = `./pages/calendar.html?date=${key}`;
    });

    grid.appendChild(cell);
  }

  // Prev / next month navigation
  $id('cal-prev').onclick = () => {
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
  };

  $id('cal-next').onclick = () => {
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
  };
}

// ── Flashcards Widget ──────────────────────────────────────
function renderFlashcards() {
  const decks      = getDecks();
  const totalCards = decks.reduce((sum, d) => sum + (d.cards?.length || 0), 0);
  const meta       = $id('flashcards-meta');
  const reviewBtn  = $id('flashcards-review-btn');

  if (decks.length === 0) {
    meta.textContent       = 'No decks yet — create your first deck to start reviewing.';
    reviewBtn.textContent  = 'Get Started →';
  } else {
    meta.textContent = `${decks.length} deck${decks.length !== 1 ? 's' : ''} · ${totalCards} card${totalCards !== 1 ? 's' : ''}`;
  }
}

// ── Profile Dropdown ───────────────────────────────────────
function initProfileDropdown() {
  const btn      = $id('profile-btn');
  const dropdown = $id('profile-dropdown');

  // Load saved name
  const settings = getSettings();
  if (settings.userName) {
    $id('profile-name').textContent = settings.userName;
  }

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', isOpen);
    dropdown.setAttribute('aria-hidden', !isOpen);
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
  });

  // Edit name → open modal
  $id('edit-name-btn').addEventListener('click', () => {
    $id('name-input').value = getSettings().userName || '';
    openModal('edit-name-modal');
  });

  // Clear all data
  $id('clear-data-btn').addEventListener('click', () => {
    const confirmed = window.confirm(
      'This will clear ALL your study data (sessions, assignments, flashcards, subjects). This cannot be undone.\n\nAre you sure?'
    );
    if (confirmed) {
      ['sp_subjects', 'sp_sessions', 'sp_assignments', 'sp_decks',
       'sp_goals', 'sp_settings', 'sp_active_session'].forEach(k => {
        localStorage.removeItem(k);
      });
      showToast('All data cleared.', 'warning');
      setTimeout(() => location.reload(), 1200);
    }
  });
}

// ── Modals ─────────────────────────────────────────────────
function initModals() {
  // Close buttons with data-close attribute
  $qsa('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Backdrop close
  enableBackdropClose('edit-name-modal');
  enableBackdropClose('add-subject-modal');

  // Save name
  $id('save-name-btn').addEventListener('click', () => {
    const name = $id('name-input').value.trim();
    if (!name) { showToast('Please enter a name.', 'warning'); return; }
    const settings = getSettings();
    settings.userName = name;
    saveSettings(settings);
    $id('profile-name').textContent = name;
    renderGreeting();
    closeModal('edit-name-modal');
    showToast(`Name updated to "${name}"!`, 'success');
  });

  // Add Subject button
  $id('add-subject-btn').addEventListener('click', () => {
    renderColorPicker();
    openModal('add-subject-modal');
  });

  // Save subject
  $id('save-subject-btn').addEventListener('click', () => {
    const name  = $id('subject-name-input').value.trim();
    const icon  = $id('subject-icon-input').value.trim() || '📚';
    if (!name) { showToast('Please enter a subject name.', 'warning'); return; }

    saveSubject({ name, color: selectedColor, icon });
    closeModal('add-subject-modal');
    showToast(`Subject "${name}" added!`, 'success');

    // Reset form
    $id('subject-name-input').value = '';
    $id('subject-icon-input').value = '';

    // Re-render affected widgets
    renderStats();
    renderSessionWidget();
    renderProgress();
  });
}

// ── Color Picker (Add Subject Modal) ──────────────────────
function renderColorPicker() {
  const picker = $id('color-picker');
  picker.innerHTML = '';
  selectedColor = SUBJECT_COLORS[0];

  SUBJECT_COLORS.forEach((color, i) => {
    const swatch = createElement('button', {
      cls:   `color-swatch${i === 0 ? ' selected' : ''}`,
      attrs: { type: 'button', 'aria-label': color }
    });
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => {
      $qsa('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = color;
    });
    picker.appendChild(swatch);
  });
}
