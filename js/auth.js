// Supabase Auth over plain REST. Session lives in localStorage so relaunching the app
// never shows a sign-in wall.

const Auth = {
  _session: null,
  _listeners: new Set(),

  load() {
    Auth._session = lsGet(LS.session, null);
    return Auth._session;
  },

  session() {
    return Auth._session;
  },

  user() {
    return Auth._session?.user || null;
  },

  userId() {
    return Auth._session?.user?.id || null;
  },

  isSignedIn() {
    return Boolean(Auth._session?.access_token);
  },

  onChange(fn) {
    Auth._listeners.add(fn);
    return () => Auth._listeners.delete(fn);
  },

  _emit() {
    Auth._listeners.forEach((fn) => {
      try {
        fn(Auth._session);
      } catch (err) {
        console.error('auth listener failed', err);
      }
    });
  },

  _setSession(session) {
    Auth._session = session;
    if (session) lsSet(LS.session, session);
    else lsRemove(LS.session);
    Auth._emit();
  },

  async _post(path, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Request failed');
    return data;
  },

  async signIn(email, password) {
    const data = await Auth._post('token?grant_type=password', { email, password });
    if (!data.access_token) throw new Error('Sign in failed');
    Auth._setSession(data);
    return data;
  },

  async signUp(email, password) {
    const data = await Auth._post('signup', { email, password });
    // Projects with email confirmation return a user but no token.
    if (data.access_token) Auth._setSession(data);
    return data;
  },

  async requestPasswordReset(email) {
    return Auth._post('recover', { email });
  },

  async signOut() {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${Auth._session?.access_token || ''}`,
        },
      });
    } catch {
      /* signing out locally matters more than telling the server */
    }
    Auth._setSession(null);
    Store.reset();
  },
};
