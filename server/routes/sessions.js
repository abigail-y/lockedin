const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');

// ── GET /api/sessions/ping ─────────────────────────────────
// Health check — the frontend calls this on load to decide
// whether to operate in online (MongoDB) or offline (localStorage) mode.
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

// ── POST /api/sessions/start ───────────────────────────────
// Creates a new open session (no endTime yet).
//
// Request body:
// {
//   userId:      string  (required)
//   subjectId:   string  (optional)
//   subjectName: string  (optional, defaults to "General")
// }
//
// Response: the created Session document.
router.post('/start', async (req, res) => {
  const { userId, subjectId, subjectName } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Guard: if this user already has an open session, return it instead of
  // creating a duplicate. The frontend will pick it up on refresh.
  const existing = await Session.findOne({ userId, completed: false });
  if (existing) {
    return res.status(200).json({ session: existing, resumed: true });
  }

  try {
    const session = await Session.create({
      userId,
      subjectId:   subjectId   || null,
      subjectName: subjectName || 'General',
      startTime:   new Date(),
    });

    res.status(201).json({ session, resumed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sessions/end ─────────────────────────────────
// Closes an open session: sets endTime, calculates duration, saves notes/mood.
//
// Request body:
// {
//   sessionId: string  (MongoDB _id, required)
//   notes:     string  (optional)
//   mood:      string  (optional — "focused" | "neutral" | "distracted")
// }
//
// Response: the updated Session document.
router.post('/end', async (req, res) => {
  const { sessionId, notes, mood } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.completed) {
      return res.status(400).json({ error: 'Session already ended' });
    }

    const endTime         = new Date();
    const durationMinutes = Math.round(
      (endTime - session.startTime) / 60000
    );

    session.endTime         = endTime;
    session.durationMinutes = durationMinutes;
    session.notes           = notes     || '';
    session.mood            = mood      || 'neutral';
    session.completed       = true;

    await session.save();

    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions ──────────────────────────────────────
// Returns all completed sessions for a given userId,
// sorted newest first.
//
// Query params:
//   userId  (required)
//   limit   (optional, default 20)
//   skip    (optional, default 0, for pagination)
router.get('/', async (req, res) => {
  const { userId, limit = 20, skip = 0 } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required' });
  }

  try {
    const sessions = await Session.find({ userId, completed: true })
      .sort({ startTime: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Session.countDocuments({ userId, completed: true });

    res.json({ sessions, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
