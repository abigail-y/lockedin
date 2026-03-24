/* ============================================================
   LOCKED IN FACTORY — Shared Utilities
   Import this script on every page after storage.js.

   Sections:
   - Date & time formatting
   - Duration formatting
   - DOM helpers
   - Toast notifications
   - Modal helpers
   - Navbar setup
   ============================================================ */

// ── Date & Time Formatting ─────────────────────────────────

/**
 * Format an ISO timestamp to a readable date string.
 * @param {string} iso — ISO date string
 * @param {object} opts — Intl.DateTimeFormat options
 * @returns {string} e.g. "Mon, Mar 23"
 */
function formatDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(iso));
}

/**
 * Format a YYYY-MM-DD string to readable form.
 * @param {string} dateKey — "YYYY-MM-DD"
 * @returns {string} e.g. "March 23, 2026"
 */
function formatDateKey(dateKey, opts = { month: 'long', day: 'numeric', year: 'numeric' }) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(y, m - 1, d));
}

/**
 * Format an ISO timestamp to a time string.
 * @returns {string} e.g. "2:30 PM"
 */
function formatTime(iso) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/**
 * Return today's date as YYYY-MM-DD.
 */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Convert a Date object to YYYY-MM-DD string.
 */
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Return true if a YYYY-MM-DD string is today.
 */
function isToday(dateKey) {
  return dateKey === todayKey();
}

/**
 * Return true if a YYYY-MM-DD string falls in the current week.
 * Uses weekStartsOn from settings.
 */
function isSameWeek(dateKey) {
  const { start, end } = getWeekRange();
  return dateKey >= start && dateKey <= end;
}

/**
 * Return the number of days until a due date.
 * Returns 0 if due today, negative if past.
 * @param {string} dateKey — "YYYY-MM-DD"
 * @returns {number}
 */
function daysUntil(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const due   = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

/**
 * Human-readable "due in X days" label.
 * @param {string} dateKey
 * @returns {string} e.g. "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue"
 */
function dueDateLabel(dateKey) {
  const diff = daysUntil(dateKey);
  if (diff < 0)  return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff} days`;
}

/**
 * Return a CSS badge class based on how many days until due.
 * Used by deadline tracker and calendar.
 * @param {string} dateKey
 * @param {boolean} completed
 * @returns {string} badge class e.g. "badge--red"
 */
function dueDateBadgeClass(dateKey, completed = false) {
  if (completed) return 'badge--green';
  const diff = daysUntil(dateKey);
  if (diff < 0)  return 'badge--red';
  if (diff <= 1) return 'badge--red';
  if (diff <= 3) return 'badge--yellow';
  return 'badge--teal';
}

// ── Duration Formatting ────────────────────────────────────

/**
 * Format a number of minutes into a human-readable string.
 * @param {number} minutes
 * @returns {string} e.g. "1h 30m", "45m", "2h"
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format elapsed seconds into MM:SS.
 * Used by the Pomodoro timer.
 * @param {number} totalSeconds
 * @returns {string} e.g. "25:00", "04:32"
 */
function formatSeconds(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Calculate duration in minutes between two ISO timestamps.
 * @param {string} startIso
 * @param {string} endIso
 * @returns {number} minutes (rounded)
 */
function calcDurationMinutes(startIso, endIso) {
  return Math.round((new Date(endIso) - new Date(startIso)) / 60000);
}

// ── DOM Helpers ────────────────────────────────────────────

/**
 * Shorthand for document.getElementById.
 */
function $id(id) {
  return document.getElementById(id);
}

/**
 * Shorthand for document.querySelector.
 */
function $qs(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Shorthand for document.querySelectorAll (returns array).
 */
function $qsa(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Create an element with optional class, text content, and attributes.
 * @param {string} tag
 * @param {object} opts — { cls, text, attrs, html }
 * @returns {HTMLElement}
 */
function createElement(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.cls)   el.className   = opts.cls;
  if (opts.text)  el.textContent = opts.text;
  if (opts.html)  el.innerHTML   = opts.html;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      el.setAttribute(k, v);
    }
  }
  return el;
}

/**
 * Show an element (removes the 'hidden' class).
 */
function show(el) {
  if (el) el.classList.remove('hidden');
}

/**
 * Hide an element (adds the 'hidden' class).
 */
function hide(el) {
  if (el) el.classList.add('hidden');
}

/**
 * Toggle visibility based on a boolean condition.
 */
function toggleVisibility(el, condition) {
  condition ? show(el) : hide(el);
}

// ── Toast Notifications ────────────────────────────────────

/**
 * Ensure the toast container exists in the DOM.
 * @returns {HTMLElement}
 */
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = createElement('div', {
      cls: 'toast-container',
      attrs: { id: 'toast-container' }
    });
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'default'|'success'|'danger'|'warning'|'teal'} type
 * @param {number} duration — ms before auto-dismiss (default 3000)
 */
function showToast(message, type = 'default', duration = 3000) {
  const container = getToastContainer();
  const toast = createElement('div', {
    cls: `toast${type !== 'default' ? ` toast--${type}` : ''}`,
    text: message
  });
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ── Modal Helpers ──────────────────────────────────────────

/**
 * Open a modal overlay by its ID.
 * @param {string} overlayId
 */
function openModal(overlayId) {
  const overlay = $id(overlayId);
  if (overlay) overlay.classList.add('is-open');
}

/**
 * Close a modal overlay by its ID.
 * @param {string} overlayId
 */
function closeModal(overlayId) {
  const overlay = $id(overlayId);
  if (overlay) overlay.classList.remove('is-open');
}

/**
 * Close a modal when clicking the backdrop (outside the .modal box).
 * Call this once per overlay on page load.
 * @param {string} overlayId
 */
function enableBackdropClose(overlayId) {
  const overlay = $id(overlayId);
  if (!overlay) return;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlayId);
  });
}

// ── Navbar Setup ───────────────────────────────────────────

/**
 * Initialize the navbar:
 * - Marks the current page link as active
 * - Wires up the mobile hamburger toggle
 *
 * Call this on DOMContentLoaded on every page.
 */
function initNavbar() {
  // Mark active link
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  $qsa('.navbar__link').forEach(link => {
    const href = link.getAttribute('href') || '';
    const linkPage = href.split('/').pop();
    if (linkPage === currentPath) {
      link.classList.add('active');
    }
  });

  // Mobile toggle
  const toggle = $qs('.navbar__toggle');
  const links  = $qs('.navbar__links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('is-open');
    });
    // Close menu when a link is clicked on mobile
    $qsa('.navbar__link').forEach(link => {
      link.addEventListener('click', () => links.classList.remove('is-open'));
    });
  }
}

// ── Misc ───────────────────────────────────────────────────

/**
 * Clamp a number between min and max.
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay — ms
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Session Dark Mode (runs on every page) ─────────────────

let _miniTimerInterval = null;

/**
 * Called automatically on DOMContentLoaded on every page.
 * If a session is active, applies dark theme and renders
 * the floating mini timer widget.
 */
function initSessionDarkMode() {
  const active = getActiveSession();
  if (!active) return;
  document.body.classList.add('session-active');
  renderMiniTimer(active);
}

/**
 * Create (or show) the floating mini timer widget in the bottom-left corner.
 * Idempotent — calling it multiple times won't create duplicates.
 * @param {object} sessionData — the sp_active_session object
 */
function renderMiniTimer(sessionData) {
  // If widget already exists, just un-hide it and restart tick
  const existing = document.getElementById('session-mini-timer');
  if (existing) {
    show(existing);
    _startMiniTimerTick(sessionData.startTime);
    return;
  }

  // Determine href — works whether we're in /pages/ or root
  const inPagesDir  = window.location.pathname.includes('/pages/');
  const sessionHref = inPagesDir ? './session.html' : './pages/session.html';
  const isSessionPg = window.location.pathname.endsWith('session.html');

  // Build widget
  const widget = createElement('div', {
    cls:   'session-mini-timer',
    attrs: { id: 'session-mini-timer', role: 'button', title: 'Click to open session' },
  });

  const inner = createElement('div', { cls: 'mini-timer__inner' });

  inner.appendChild(createElement('span', { cls: 'active-dot' }));
  inner.appendChild(createElement('span', {
    cls:  'mini-timer__icon',
    text: sessionData.subjectIcon || '📚',
  }));
  inner.appendChild(createElement('span', {
    cls:   'mini-timer__subject',
    text:  sessionData.subjectName || 'Session',
    attrs: { id: 'mini-timer-subject' },
  }));
  inner.appendChild(createElement('span', {
    cls:   'mini-timer__time',
    text:  '00:00:00',
    attrs: { id: 'mini-timer-time' },
  }));
  inner.appendChild(createElement('span', {
    cls:  'mini-timer__expand',
    text: '↗',
  }));

  widget.appendChild(inner);

  // Click: on session page dispatch custom event so session.js can expand
  // On other pages: navigate to session.html
  widget.addEventListener('click', () => {
    if (isSessionPg) {
      document.dispatchEvent(new CustomEvent('mini-timer-expand'));
    } else {
      window.location.href = sessionHref;
    }
  });

  document.body.appendChild(widget);
  _startMiniTimerTick(sessionData.startTime);
}

/**
 * Hide the mini timer (e.g. when entering full focus mode).
 */
function hideMiniTimer() {
  const w = document.getElementById('session-mini-timer');
  if (w) hide(w);
  if (_miniTimerInterval) {
    clearInterval(_miniTimerInterval);
    _miniTimerInterval = null;
  }
}

/**
 * Remove the mini timer entirely and clear dark mode.
 * Called when a session ends.
 */
function removeMiniTimer() {
  hideMiniTimer();
  const w = document.getElementById('session-mini-timer');
  if (w) w.remove();
  document.body.classList.remove('session-active');
}

/**
 * Tick the mini timer every second.
 * @param {string} startTimeIso
 */
function _startMiniTimerTick(startTimeIso) {
  if (_miniTimerInterval) clearInterval(_miniTimerInterval);

  function tick() {
    const el = document.getElementById('mini-timer-time');
    if (!el) { clearInterval(_miniTimerInterval); return; }
    const elapsed = Math.floor((Date.now() - new Date(startTimeIso)) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }

  tick();
  _miniTimerInterval = setInterval(tick, 1000);
}

// ── Auto-init on every page ────────────────────────────────
// Runs after DOM is ready. Applies dark mode + mini timer
// on any page where sp_active_session is set.
document.addEventListener('DOMContentLoaded', initSessionDarkMode);
