// Screens are .screen divs; exactly one carries .active. Hash-based so the phone
// back button works.

const Router = {
  current: null,
  _listeners: new Set(),

  screens() {
    return [...document.querySelectorAll('.screen')].map((node) => node.id);
  },

  exists(id) {
    return Boolean(id && document.getElementById(id)?.classList.contains('screen'));
  },

  show(id, { updateHash = true } = {}) {
    if (!Router.exists(id)) return false;
    document.querySelectorAll('.screen').forEach((node) => {
      node.classList.toggle('active', node.id === id);
    });
    Router.current = id;
    if (updateHash) {
      const hash = '#' + id.replace(/-screen$/, '');
      if (location.hash !== hash) history.replaceState(null, '', hash);
    }
    document.body.dataset.screen = id;
    Router._listeners.forEach((fn) => fn(id));
    return true;
  },

  onChange(fn) {
    Router._listeners.add(fn);
    return () => Router._listeners.delete(fn);
  },

  fromHash() {
    const raw = location.hash.replace(/^#/, '').trim();
    if (!raw) return null;
    const id = raw.endsWith('-screen') ? raw : raw + '-screen';
    return Router.exists(id) ? id : null;
  },
};

function initRouter(fallbackId) {
  window.addEventListener('hashchange', () => {
    const id = Router.fromHash();
    if (id && id !== Router.current) Router.show(id, { updateHash: false });
  });
  Router.show(Router.fromHash() || fallbackId);
}
