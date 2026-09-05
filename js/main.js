// Boot: paint from cache first, reconcile with the server afterwards.

let authMode = 'signin';

const NOT_CONFIGURED =
  'This copy of Budget Coach has no Supabase project attached yet. See the README for local setup.';

/** Local dev only: js/config.local.json supplies the credentials Actions injects in production. */
async function loadLocalConfig() {
  if (isSupabaseConfigured()) return;
  try {
    const res = await fetch('./js/config.local.json', { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.url) SUPABASE_URL = cfg.url.replace(/\/$/, '');
    if (cfg.key) SUPABASE_KEY = cfg.key;
  } catch {
    /* no local config - the placeholder warning below explains what to do */
  }
}

function renderConfigNotice() {
  const notice = document.getElementById('config-notice');
  if (!notice) return;
  notice.hidden = isSupabaseConfigured();
  notice.textContent = NOT_CONFIGURED;
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-submit').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  document.getElementById('auth-toggle').textContent =
    mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in';
  document.getElementById('auth-title').textContent = mode === 'signin' ? 'Welcome back' : 'Create your account';
  setAuthError('');
}

function setAuthError(message) {
  const node = document.getElementById('auth-error');
  node.textContent = message;
  node.hidden = !message;
}

async function submitAuth(event) {
  event?.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const problem = UI.validate([
    { value: email, label: 'Email', required: true },
    { value: password, label: 'Password', required: true },
  ]);
  if (problem) return setAuthError(problem);
  if (!isSupabaseConfigured()) return setAuthError(NOT_CONFIGURED);

  const button = document.getElementById('auth-submit');
  button.disabled = true;
  setAuthError('');
  try {
    if (authMode === 'signin') await Auth.signIn(email, password);
    else {
      const result = await Auth.signUp(email, password);
      if (!result.access_token) {
        setAuthError('Check your inbox to confirm your email, then sign in.');
        setAuthMode('signin');
        return;
      }
    }
  } catch (err) {
    // A TypeError here means the request never left the browser.
    setAuthError(
      err instanceof TypeError
        ? 'Could not reach the server. Check your connection and Supabase settings.'
        : err.message || 'Could not sign you in.'
    );
  } finally {
    button.disabled = false;
  }
}

function seedDefaults() {
  if (Store.all('accounts').length === 0) {
    SEED_ACCOUNTS.forEach(function (seed) {
      Store.upsert('accounts', {
        name: seed.name,
        type: seed.type,
        opening_balance: 0,
        archived: false,
      }, { queue: false });
    });
  }

  if (Store.all('categories').length === 0) {
    SEED_CATEGORIES.forEach(function (seed) {
      Store.upsert('categories', {
        name: seed.name,
        kind: seed.kind,
        parent_id: null,
        archived: false,
        sort: 0,
      }, { queue: false });
    });
  }
}

function renderShell() {
  const signedIn = Auth.isSignedIn();
  document.body.dataset.signedIn = String(signedIn);

  if (!signedIn) {
    Router.show('auth-screen');
    return;
  }
  if (Router.current === 'auth-screen' || !Router.current) {
    // The hash still points at #auth right after signing in, so never honour it here.
    const target = Router.fromHash();
    Router.show(target && target !== 'auth-screen' ? target : 'home-screen');
  }
  renderHome();
}

function renderHome() {
  const email = document.getElementById('home-email');
  if (email) email.textContent = Auth.user()?.email || '';

  const counts = document.getElementById('home-counts');
  if (counts) {
    clear(counts);
    TABLES.filter((table) => Store.all(table).length).forEach((table) => {
      counts.appendChild(
        el('li', {}, [
          el('span', { text: table.replace(/_/g, ' ') }),
          el('span', { class: 'num', text: String(Store.all(table).length) }),
        ])
      );
    });
    if (!counts.children.length) {
      counts.appendChild(el('li', { class: 'muted', text: 'No data yet.' }));
    }
  }

  const status = document.getElementById('sync-status');
  if (status) {
    const pending = Sync.pendingCount();
    status.textContent = pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync` : 'All changes saved';
    status.dataset.pending = String(pending);
  }
}

async function boot() {
  await loadLocalConfig();
  Auth.load();
  Store.load();
  if (Auth.isSignedIn()) seedDefaults();
  initSync();
  initRouter(Auth.isSignedIn() ? 'home-screen' : 'auth-screen');

  Store.subscribe(renderHome);
  Auth.onChange(() => {
    renderShell();
    if (Auth.isSignedIn()) hydrateInBackground();
  });

  AccountsScreen.init();
  CategoriesScreen.init();
  QuickAddScreen.init();
  Router.onChange(function (id) {
    if (id === 'accounts-screen') AccountsScreen.render();
    if (id === 'categories-screen') CategoriesScreen.render();
  });

  document.getElementById('auth-form').addEventListener('submit', submitAuth);
  document.getElementById('auth-toggle').addEventListener('click', () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  });
  document.getElementById('auth-reset').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) return setAuthError('Enter your email first.');
    if (!isSupabaseConfigured()) return setAuthError(NOT_CONFIGURED);
    try {
      await Auth.requestPasswordReset(email);
      UI.toast('Password reset email sent');
    } catch {
      setAuthError('Could not send the reset email.');
    }
  });
  document.getElementById('sign-out').addEventListener('click', async () => {
    if (await UI.confirm('Sign out of Budget Coach?', { confirmLabel: 'Sign out' })) {
      await Auth.signOut();
    }
  });

  document.getElementById('home-nav').addEventListener('click', (e) => {
    const target = e.target.closest('[data-screen]');
    if (target) Router.show(target.dataset.screen);
  });

  document.getElementById('home-quickadd').addEventListener('click', () => {
    QuickAddScreen.open('expense');
  });

  setAuthMode('signin');
  renderConfigNotice();
  renderShell();

  // The UI is usable from here; the network catches up behind it.
  document.body.dataset.booted = '1';
  if (Auth.isSignedIn()) hydrateInBackground();
}

async function hydrateInBackground() {
  const ok = await Sync.hydrate();
  seedDefaults();
  renderHome();
  document.body.dataset.hydrated = ok ? '1' : 'failed';
  if (ok && Store.dirty.length) Sync.flush();
}

document.addEventListener('DOMContentLoaded', boot);
