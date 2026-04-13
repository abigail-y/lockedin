/* ============================================================
   LOCKED IN FACTORY — Auth Module
   Handles Supabase email/password authentication.

   - Homepage (index.html): shows a blocking overlay until the
     user logs in or signs up. The overlay starts visible and
     is hidden only after a valid session is confirmed.
   - Inner pages: immediately redirect to index.html if there
     is no active session.
   ============================================================ */

// ── Supabase client ──────────────────────────────────────────
const { createClient } = window.supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Page context ─────────────────────────────────────────────
const IS_HOMEPAGE = !window.location.pathname.includes('/pages/');

// ── Auth state listener ──────────────────────────────────────
// Only handles sign-out here. Sign-in is handled by reloading
// the page in _handleLogin / _handleSignup so that storage.js
// re-resolves the user prefix from a clean state.
_supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    if (IS_HOMEPAGE) {
      _showAuthOverlay();
    } else {
      window.location.replace('../index.html');
    }
  }
});

// ── Route guard (runs on every page load) ───────────────────
async function _initAuth() {
  const { data: { session } } = await _supabase.auth.getSession();

  if (IS_HOMEPAGE) {
    if (session) {
      // Logged in — hide overlay entirely, no flash of login form
      _hideAuthOverlay();
      _updateNavbarUser(session.user);
    } else {
      // Not logged in — swap spinner for login card
      const loading = document.getElementById('auth-loading');
      const card    = document.getElementById('auth-card');
      if (loading) loading.classList.add('hidden');
      if (card)    card.classList.remove('hidden');
    }
  } else {
    // Inner page — redirect if unauthenticated
    if (!session) {
      window.location.replace('../index.html');
      return;
    }
    _updateNavbarUser(session.user);
  }
}

// ── Overlay show / hide ──────────────────────────────────────
function _showAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  const loading = document.getElementById('auth-loading');
  const card    = document.getElementById('auth-card');
  if (!overlay) return;
  // Show overlay with the login card (session check already done)
  if (loading) loading.classList.add('hidden');
  if (card)    card.classList.remove('hidden');
  overlay.classList.add('is-open');
}

function _hideAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.remove('is-open');
}

// ── Tab switching ────────────────────────────────────────────
function _initTabs() {
  const loginTab  = document.getElementById('auth-tab-login');
  const signupTab = document.getElementById('auth-tab-signup');
  const loginForm  = document.getElementById('auth-form-login');
  const signupForm = document.getElementById('auth-form-signup');

  if (!loginTab) return;

  loginTab.addEventListener('click', () => {
    loginTab.classList.add('auth-tab--active');
    signupTab.classList.remove('auth-tab--active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    _clearMessages();
  });

  signupTab.addEventListener('click', () => {
    signupTab.classList.add('auth-tab--active');
    loginTab.classList.remove('auth-tab--active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    _clearMessages();
  });
}

// ── Login ────────────────────────────────────────────────────
async function _handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  _setLoading(btn, true, 'Logging in…');
  _clearMessages();

  const { error } = await _supabase.auth.signInWithPassword({ email, password });

  if (error) {
    _showError(error.message);
    _setLoading(btn, false, 'Log In');
    return;
  }
  // Reload so storage.js re-resolves the user prefix with the new session
  window.location.reload();
}

// ── Signup ───────────────────────────────────────────────────
async function _handleSignup(e) {
  e.preventDefault();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  const btn      = document.getElementById('signup-btn');

  if (password !== confirm) {
    _showError('Passwords do not match.');
    return;
  }
  if (password.length < 6) {
    _showError('Password must be at least 6 characters.');
    return;
  }

  _setLoading(btn, true, 'Creating account…');
  _clearMessages();

  const { data, error } = await _supabase.auth.signUp({ email, password });

  if (error) {
    _showError(error.message);
    _setLoading(btn, false, 'Create Account');
    return;
  }

  // If email confirmation is disabled in Supabase, session is returned immediately
  if (data.session) {
    // Reload so storage.js re-resolves the user prefix with the new session
    window.location.reload();
    return;
  }

  // Email confirmation required
  _showSuccess('Account created! Check your email to confirm, then log in.');
  _setLoading(btn, false, 'Create Account');
}

// ── Logout ───────────────────────────────────────────────────
async function _handleLogout() {
  await _supabase.auth.signOut();
  // onAuthStateChange handles the redirect / overlay
}

// ── Navbar user info ─────────────────────────────────────────
function _updateNavbarUser(user) {
  // Keep storage prefix in sync for this session
  if (typeof setStorageUser === 'function') setStorageUser(user.id);

  const emailEl   = document.getElementById('navbar-user-email');
  const logoutBtn = document.getElementById('navbar-logout-btn');

  if (emailEl)   emailEl.textContent = user.email;
  if (logoutBtn) logoutBtn.onclick = _handleLogout;

  // Also update old "profile-name" span on homepage if present
  const profileName = document.getElementById('profile-name');
  if (profileName) profileName.textContent = user.email.split('@')[0];
}

// ── Message helpers ──────────────────────────────────────────
function _showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _showSuccess(msg) {
  const el = document.getElementById('auth-success');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _clearMessages() {
  const errEl  = document.getElementById('auth-error');
  const succEl = document.getElementById('auth-success');
  if (errEl)  { errEl.textContent  = ''; errEl.classList.add('hidden'); }
  if (succEl) { succEl.textContent = ''; succEl.classList.add('hidden'); }
}

function _setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = label;
}

// ── Bootstrap ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _initTabs();

  const loginForm  = document.getElementById('auth-form-login');
  const signupForm = document.getElementById('auth-form-signup');
  if (loginForm)  loginForm.addEventListener('submit', _handleLogin);
  if (signupForm) signupForm.addEventListener('submit', _handleSignup);

  _initAuth();
});
