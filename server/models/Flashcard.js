const mongoose = require('mongoose');

const FlashcardSchema = new mongoose.Schema(
  {
    userId: {
      type:     String,
      required: [true, 'userId is required'],
      index:    true,
    },
    deckName: {
      type:      String,
      required:  [true, 'Deck name is required'],
      trim:      true,
      maxlength: [60, 'Deck name must be 60 characters or fewer'],
    },
    question: {
      type:      String,
      required:  [true, 'Question is required'],
      trim:      true,
      maxlength: [500, 'Question must be 500 characters or fewer'],
    },
    answer: {
      type:      String,
      required:  [true, 'Answer is required'],
      trim:      true,
      maxlength: [500, 'Answer must be 500 characters or fewer'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Flashcard', FlashcardSchema);
