const express   = require('express');
const router    = express.Router();
const Flashcard = require('../models/Flashcard');

// ── POST /api/flashcards ───────────────────────────────────
router.post('/', async (req, res) => {
  const { userId, deckName, question, answer } = req.body;

  const errors = {};
  if (!userId)          errors.userId   = 'userId is required';
  if (!deckName?.trim()) errors.deckName = 'Deck name is required';
  if (!question?.trim()) errors.question = 'Question is required';
  if (!answer?.trim())   errors.answer   = 'Answer is required';

  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const card = await Flashcard.create({
      userId,
      deckName: deckName.trim(),
      question: question.trim(),
      answer:   answer.trim(),
    });
    res.status(201).json({ card });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/flashcards ────────────────────────────────────
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const cards = await Flashcard.find({ userId }).sort({ deckName: 1, createdAt: 1 });
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/flashcards/:id ─────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const card = await Flashcard.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json({ message: 'Card deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
