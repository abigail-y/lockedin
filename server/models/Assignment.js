const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
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
    dueDate: {
      type:     String, // YYYY-MM-DD
      required: [true, 'Due date is required'],
      match:    [/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'],
    },
    priority: {
      type:    String,
      enum:    ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type:    String,
      enum:    ['pending', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assignment', AssignmentSchema);
