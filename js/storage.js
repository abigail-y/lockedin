/* ============================================================
   LOCKED IN FACTORY — Storage Helpers
   Central module for all localStorage read/write operations.
   Import this script on every page before page-specific JS.

   Keys used:
     sp_subjects    — array of Subject objects
     sp_sessions    — array of Session objects
     sp_assignments — array of Assignment objects
     sp_decks       — array of Deck objects (cards nested inside)
     sp_goals       — single Goals object
     sp_settings    — single Settings object
   ============================================================ */

// ── Generic Helpers ────────────────────────────────────────

/**
 * Read an array from localStorage by key.
 * Returns an empty array if the key doesn't exist or is malformed.
 */
function getAll(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

/**
 * Write an array (or any value) to localStorage.
 */
function saveAll(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Read a single object from localStorage by key.
 * Returns `defaultValue` if missing or malformed.
 */
function getObject(key, defaultValue = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Generate a short unique ID using the browser's crypto API.
 * Example: "a3f8b2c1"
 */
function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

// ── Subjects ───────────────────────────────────────────────

function getSubjects() {
  return getAll('sp_subjects');
}

/**
 * Add a new subject or update an existing one (matched by id).
 * Pass a full subject object. If no id is provided, one is generated.
 *
 * Subject shape:
 * {
 *   id, name, color, icon, archived, createdAt
 * }
 */
function saveSubject(subject) {
  const subjects = getSubjects();
  if (!subject.id) subject.id = generateId();
  const index = subjects.findIndex(s => s.id === subject.id);
  if (index !== -1) {
    subjects[index] = subject;
  } else {
    subject.createdAt = subject.createdAt || new Date().toISOString();
    subject.archived  = subject.archived  ?? false;
    subjects.push(subject);
  }
  saveAll('sp_subjects', subjects);
  return subject;
}

/**
 * Soft-delete a subject by setting archived: true.
 * Sessions referencing this subject are kept intact.
 */
function archiveSubject(id) {
  const subjects = getSubjects();
  const subject  = subjects.find(s => s.id === id);
  if (subject) {
    subject.archived = true;
    saveAll('sp_subjects', subjects);
  }
}

/**
 * Get all non-archived subjects.
 */
function getActiveSubjects() {
  return getSubjects().filter(s => !s.archived);
}

/**
 * Find a single subject by id.
 */
function getSubjectById(id) {
  return getSubjects().find(s => s.id === id) || null;
}

// ── Sessions ───────────────────────────────────────────────

function getSessions() {
  return getAll('sp_sessions');
}

/**
 * Append a new session to the list.
 *
 * Session shape:
 * {
 *   id, subjectId, date (YYYY-MM-DD), startTime (ISO), endTime (ISO),
 *   durationMinutes, notes, tags, mood
 * }
 */
function saveSession(session) {
  const sessions = getSessions();
  if (!session.id) session.id = generateId();
  session.startTime = session.startTime || new Date().toISOString();
  sessions.push(session);
  saveAll('sp_sessions', sessions);
  return session;
}

/**
 * Delete a session by id (hard delete — sessions are user logs).
 */
function deleteSession(id) {
  const sessions = getSessions().filter(s => s.id !== id);
  saveAll('sp_sessions', sessions);
}

/**
 * Get all sessions for a specific calendar date.
 * @param {string} date — "YYYY-MM-DD"
 */
function getSessionsByDate(date) {
  return getSessions().filter(s => s.date === date);
}

/**
 * Get all sessions for a specific subject.
 */
function getSessionsBySubject(subjectId) {
  return getSessions().filter(s => s.subjectId === subjectId);
}

/**
 * Get all sessions within the current week (Mon–Sun by default).
 * Respects the weekStartsOn setting.
 */
function getSessionsThisWeek() {
  const { start, end } = getWeekRange();
  return getSessions().filter(s => s.date >= start && s.date <= end);
}

/**
 * Get all sessions for today.
 */
function getSessionsToday() {
  return getSessionsByDate(getTodayKey());
}

/**
 * Sum durationMinutes across an array of sessions.
 * @param {Array} sessions
 * @returns {number} total minutes
 */
function getTotalMinutes(sessions) {
  return sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
}

// ── Assignments ────────────────────────────────────────────

function getAssignments() {
  return getAll('sp_assignments');
}

/**
 * Add a new assignment or update an existing one (matched by id).
 *
 * Assignment shape:
 * {
 *   id, subjectId, title, type, dueDate (YYYY-MM-DD), dueTime,
 *   priority, completed, notes, createdAt
 * }
 */
function saveAssignment(assignment) {
  const assignments = getAssignments();
  if (!assignment.id) assignment.id = generateId();
  const index = assignments.findIndex(a => a.id === assignment.id);
  if (index !== -1) {
    assignments[index] = assignment;
  } else {
    assignment.createdAt = assignment.createdAt || new Date().toISOString();
    assignment.completed = assignment.completed ?? false;
    assignments.push(assignment);
  }
  saveAll('sp_assignments', assignments);
  return assignment;
}

/**
 * Toggle the completed state of an assignment.
 */
function toggleAssignmentComplete(id) {
  const assignments = getAssignments();
  const assignment  = assignments.find(a => a.id === id);
  if (assignment) {
    assignment.completed = !assignment.completed;
    saveAll('sp_assignments', assignments);
  }
}

/**
 * Hard-delete an assignment.
 */
function deleteAssignment(id) {
  saveAll('sp_assignments', getAssignments().filter(a => a.id !== id));
}

/**
 * Get assignments due within the next N days (excluding completed).
 */
function getUpcomingAssignments(days = 7) {
  const today = getTodayKey();
  const limit = getDateKey(new Date(Date.now() + days * 86400000));
  return getAssignments().filter(a =>
    !a.completed && a.dueDate >= today && a.dueDate <= limit
  );
}

/**
 * Get assignments due on a specific date (for calendar view).
 */
function getAssignmentsByDate(date) {
  return getAssignments().filter(a => a.dueDate === date);
}

/**
 * Get overdue assignments (due date has passed, not completed).
 */
function getOverdueAssignments() {
  const today = getTodayKey();
  return getAssignments().filter(a => !a.completed && a.dueDate < today);
}

// ── Decks & Flashcards ─────────────────────────────────────

function getDecks() {
  return getAll('sp_decks');
}

/**
 * Add a new deck or update an existing one (matched by id).
 * Cards are nested inside deck.cards[].
 *
 * Deck shape:
 * {
 *   id, subjectId, name, createdAt,
 *   cards: [{ id, front, back, lastReviewed, difficulty }]
 * }
 */
function saveDeck(deck) {
  const decks = getDecks();
  if (!deck.id) deck.id = generateId();
  const index = decks.findIndex(d => d.id === deck.id);
  if (index !== -1) {
    decks[index] = deck;
  } else {
    deck.createdAt = deck.createdAt || new Date().toISOString();
    deck.cards     = deck.cards     || [];
    decks.push(deck);
  }
  saveAll('sp_decks', decks);
  return deck;
}

/**
 * Hard-delete a deck and all its cards.
 */
function deleteDeck(id) {
  saveAll('sp_decks', getDecks().filter(d => d.id !== id));
}

/**
 * Find a single deck by id.
 */
function getDeckById(id) {
  return getDecks().find(d => d.id === id) || null;
}

/**
 * Add a card to a deck.
 *
 * Card shape:
 * { id, front, back, lastReviewed, difficulty }
 */
function addCard(deckId, card) {
  const decks = getDecks();
  const deck  = decks.find(d => d.id === deckId);
  if (!deck) return;
  card.id           = card.id || generateId();
  card.lastReviewed = card.lastReviewed || null;
  card.difficulty   = card.difficulty   || null;
  deck.cards.push(card);
  saveAll('sp_decks', decks);
  return card;
}

/**
 * Update a card inside a deck (matched by card.id).
 */
function updateCard(deckId, updatedCard) {
  const decks = getDecks();
  const deck  = decks.find(d => d.id === deckId);
  if (!deck) return;
  const index = deck.cards.findIndex(c => c.id === updatedCard.id);
  if (index !== -1) deck.cards[index] = updatedCard;
  saveAll('sp_decks', decks);
}

/**
 * Remove a card from a deck.
 */
function deleteCard(deckId, cardId) {
  const decks = getDecks();
  const deck  = decks.find(d => d.id === deckId);
  if (!deck) return;
  deck.cards = deck.cards.filter(c => c.id !== cardId);
  saveAll('sp_decks', decks);
}

// ── Goals ──────────────────────────────────────────────────

const DEFAULT_GOALS = {
  dailyTargetMinutes:  120,
  weeklyTargetMinutes: 600,
  perSubject: {}
};

function getGoals() {
  return getObject('sp_goals', DEFAULT_GOALS);
}

function saveGoals(goals) {
  localStorage.setItem('sp_goals', JSON.stringify(goals));
}

// ── Settings ───────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  theme:                          'light',
  defaultSessionDurationMinutes:  25,
  weekStartsOn:                   'monday',
  createdAt:                      new Date().toISOString()
};

function getSettings() {
  return getObject('sp_settings', DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  localStorage.setItem('sp_settings', JSON.stringify(settings));
}

// ── Computed Stats (not stored, derived at runtime) ────────

/**
 * Count consecutive days (ending today) that have at least one session.
 * @returns {number} streak in days
 */
function getStreak() {
  const sessions = getSessions();
  if (!sessions.length) return 0;

  const sessionDates = new Set(sessions.map(s => s.date));
  let streak = 0;
  let cursor = new Date();

  while (true) {
    const key = getDateKey(cursor);
    if (sessionDates.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Minutes studied today vs daily goal, as a 0–100 percentage.
 * @returns {{ minutes: number, target: number, percent: number }}
 */
function getDailyProgress() {
  const minutes = getTotalMinutes(getSessionsToday());
  const target  = getGoals().dailyTargetMinutes;
  return {
    minutes,
    target,
    percent: target > 0 ? Math.min(100, Math.round((minutes / target) * 100)) : 0
  };
}

/**
 * Minutes studied this week vs weekly goal.
 * @returns {{ minutes: number, target: number, percent: number }}
 */
function getWeeklyProgress() {
  const minutes = getTotalMinutes(getSessionsThisWeek());
  const target  = getGoals().weeklyTargetMinutes;
  return {
    minutes,
    target,
    percent: target > 0 ? Math.min(100, Math.round((minutes / target) * 100)) : 0
  };
}

/**
 * Returns total minutes per subject for the current week.
 * @returns {Object} { subjectId: totalMinutes }
 */
function getWeeklySubjectBreakdown() {
  const sessions = getSessionsThisWeek();
  return sessions.reduce((acc, s) => {
    acc[s.subjectId] = (acc[s.subjectId] || 0) + (s.durationMinutes || 0);
    return acc;
  }, {});
}

// ── Active Session ─────────────────────────────────────────

/**
 * Read the in-progress session from localStorage.
 * Returns null if no session is currently running.
 * Shape: { mongoId, subjectId, subjectName, subjectIcon, subjectColor, startTime, notes }
 */
function getActiveSession() {
  try {
    const raw = localStorage.getItem('sp_active_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear the active session from localStorage.
 */
function clearActiveSession() {
  localStorage.removeItem('sp_active_session');
}

// ── Date Helpers (used internally by storage.js) ───────────
// Full set of date helpers lives in utils.js.
// These minimal versions are here so storage.js is self-contained.

function getTodayKey() {
  return getDateKey(new Date());
}

function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange() {
  const settings = getSettings();
  const today    = new Date();
  const day      = today.getDay(); // 0 = Sun
  const startOffset = settings.weekStartsOn === 'monday'
    ? (day === 0 ? -6 : 1 - day)
    : -day;

  const start = new Date(today);
  start.setDate(today.getDate() + startOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start: getDateKey(start), end: getDateKey(end) };
}
