/* ============================================================
   LOCKED IN FACTORY — Calendar JS

   Data sources shown on the calendar:
     • Events    — created here, saved to MongoDB + localStorage fallback
     • Sessions  — read-only from sp_sessions (localStorage)
     • Assignments — read-only from sp_assignments (localStorage)

   State:
     year, month     — currently displayed month
     selectedDate    — YYYY-MM-DD of the clicked day
     events          — array of Event objects for current month
     apiOnline       — whether the server is reachable
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';
const LOCAL_EVENTS_KEY = 'sp_events'; // localStorage fallback key

// ── State ──────────────────────────────────────────────────
const state = {
  year:         new Date().getFullYear(),
  month:        new Date().getMonth(), // 0-indexed
  selectedDate: todayKey(),
  events:       [],
  apiOnline:    false,
};

// ── Entry Point ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  // Pre-select date from URL param (?date=YYYY-MM-DD)
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const d = new Date(dateParam + 'T00:00:00');
    state.year         = d.getFullYear();
    state.month        = d.getMonth();
    state.selectedDate = dateParam;
  }

  state.apiOnline = await checkApi();
  showApiBanner(state.apiOnline);

  await loadEvents();
  renderCalendar();
  renderDayPanel(state.selectedDate);

  wireButtons();
  wireModal();
  wireDescCharCount();
});

// ── API Health Check ───────────────────────────────────────
async function checkApi() {
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
  banner.classList.remove('hidden', 'api-banner--online', 'api-banner--offline');
  if (online) {
    banner.classList.add('api-banner--online');
    text.textContent = '🟢 Connected — events are saved to the database.';
    setTimeout(() => hide(banner), 4000);
  } else {
    banner.classList.add('api-banner--offline');
    text.textContent = '🟡 Server offline — events are saved locally only.';
  }
  show(banner);
}

// ── Load Events ────────────────────────────────────────────
/**
 * Fetch events for the current month from the API (or localStorage).
 * Populates state.events.
 */
async function loadEvents() {
  const month  = `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
  const userId = getUserId();

  if (state.apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/events?userId=${userId}&month=${month}`);
      const data = await res.json();
      if (res.ok) {
        state.events = data.events || [];
        return;
      }
    } catch {
      // fall through to localStorage
    }
  }

  // Offline fallback: filter local events by month
  state.events = getAll(LOCAL_EVENTS_KEY).filter(e =>
    e.date && e.date.startsWith(month)
  );
}

function getUserId() {
  if (!localStorage.getItem('sp_user_id')) {
    localStorage.setItem('sp_user_id', crypto.randomUUID());
  }
  return localStorage.getItem('sp_user_id');
}

// ── Calendar Rendering ─────────────────────────────────────
function renderCalendar() {
  const grid       = $id('cal-grid');
  const heading    = $id('cal-month-heading');
  const firstDay   = new Date(state.year, state.month, 1);
  const totalDays  = new Date(state.year, state.month + 1, 0).getDate();
  const today      = todayKey();

  heading.textContent = firstDay.toLocaleString('en-US', {
    month: 'long', year: 'numeric',
  });

  grid.innerHTML = '';

  // Week starts Monday: getDay() 0=Sun → offset 6, 1=Mon → 0 etc.
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  // Build lookup maps for fast cell rendering
  const eventsByDate     = buildEventMap(state.events);
  const sessionsByDate   = buildSessionMap();
  const assignmentsByDate = buildAssignmentMap();

  // Empty filler cells
  for (let i = 0; i < startOffset; i++) {
    grid.appendChild(createElement('div', { cls: 'cal-cell cal-cell--empty' }));
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const mm      = String(state.month + 1).padStart(2, '0');
    const dd      = String(day).padStart(2, '0');
    const dateKey = `${state.year}-${mm}-${dd}`;

    const dayEvents      = eventsByDate[dateKey]      || [];
    const daySessions    = sessionsByDate[dateKey]    || [];
    const dayAssignments = assignmentsByDate[dateKey] || [];
    const allItems       = dayEvents.length + daySessions.length + dayAssignments.length;

    const cell = createElement('div', {
      cls:   buildCellClass(dateKey, today),
      attrs: { role: 'gridcell', 'data-date': dateKey, tabindex: '0' },
    });

    // Day number
    const numEl = createElement('span', { cls: 'cal-cell__num', text: String(day) });
    cell.appendChild(numEl);

    // Event chips (max 2 visible, then "+N more")
    if (allItems > 0) {
      const chipsEl = createElement('div', { cls: 'cal-cell__events' });
      let shown = 0;

      dayEvents.slice(0, 2).forEach(ev => {
        if (shown < 2) {
          chipsEl.appendChild(makeChip(ev.title, 'event'));
          shown++;
        }
      });
      dayAssignments.slice(0, 2 - shown).forEach(a => {
        if (shown < 2) {
          chipsEl.appendChild(makeChip(a.title, 'assignment'));
          shown++;
        }
      });
      daySessions.slice(0, 2 - shown).forEach(s => {
        const subject = s.subjectId ? getSubjectById(s.subjectId) : null;
        if (shown < 2) {
          chipsEl.appendChild(makeChip(subject?.name || 'Session', 'session'));
          shown++;
        }
      });

      const overflow = allItems - shown;
      if (overflow > 0) {
        chipsEl.appendChild(createElement('span', {
          cls:  'event-chip event-chip--more',
          text: `+${overflow} more`,
        }));
      }

      cell.appendChild(chipsEl);
    }

    // Click to select day
    cell.addEventListener('click', () => selectDay(dateKey));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDay(dateKey); }
    });

    grid.appendChild(cell);
  }
}

function buildCellClass(dateKey, today) {
  const classes = ['cal-cell'];
  if (dateKey === today)            classes.push('cal-cell--today');
  if (dateKey === state.selectedDate) classes.push('cal-cell--selected');
  return classes.join(' ');
}

function makeChip(title, type) {
  return createElement('span', {
    cls:  `event-chip event-chip--${type}`,
    text: title,
  });
}

// ── Build Data Maps (date → items) ─────────────────────────
function buildEventMap(events) {
  return events.reduce((map, ev) => {
    if (!map[ev.date]) map[ev.date] = [];
    map[ev.date].push(ev);
    return map;
  }, {});
}

function buildSessionMap() {
  return getSessions().reduce((map, s) => {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
    return map;
  }, {});
}

function buildAssignmentMap() {
  return getAssignments().reduce((map, a) => {
    if (!a.completed) {
      if (!map[a.dueDate]) map[a.dueDate] = [];
      map[a.dueDate].push(a);
    }
    return map;
  }, {});
}

// ── Day Selection ──────────────────────────────────────────
function selectDay(dateKey) {
  state.selectedDate = dateKey;

  // Update selected cell style
  $qsa('.cal-cell--selected').forEach(c => c.classList.remove('cal-cell--selected'));
  const target = $qs(`[data-date="${dateKey}"]`);
  if (target) target.classList.add('cal-cell--selected');

  renderDayPanel(dateKey);
}

// ── Day Panel ──────────────────────────────────────────────
function renderDayPanel(dateKey) {
  const dateLabel = $id('day-panel-date');
  const countEl   = $id('day-panel-count');
  const list      = $id('day-events-list');
  const emptyEl   = $id('day-empty');
  const addBtn    = $id('day-add-btn');

  // Format header: "Tuesday, March 24"
  const [y, m, d] = dateKey.split('-').map(Number);
  dateLabel.textContent = new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  show(addBtn);
  addBtn.onclick = () => openModal(dateKey);

  // Gather all items for this day
  const dayEvents      = state.events.filter(e => e.date === dateKey);
  const dayAssignments = getAssignments().filter(a => a.dueDate === dateKey && !a.completed);
  const daySessions    = getSessions().filter(s => s.date === dateKey);
  const total          = dayEvents.length + dayAssignments.length + daySessions.length;

  countEl.textContent = total > 0
    ? `${total} item${total !== 1 ? 's' : ''}`
    : '';

  list.innerHTML = '';

  if (total === 0) {
    show(emptyEl);
    return;
  }

  hide(emptyEl);

  // Render events
  dayEvents.forEach(ev => {
    list.appendChild(buildDayItem({
      type:  'event',
      title: ev.title,
      desc:  ev.description,
      onDelete: () => deleteEvent(ev._id || ev.id, ev._id ? 'api' : 'local'),
    }));
  });

  // Render assignments
  dayAssignments.forEach(a => {
    const subject = a.subjectId ? getSubjectById(a.subjectId) : null;
    list.appendChild(buildDayItem({
      type:  'assignment',
      title: a.title,
      desc:  subject ? `${subject.name} · ${dueDateLabel(a.dueDate)}` : dueDateLabel(a.dueDate),
      onDelete: () => {
        deleteAssignment(a.id);
        showToast('Assignment removed.', 'default');
        reload();
      },
    }));
  });

  // Render sessions (read-only)
  daySessions.forEach(s => {
    const subject = s.subjectId ? getSubjectById(s.subjectId) : null;
    list.appendChild(buildDayItem({
      type:     'session',
      title:    subject?.name || 'Study Session',
      desc:     `${formatMinutes(s.durationMinutes)} · ${capitalize(s.mood || 'neutral')}`,
      onDelete: null, // sessions are read-only from the calendar
    }));
  });
}

/**
 * Build a single item row for the day panel.
 */
function buildDayItem({ type, title, desc, onDelete }) {
  const item = createElement('li', { cls: 'day-event-item' });

  const bar = createElement('div', { cls: `day-event-item__bar day-event-item__bar--${type}` });

  const content = createElement('div', { cls: 'day-event-item__content' });
  content.appendChild(createElement('div', {
    cls:  'day-event-item__type',
    text: type === 'event' ? '📅 Event' : type === 'assignment' ? '📋 Assignment' : '📚 Session',
  }));
  content.appendChild(createElement('div', { cls: 'day-event-item__title', text: title }));
  if (desc) {
    content.appendChild(createElement('div', { cls: 'day-event-item__desc', text: desc }));
  }

  item.appendChild(bar);
  item.appendChild(content);

  if (onDelete) {
    const delBtn = createElement('button', {
      cls:   'day-event-item__delete',
      text:  '✕',
      attrs: { title: 'Delete', 'aria-label': `Delete ${title}` },
    });
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
    item.appendChild(delBtn);
  }

  return item;
}

// ── Delete Event ───────────────────────────────────────────
async function deleteEvent(id, source) {
  if (source === 'api' && state.apiOnline) {
    try {
      const res = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to delete event.', 'danger');
        return;
      }
    } catch {
      showToast('Could not reach server.', 'danger');
      return;
    }
  } else {
    // Remove from localStorage
    const local = getAll(LOCAL_EVENTS_KEY).filter(e => e.id !== id);
    saveAll(LOCAL_EVENTS_KEY, local);
  }

  showToast('Event deleted.', 'default');
  reload();
}

// ── Reload after mutation ──────────────────────────────────
async function reload() {
  await loadEvents();
  renderCalendar();
  renderDayPanel(state.selectedDate);
}

// ── Add Event Modal ────────────────────────────────────────
function openModal(dateKey) {
  // Pre-fill date field with selected day
  $id('event-date').value = dateKey || state.selectedDate;
  $id('event-title').value = '';
  $id('event-description').value = '';
  $id('desc-char-count').textContent = '0 / 500';
  clearValidationErrors();
  openModal_overlay('add-event-modal');
}

function openModal_overlay(id) {
  const overlay = $id(id);
  if (overlay) overlay.classList.add('is-open');
}

// ── Form Validation ────────────────────────────────────────
/**
 * Validate all event form fields.
 * Returns true if valid, false if any errors.
 * Shows inline error messages below each invalid field.
 */
function validateForm() {
  let valid = true;
  clearValidationErrors();

  const title = $id('event-title').value.trim();
  const date  = $id('event-date').value;
  const desc  = $id('event-description').value.trim();

  // Title validation
  if (!title) {
    setFieldError('event-title', 'title-error', 'Title is required.');
    valid = false;
  } else if (title.length > 100) {
    setFieldError('event-title', 'title-error', 'Title must be 100 characters or fewer.');
    valid = false;
  }

  // Date validation
  if (!date) {
    setFieldError('event-date', 'date-error', 'Date is required.');
    valid = false;
  } else {
    const parsed = new Date(date + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      setFieldError('event-date', 'date-error', 'Please enter a valid date.');
      valid = false;
    }
  }

  // Description validation (optional but capped)
  if (desc.length > 500) {
    setFieldError('event-description', 'desc-error', 'Description must be 500 characters or fewer.');
    valid = false;
  }

  return valid;
}

function setFieldError(inputId, errorId, message) {
  const input = $id(inputId);
  const error = $id(errorId);
  if (input) input.classList.add('is-invalid');
  if (error) {
    error.textContent = message;
    show(error);
  }
}

function clearValidationErrors() {
  ['event-title', 'event-date', 'event-description'].forEach(id => {
    const el = $id(id);
    if (el) el.classList.remove('is-invalid');
  });
  ['title-error', 'date-error', 'desc-error'].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ''; hide(el); }
  });
}

// Clear field error as user types
function clearFieldErrorOnInput(inputId, errorId) {
  const input = $id(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    input.classList.remove('is-invalid');
    const error = $id(errorId);
    if (error) { error.textContent = ''; hide(error); }
  });
}

// ── Save Event ─────────────────────────────────────────────
async function saveEvent() {
  if (!validateForm()) return;

  const payload = {
    userId:      getUserId(),
    title:       $id('event-title').value.trim(),
    date:        $id('event-date').value,
    description: $id('event-description').value.trim(),
  };

  const saveBtn = $id('save-event-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  if (state.apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/events`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        // Server returned validation errors — show them inline
        if (data.errors) {
          if (data.errors.title) setFieldError('event-title', 'title-error', data.errors.title);
          if (data.errors.date)  setFieldError('event-date',  'date-error',  data.errors.date);
          if (data.errors.description) setFieldError('event-description', 'desc-error', data.errors.description);
        } else {
          showToast(data.error || 'Failed to save event.', 'danger');
        }
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Event';
        return;
      }

    } catch {
      // Network error: fall back to local save
      saveLocalEvent(payload);
      showToast('Saved locally (server unreachable).', 'warning');
    }
  } else {
    saveLocalEvent(payload);
  }

  closeModal('add-event-modal');
  showToast(`Event "${payload.title}" added!`, 'success');
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Event';
  reload();
}

function saveLocalEvent(payload) {
  const event = { ...payload, id: generateId(), createdAt: new Date().toISOString() };
  const events = getAll(LOCAL_EVENTS_KEY);
  events.push(event);
  saveAll(LOCAL_EVENTS_KEY, events);
}

// ── Wire UI ────────────────────────────────────────────────
function wireButtons() {
  $id('prev-month').addEventListener('click', async () => {
    state.month--;
    if (state.month < 0) { state.month = 11; state.year--; }
    await loadEvents();
    renderCalendar();
    renderDayPanel(state.selectedDate);
  });

  $id('next-month').addEventListener('click', async () => {
    state.month++;
    if (state.month > 11) { state.month = 0; state.year++; }
    await loadEvents();
    renderCalendar();
    renderDayPanel(state.selectedDate);
  });

  $id('add-event-btn').addEventListener('click', () => openModal(state.selectedDate));
}

function wireModal() {
  // Close buttons
  $qsa('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Backdrop close
  enableBackdropClose('add-event-modal');

  // Save
  $id('save-event-btn').addEventListener('click', saveEvent);

  // Enter key in title field → save
  $id('event-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEvent();
  });

  // Clear errors on input
  clearFieldErrorOnInput('event-title', 'title-error');
  clearFieldErrorOnInput('event-date', 'date-error');
  clearFieldErrorOnInput('event-description', 'desc-error');
}

/** Character counter for description textarea */
function wireDescCharCount() {
  const textarea = $id('event-description');
  const counter  = $id('desc-char-count');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 500`;
    counter.style.color = len > 480 ? 'var(--color-danger)' : '';
  });
}
