# Locked In Factory

**Midterm Study Planner — DIG4503**

A full-stack productivity web app that helps students organize study sessions, track assignments, and stay on top of deadlines. Authentication is handled by Supabase so each user's data is private to their account.

## Features

- **Dashboard** — greeting, study streak, daily/weekly progress, and upcoming deadlines at a glance
- **Study Sessions** — log focused study sessions by subject and track time spent
- **Pomodoro Timer** — 25-minute focus intervals with break reminders
- **Calendar** — visualize sessions and deadlines by month
- **Deadlines** — add, edit, and delete upcoming assignments with due dates
- **Flashcards** — create decks and flip through review cards
- **Auth (Supabase)** — email/password sign up and log in; each page is protected and redirects unauthenticated users to the login screen

---

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 (custom design system) |
| Interactivity | Vanilla JavaScript |
| Authentication | Supabase (email/password via CDN) |
| Backend API | Node.js + Express |
| Database | MongoDB (Mongoose) |
| Dev tooling | Nodemon, dotenv |
| Version control | Git + GitHub |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A [Supabase](https://supabase.com/) account (free tier is fine)
- A MongoDB instance — either [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud, free tier) or a local install


### 1. Clone the repo

```bash
git clone https://github.com/abigail-y/lockedin.git
cd lockedin
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

The app uses Supabase for user authentication. Follow these steps exactly or the login screen will never unlock.

1. Go to [supabase.com](https://supabase.com/) and create a new project.
2. Once the project is ready, open **Settings → API** in the Supabase dashboard.
3. Copy two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (a long JWT string)
4. Open `js/supabase-config.js` and replace the placeholder values:

```js
// js/supabase-config.js
const SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

> **Note:** The anon key is safe to expose in client-side code — it only allows operations that your Supabase Row Level Security (RLS) policies permit.

#### Optional: disable email confirmation (recommended for development)

By default Supabase requires users to confirm their email before they can log in. To skip this during development:

1. In the Supabase dashboard go to **Authentication → Providers → Email**.
2. Turn off **Confirm email**.
3. Save. New sign-ups will now log in immediately without a confirmation link.


### 4. Configure environment variables

Create a `.env` file in the project root (one already exists — just update the values):

```
MONGO_URI=mongodb://localhost:27017/locked-in-factory
PORT=5000
```

If you are using MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string:

```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/locked-in-factory?retryWrites=true&w=majority
```

---

### 5. Run the backend server

```bash
npm run dev      # uses nodemon — auto-restarts on file changes
# or
npm start        # plain node
```

The API will be available at `http://localhost:5000`.


### 6. Open the frontend

The frontend is plain HTML — no build step required. Open `index.html` directly in your browser, or use the VS Code **Live Server** extension (right-click `index.html` → *Open with Live Server*).

> Live Server is recommended because some browsers block certain APIs when loading from `file://`.

## How auth works

- **Homepage (`index.html`)** — shows a blocking overlay with a loading spinner while the Supabase session check runs. If the user is not logged in, the overlay swaps to the login/sign-up card. If they are logged in, the overlay is removed and the dashboard loads normally.
- **Inner pages** (`/pages/*.html`) — on load, each page checks for an active session via `auth.js`. If there is no session the user is immediately redirected back to `index.html`.
- **Log out** — the navbar profile dropdown contains a Log Out button. Signing out clears the session and triggers the login overlay.
- **Per-user data** — `storage.js` namespaces all `localStorage` keys by the Supabase user ID, so data from different accounts never mixes on a shared device.


## Project structure

```
lockedin/
├── index.html              # Dashboard / homepage (also the auth gate)
├── pages/
│   ├── session.html
│   ├── pomodoro.html
│   ├── calendar.html
│   ├── deadlines.html
│   └── flashcards.html
├── css/                    # Stylesheets
├── js/
│   ├── supabase-config.js  # ← put your Supabase URL + anon key here
│   ├── auth.js             # Auth logic (login, signup, logout, route guard)
│   ├── storage.js          # localStorage wrapper (namespaced by user ID)
│   ├── dashboard.js
│   ├── session.js
│   ├── pomodoro.js
│   ├── calendar.js
│   ├── deadlines.js
│   └── flashcards.js
├── server/
│   ├── index.js            # Express entry point
│   ├── config/db.js        # Mongoose connection
│   ├── models/             # Mongoose schemas
│   └── routes/             # API route handlers
├── .env                    # MongoDB URI + port (not committed)
└── package.json
```


## What I learned

Using a feature → task → prompt pipeline is the most effective way for me to work with Claude. Being specific and going step-by-step meant I always understood what was being written and why. Laying out the main features I wanted at the start, then tackling them one at a time, made the whole process smoother and produced cleaner output than open-ended prompts.
