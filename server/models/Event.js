const mongoose = require('mongoose');

/**
 * Event Schema
 *
 * userId      — anonymous browser ID from localStorage (sp_user_id).
 * title       — event name, required, max 100 chars.
 * date        — stored as YYYY-MM-DD string for fast, join-free
 *               filtering by day or month without timezone issues.
 * description — optional freeform notes for the event.
 */
const EventSchema = new mongoose.Schema(
  {
    userId: {
      type:     String,
      required: [true, 'userId is required'],
      index:    true,
    },
    title: {
      type:      String,
      required:  [true, 'Title is required'],
      trim:      true,
      maxlength: [100, 'Title must be 100 characters or fewer'],
    },
    date: {
      type:     String,        // YYYY-MM-DD
      required: [true, 'Date is required'],
      match:    [
        /^\d{4}-\d{2}-\d{2}$/,
        'Date must be in YYYY-MM-DD format',
      ],
    },
    description: {
      type:      String,
      default:   '',
      trim:      true,
      maxlength: [500, 'Description must be 500 characters or fewer'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', EventSchema);
