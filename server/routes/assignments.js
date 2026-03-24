const express    = require('express');
const router     = express.Router();
const Assignment = require('../models/Assignment');

// ── POST /api/assignments ──────────────────────────────────
// Create a new assignment.
router.post('/', async (req, res) => {
  const { userId, title, dueDate, priority } = req.body;

  const errors = {};
  if (!userId)              errors.userId  = 'userId is required';
  if (!title?.trim())       errors.title   = 'Title is required';
  if (!dueDate)             errors.dueDate = 'Due date is required';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
                            errors.dueDate = 'Due date must be YYYY-MM-DD';
  if (priority && !['low', 'medium', 'high'].includes(priority))
                            errors.priority = 'Priority must be low, medium, or high';

  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const assignment = await Assignment.create({
      userId,
      title: title.trim(),
      dueDate,
      priority: priority || 'medium',
    });
    res.status(201).json({ assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/assignments ───────────────────────────────────
// Get all assignments for a user, sorted by dueDate ascending.
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const assignments = await Assignment.find({ userId }).sort({ dueDate: 1 });
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/assignments/:id ─────────────────────────────
// Update an assignment (status toggle or field edit).
router.patch('/:id', async (req, res) => {
  const allowed = ['title', 'dueDate', 'priority', 'status'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No valid fields to update' });

  try {
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ assignment });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID' });
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/assignments/:id ────────────────────────────
// Delete an assignment.
router.delete('/:id', async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
