/* ============================================================
   LOCKED IN FACTORY — Flashcards JS
   ============================================================ */

const API_BASE  = 'http://localhost:5000/api';
const LOCAL_KEY = 'sp_flashcards';

// ── State ──────────────────────────────────────────────────
let allCards     = [];   // all cards from API / localStorage
let currentDeck  = [];   // cards in the selected deck
let currentIndex = 0;    // position in currentDeck
let isFlipped    = false;
let apiOnline    = false;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  apiOnline = await checkApi();
  await loadCards();
  renderDecks();
  wireForm();
});

async function checkApi() {
  try {
    const res = await fetch(`${API_BASE}/sessions/ping`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

function getUserId() {
  if (!localStorage.getItem('sp_user_id'))
    localStorage.setItem('sp_user_id', crypto.randomUUID());
  return localStorage.getItem('sp_user_id');
}

// ── Load all cards ─────────────────────────────────────────
async function loadCards() {
  if (apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/flashcards?userId=${getUserId()}`);
      const data = await res.json();
      if (res.ok) { allCards = data.cards; return; }
    } catch { /* fall through */ }
  }
  allCards = getAll(LOCAL_KEY);
}

// ── Deck List ──────────────────────────────────────────────
function renderDecks() {
  const list     = $id('deck-list');
  const emptyEl  = $id('deck-empty');

  // Group cards by deckName
  const deckMap = allCards.reduce((map, c) => {
    map[c.deckName] = (map[c.deckName] || 0) + 1;
    return map;
  }, {});

  const deckNames = Object.keys(deckMap).sort();

  list.innerHTML = '';

  if (deckNames.length === 0) { show(emptyEl); return; }
  hide(emptyEl);

  deckNames.forEach(name => {
    const item = createElement('li', {
      cls: `deck-item${name === currentDeck[0]?.deckName ? ' deck-item--active' : ''}`,
    });
    item.appendChild(createElement('span', { text: `🃏 ${name}` }));
    item.appendChild(createElement('span', { cls: 'deck-item__count', text: deckMap[name] }));
    item.addEventListener('click', () => selectDeck(name));
    list.appendChild(item);
  });
}

// ── Select a deck ──────────────────────────────────────────
function selectDeck(deckName) {
  currentDeck  = allCards.filter(c => c.deckName === deckName);
  currentIndex = 0;
  isFlipped    = false;

  // Update active deck highlight
  $qsa('.deck-item').forEach(el => {
    el.classList.toggle('deck-item--active', el.textContent.includes(deckName));
  });

  hide($id('review-empty'));
  show($id('review-active'));
  $id('review-deck-name').textContent = deckName;

  renderCard();
}

// ── Render current card ────────────────────────────────────
function renderCard() {
  if (currentDeck.length === 0) return;

  const card = currentDeck[currentIndex];

  // Reset flip to question side
  isFlipped = false;
  $id('flip-inner').classList.remove('is-flipped');
  $id('flip-hint').textContent = 'Click card to reveal answer';

  $id('card-question').textContent = card.question;
  $id('card-answer').textContent   = card.answer;
  $id('fc-progress').textContent   = `${currentIndex + 1} / ${currentDeck.length}`;
  $id('review-count').textContent  = `${currentDeck.length} card${currentDeck.length !== 1 ? 's' : ''}`;

  // Disable prev/next at boundaries
  $id('prev-btn').disabled = currentIndex === 0;
  $id('next-btn').disabled = currentIndex === currentDeck.length - 1;
}

// ── Flip ───────────────────────────────────────────────────
function flipCard() {
  isFlipped = !isFlipped;
  $id('flip-inner').classList.toggle('is-flipped', isFlipped);
  $id('flip-hint').textContent = isFlipped ? 'Click to see question' : 'Click card to reveal answer';
}

// ── Navigation ─────────────────────────────────────────────
function goNext() {
  if (currentIndex < currentDeck.length - 1) {
    currentIndex++;
    renderCard();
  }
}

function goPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    renderCard();
  }
}

// ── Delete current card ────────────────────────────────────
async function deleteCurrentCard() {
  const card = currentDeck[currentIndex];
  if (!card) return;

  const id = card._id || card.id;

  if (apiOnline && card._id) {
    try {
      await fetch(`${API_BASE}/flashcards/${card._id}`, { method: 'DELETE' });
    } catch { /* fall through */ }
  }

  // Remove from local state
  allCards    = allCards.filter(c => (c._id || c.id) !== id);
  saveAll(LOCAL_KEY, allCards.filter(c => !c._id)); // persist only local cards

  showToast('Card deleted.', 'default');

  // Refresh deck view
  const deckName = card.deckName;
  currentDeck = allCards.filter(c => c.deckName === deckName);

  if (currentDeck.length === 0) {
    // Deck is now empty — go back to deck list
    hide($id('review-active'));
    show($id('review-empty'));
  } else {
    currentIndex = Math.min(currentIndex, currentDeck.length - 1);
    renderCard();
  }

  renderDecks();
}

// ── Add card ───────────────────────────────────────────────
async function handleAddCard() {
  const deckName = $id('fc-deck').value.trim();
  const question = $id('fc-question').value.trim();
  const answer   = $id('fc-answer').value.trim();

  // Validation
  let valid = true;
  clearErrors();

  if (!deckName) { showErr('fc-deck',     'fc-deck-error',     'Deck name is required.'); valid = false; }
  if (!question) { showErr('fc-question', 'fc-question-error', 'Question is required.');  valid = false; }
  if (!answer)   { showErr('fc-answer',   'fc-answer-error',   'Answer is required.');    valid = false; }
  if (!valid) return;

  const payload = { userId: getUserId(), deckName, question, answer };
  let newCard;

  if (apiOnline) {
    try {
      const res  = await fetch(`${API_BASE}/flashcards`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        newCard = data.card;
      } else {
        if (data.errors?.deckName) showErr('fc-deck',     'fc-deck-error',     data.errors.deckName);
        if (data.errors?.question) showErr('fc-question', 'fc-question-error', data.errors.question);
        if (data.errors?.answer)   showErr('fc-answer',   'fc-answer-error',   data.errors.answer);
        return;
      }
    } catch {
      newCard = saveLocalCard(payload);
    }
  } else {
    newCard = saveLocalCard(payload);
  }

  allCards.push(newCard);

  // Clear form (keep deckName for convenience)
  $id('fc-question').value = '';
  $id('fc-answer').value   = '';

  showToast('Card added!', 'success');
  renderDecks();

  // If the added card's deck is already selected, refresh review
  if (currentDeck.length > 0 && currentDeck[0].deckName === deckName) {
    currentDeck = allCards.filter(c => c.deckName === deckName);
    renderCard();
  }
}

function saveLocalCard(payload) {
  const card = { ...payload, id: generateId(), createdAt: new Date().toISOString() };
  const local = getAll(LOCAL_KEY);
  local.push(card);
  saveAll(LOCAL_KEY, local);
  return card;
}

// ── Validation helpers ─────────────────────────────────────
function showErr(inputId, errorId, msg) {
  $id(inputId)?.classList.add('is-invalid');
  const el = $id(errorId);
  if (el) { el.textContent = msg; show(el); }
}

function clearErrors() {
  ['fc-deck', 'fc-question', 'fc-answer'].forEach(id => $id(id)?.classList.remove('is-invalid'));
  ['fc-deck-error', 'fc-question-error', 'fc-answer-error'].forEach(id => {
    const el = $id(id);
    if (el) { el.textContent = ''; hide(el); }
  });
}

// ── Wire UI ────────────────────────────────────────────────
function wireForm() {
  $id('add-card-btn').addEventListener('click', handleAddCard);

  // Flip on click or Enter/Space
  const flipCardEl = $id('flip-card');
  flipCardEl.addEventListener('click', flipCard);
  flipCardEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipCard(); }
  });

  $id('next-btn').addEventListener('click', goNext);
  $id('prev-btn').addEventListener('click', goPrev);
  $id('delete-card-btn').addEventListener('click', deleteCurrentCard);

  // Keyboard: arrow keys for navigation, Space to flip
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft')  goPrev();
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
  });

  // Clear errors on input
  ['fc-deck', 'fc-question', 'fc-answer'].forEach(id => {
    $id(id)?.addEventListener('input', () => $id(id).classList.remove('is-invalid'));
  });
}
