require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const connectDB  = require('./config/db');
const sessionRoutes = require('./routes/sessions');
const eventRoutes        = require('./routes/events');
const assignmentRoutes   = require('./routes/assignments');
const flashcardRoutes    = require('./routes/flashcards');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ─────────────────────────────────────
connectDB();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({
  // Allow requests from the frontend (file:// or a local dev server)
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'null'],
  credentials: true,
}));

app.use(express.json());

// ── Routes ─────────────────────────────────────────────────
app.use('/api/sessions', sessionRoutes);
app.use('/api/events',      eventRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/flashcards',  flashcardRoutes);

// ── 404 fallback ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Start server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Locked In Factory server running on http://localhost:${PORT}`);
});
