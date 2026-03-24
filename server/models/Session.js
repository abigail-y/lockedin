const mongoose = require('mongoose');

/**
 * Session Schema
 *
 * userId          — anonymous browser ID stored in localStorage (sp_user_id).
 *                   No auth system yet; this ties sessions to a specific browser.
 * subjectId       — matches the ID used in localStorage sp_subjects.
 * subjectName     — denormalized for quick display without a join.
 * startTime       — set when POST /start-session is called.
 * endTime         — set when POST /end-session is called. Null while in progress.
 * durationMinutes — calculated on end. 0 while in progress.
 * notes           — optional notes added during or after the session.
 * mood            — self-reported focus level after the session.
 * tags            — optional labels (e.g. "exam-prep", "homework").
 * completed       — false while session is open, true once ended.
 */
const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type:     String,
      required: [true, 'userId is required'],
      index:    true,
    },
    subjectId: {
      type:    String,
      default: null,
    },
    subjectName: {
      type:    String,
      default: 'General',
      trim:    true,
    },
    startTime: {
      type:     Date,
      required: [true, 'startTime is required'],
    },
    endTime: {
      type:    Date,
      default: null,
    },
    durationMinutes: {
      type:    Number,
      default: 0,
      min:     0,
    },
    notes: {
      type:    String,
      default: '',
      trim:    true,
    },
    mood: {
      type:    String,
      enum:    ['focused', 'neutral', 'distracted'],
      default: 'neutral',
    },
    tags: {
      type:    [String],
      default: [],
    },
    completed: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('Session', SessionSchema);
