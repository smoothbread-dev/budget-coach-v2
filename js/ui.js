// DOM helpers. Nothing here knows about money or Supabase.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : value);
  });
  [].concat(children).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const UI = {
  _openModal: null,
  _lastFocus: null,

  toast(message, kind = 'info') {
    const root = document.getElementById('toast-root');
    if (!root) return null;
    const node = el('div', { class: `toast toast-${kind}`, role: 'status', text: message });
    root.appendChild(node);
    setTimeout(() => node.remove(), TOAST_MS);
    return node;
  },

  /** actions: [{ label, kind, value, autofocus }] — resolves with the chosen value. */
  openModal({ title, body, actions = [{ label: 'OK', value: true }], dismissible = true }) {
    UI.closeModal(null);
    UI._lastFocus = document.activeElement;

    const titleId = 'modal-title-' + uid().slice(0, 8);
    const buttons = actions.map((action) =>
      el('button', {
        class: `btn btn-${action.kind || 'default'}`,
        type: 'button',
        'data-value': String(action.value),
        text: action.label,
        onclick: () => UI.closeModal(action.value),
      })
    );

    const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      el('h2', { class: 'modal-title', id: titleId, text: title || '' }),
      typeof body === 'string' ? el('p', { class: 'modal-body', text: body }) : body,
      el('div', { class: 'modal-actions' }, buttons),
    ]);

    const overlay = el('div', { class: 'modal-overlay', id: 'modal-overlay' }, [dialog]);
    if (dismissible) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) UI.closeModal(null);
      });
    }

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dismissible) {
        e.preventDefault();
        UI.closeModal(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.getElementById('modal-root').appendChild(overlay);
    (dialog.querySelector('[autofocus]') || buttons[buttons.length - 1] || dialog).focus();

    return new Promise((resolve) => {
      UI._openModal = { overlay, resolve };
    });
  },

  closeModal(value) {
    const open = UI._openModal;
    if (!open) return;
    UI._openModal = null;
    open.overlay.remove();
    if (UI._lastFocus?.focus) UI._lastFocus.focus();
    open.resolve(value);
  },

  confirm(message, { title = 'Are you sure?', confirmLabel = 'Confirm' } = {}) {
    return UI.openModal({
      title,
      body: message,
      actions: [
        { label: 'Cancel', value: false },
        { label: confirmLabel, kind: 'danger', value: true },
      ],
    }).then(Boolean);
  },

  alert(message, { title = 'Heads up' } = {}) {
    return UI.openModal({ title, body: message, actions: [{ label: 'OK', value: true }] });
  },

  /** rules: [{ value, label, required, min, max }] — returns the first message, or null. */
  validate(rules) {
    for (const rule of rules) {
      const value = rule.value;
      const empty = value === null || value === undefined || String(value).trim() === '';
      if (rule.required && empty) return `${rule.label} is required.`;
      if (empty) continue;
      if (rule.min !== undefined && Number(value) < rule.min) {
        return `${rule.label} must be at least ${rule.min}.`;
      }
      if (rule.max !== undefined && Number(value) > rule.max) {
        return `${rule.label} must be at most ${rule.max}.`;
      }
    }
    return null;
  },
};
