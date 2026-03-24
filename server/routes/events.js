const express = require('express');
const router  = express.Router();
const Event   = require('../models/Event');

// ── POST /api/events ───────────────────────────────────────
// Create a new calendar event.
//
// Request body:
// {
//   userId:      string  (required)
//   title:       string  (required, max 100 chars)
//   date:        string  (required, YYYY-MM-DD)
//   description: string  (optional, max 500 chars)
// }
//
// Response 201: created Event document
// Response 400: validation errors as { errors: { field: message } }
router.post('/', async (req, res) => {
  const { userId, title, date, description } = req.body;

  // ── Server-side validation ──────────────────────────────
  const errors = {};

  if (!userId) {
    errors.userId = 'userId is required';
  }
  if (!title || !title.trim()) {
    errors.title = 'Title is required';
  } else if (title.trim().length > 100) {
    errors.title = 'Title must be 100 characters or fewer';
  }
  if (!date) {
    errors.date = 'Date is required';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Date must be in YYYY-MM-DD format';
  } else {
    // Confirm it's a real calendar date
    const parsed = new Date(date + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      errors.date = 'Please enter a valid date';
    }
  }
  if (description && description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const event = await Event.create({
      userId,
      title:       title.trim(),
      date,
      description: description?.trim() || '',
    });

    res.status(201).json({ event });
  } catch (err) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const mongoErrors = {};
      for (const field in err.errors) {
        mongoErrors[field] = err.errors[field].message;
      }
      return res.status(400).json({ errors: mongoErrors });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/events ────────────────────────────────────────
// Return all events for a userId, optionally filtered by month.
//
// Query params:
//   userId  (required)
//   month   (optional) — "YYYY-MM", filters events to that month
//
// Response: { events: [...] } sorted by date ascending
router.get('/', async (req, res) => {
  const { userId, month } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required' });
  }

  try {
    const query = { userId };

    // If month is provided (e.g. "2026-03"), filter events whose date
    // starts with that prefix
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query.date = { $regex: `^${month}` };
    }

    const events = await Event.find(query).sort({ date: 1, createdAt: 1 });

    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/events/:id ─────────────────────────────────
// Delete a single event by its MongoDB _id.
//
// Response 200: { message: 'Event deleted' }
// Response 404: event not found
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted' });
  } catch (err) {
    // Invalid ObjectId format
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
