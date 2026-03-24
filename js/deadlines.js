/* ============================================================
   LOCKED IN FACTORY — Deadlines JS
   CRUD via API (MongoDB) with localStorage fallback.
   Filter by status, sort by due date.
   ============================================================ */

const API_BASE = 'http://localhost:5000/api';

// ── State ──────────────────────────────────────────────────
let allAssignments = [];
let filter         = 'all';    // 'all' | 'pending' | 'completed'
let sortAsc        = true;     // true = earliest first
let apiOnline      = false;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  apiOnline = await checkApi();
  await loadAssignments();
  renderList();
  wireForm();
  wireFilters();
});

// ── API check ──────────────────────────────────────────────
async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}/sessions/ping`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch { return false; }
}

function getUserId() {
  if (!localStorage.getItem('sp_user_id'))
    localStorage.setItem('sp_user_id', crypto.randomUUID());
  return localStorage.getItem('sp_user_id');
}

// ── Load ───────────────────────────────────────────────────
async function loadAssignments() {
  if (apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/assignments?userId=${getUserId()}`);
      const data = await res.json();
      if (res.ok) {
        allAssignments = data.assignments;
        return;
      }
    } catch { /* fall through */ }
  }
  // Offline: read from sp_assignments in localStorage
  allAssignments = getAssignments().map(a => ({
    ...a,
    _id:    null,           // no mongo id
    status: a.completed ? 'completed' : 'pending',
  }));
}

// ── Filtered + sorted view ─────────────────────────────────
function getVisible() {
  return allAssignments
    .filter(a => filter === 'all' || a.status === filter)
    .sort((a, b) => {
      const cmp = (a.dueDate || '').localeCompare(b.dueDate || '');
      return sortAsc ? cmp : -cmp;
    });
}

// ── Render list ────────────────────────────────────────────
function renderList() {
  const list    = $id('dl-list');
  const emptyEl = $id('dl-empty');
  const visible = getVisible();

  // Overdue badge in header
  const overdue = allAssignments.filter(
    a => a.status === 'pending' && a.dueDate < todayKey()
  ).length;
  const badge = $id('overdue-badge');
  if (overdue > 0) {
    badge.textContent = `${overdue} overdue`;
    show(badge);
  } else {
    hide(badge);
  }

  list.innerHTML = '';

  if (visible.length === 0) { show(emptyEl); return; }
  hide(emptyEl);

  visible.forEach(a => list.appendChild(buildItem(a)));
}

function buildItem(a) {
  const done = a.status === 'completed';
  const li   = createElement('li', {
    cls: `dl-item dl-item--${a.priority || 'medium'}${done ? ' dl-item--completed' : ''}`,
  });

  // Complete toggle
  const check = createElement('button', {
    cls:   `dl-item__check${done ? ' dl-item__check--done' : ''}`,
    text:  done ? '✓' : '',
    attrs: { title: done ? 'Mark pending' : 'Mark complete', 'aria-label': 'Toggle complete' },
  });
  check.addEventListener('click', () => toggleComplete(a));

  // Content
  const content = createElement('div', { cls: 'dl-item__content' });
  content.appendChild(createElement('div', { cls: 'dl-item__title', text: a.title }));

  const meta = createElement('div', { cls: 'dl-item__meta' });
  meta.appendChild(createElement('span', {
    cls:  `badge ${priorityBadgeClass(a.priority)}`,
    text: capitalize(a.priority || 'medium'),
  }));
  meta.appendChild(createElement('span', {
    cls:  'dl-item__due',
    text: done ? `Due ${formatDateKey(a.dueDate)}` : dueDateLabel(a.dueDate),
  }));
  content.appendChild(meta);

  // Delete
  const del = createElement('button', {
    cls:   'dl-item__delete',
    text:  '✕',
    attrs: { title: 'Delete', 'aria-label': `Delete ${a.title}` },
  });
  del.addEventListener('click', () => removeAssignment(a));

  li.appendChild(check);
  li.appendChild(content);
  li.appendChild(del);
  return li;
}

function priorityBadgeClass(priority) {
  return priority === 'high' ? 'badge--red'
       : priority === 'low'  ? 'badge--green'
       : 'badge--yellow';
}

// ── Toggle complete ────────────────────────────────────────
async function toggleComplete(a) {
  const newStatus = a.status === 'completed' ? 'pending' : 'completed';

  if (apiOnline && a._id) {
    try {
      const res = await fetch(`${API_BASE}/assignments/${a._id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        updateLocal(a._id, data.assignment);
        renderList();
        return;
      }
    } catch { /* fall through */ }
  }

  // Offline: toggle in localStorage
  toggleAssignmentComplete(a.id || a._id);
  a.status = newStatus;
  a.completed = newStatus === 'completed';
  renderList();
}

// ── Delete ─────────────────────────────────────────────────
async function removeAssignment(a) {
  if (apiOnline && a._id) {
    try {
      await fetch(`${API_BASE}/assignments/${a._id}`, { method: 'DELETE' });
    } catch { /* fall through */ }
  }

  // Always remove from local state and localStorage
  allAssignments = allAssignments.filter(x => x._id !== a._id && x.id !== a.id);
  deleteAssignment(a.id || a._id);
  showToast('Assignment deleted.', 'default');
  renderList();
}

// ── Add assignment ─────────────────────────────────────────
async function handleAdd() {
  const title    = $id('dl-title').value.trim();
  const dueDate  = $id('dl-date').value;
  const priority = $id('dl-priority').value;

  // Validation
  let valid = true;
  clearErrors();

  if (!title) {
    showFieldError('dl-title', 'dl-title-error', 'Title is required.');
    valid = false;
  }
  if (!dueDate) {
    showFieldError('dl-date', 'dl-date-error', 'Due date is required.');
    valid = false;
  }
  if (!valid) return;

  const payload = { userId: getUserId(), title, dueDate, priority };

  if (apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/assignments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors?.title)   showFieldError('dl-title', 'dl-title-error', data.errors.title);
        if (data.errors?.dueDate) showFieldError('dl-date',  'dl-date-error',  data.errors.dueDate);
        return;
      }

      allAssignments.unshift(data.assignment);
    } catch {
      const local = addLocal(payload);
      allAssignments.unshift(local);
    }
  } else {
    const local = addLocal(payload);
    allAssignments.unshift(local);
  }

  // Reset form
  $id('dl-title').value = '';
  $id('dl-date').value  = '';
  $id('dl-priority').value = 'medium';

  showToast(`"${title}" added.`, 'success');
  renderList();
}

function addLocal(payload) {
  const a = {
    ...payload,
    id:        generateId(),
    _id:       null,
    status:    'pending',
    completed: false,
    createdAt: new Date().toISOString(),
  };
  saveAssignment(a);
  return a;
}

function updateLocal(mongoId, updated) {
  const idx = allAssignments.findIndex(a => a._id === mongoId);
  if (idx !== -1) allAssignments[idx] = { ...allAssignments[idx], ...updated };
}

// ── Validation helpers ─────────────────────────────────────
function showFieldError(inputId, errorId, msg) {
  const input = $id(inputId);
  const error = $id(errorId);
  if (input) input.classList.add('is-invalid');
  if (error) { error.textContent = msg; show(error); }
}

function clearErrors() {
  ['dl-title', 'dl-date'].forEach(id => $id(id)?.classList.remove('is-invalid'));
  ['dl-title-error', 'dl-date-error'].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ''; hide(el); }
  });
}

// ── Wire UI ────────────────────────────────────────────────
function wireForm() {
  $id('add-dl-btn').addEventListener('click', handleAdd);
  $id('dl-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });
  // Clear errors on input
  ['dl-title', 'dl-date'].forEach(id => {
    $id(id)?.addEventListener('input', () => {
      $id(id).classList.remove('is-invalid');
    });
  });
}

function wireFilters() {
  // Filter tabs
  $qsa('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $qsa('.filter-tab').forEach(t => t.classList.remove('filter-tab--active'));
      tab.classList.add('filter-tab--active');
      filter = tab.dataset.filter;
      renderList();
    });
  });

  // Sort toggle
  $id('sort-btn').addEventListener('click', () => {
    sortAsc = !sortAsc;
    $id('sort-icon').textContent = sortAsc ? '↑' : '↓';
    renderList();
  });
}
