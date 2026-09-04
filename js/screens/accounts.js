// Accounts screen: create, rename, archive, view balances.

var AccountsScreen = (function () {
  var showArchived = false;

  function init() {
    var addBtn = document.getElementById('accounts-add');
    if (addBtn) addBtn.addEventListener('click', openCreateModal);
    var toggleBtn = document.getElementById('accounts-toggle-archived');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleArchived);
    Store.subscribe(render);
  }

  function render() {
    var list = document.getElementById('accounts-list');
    if (!list) return;
    clear(list);

    var accounts = Store.all('accounts').filter(function (a) {
      return showArchived || !a.archived;
    });
    var transactions = Store.all('transactions');

    if (!accounts.length) {
      list.appendChild(el('li', { class: 'muted', text: showArchived ? 'No accounts.' : 'No active accounts.' }));
      return;
    }

    accounts.sort(byName);
    accounts.forEach(function (acct) {
      var meta = ACCOUNT_TYPES[acct.type] || {};
      var balance = accountBalance(acct.id, Store.all('accounts'), transactions);
      var balanceText = fmtMoney(balance);

      var actions = el('span', { class: 'account-actions' }, [
        el('button', {
          class: 'btn btn-link',
          type: 'button',
          'aria-label': 'Rename ' + acct.name,
          text: 'Rename',
          onclick: function () { openRenameModal(acct); },
        }),
        acct.archived
          ? el('button', {
              class: 'btn btn-link',
              type: 'button',
              'aria-label': 'Restore ' + acct.name,
              text: 'Restore',
              onclick: function () { restoreAccount(acct); },
            })
          : el('button', {
              class: 'btn btn-link btn-link-danger',
              type: 'button',
              'aria-label': 'Archive ' + acct.name,
              text: 'Archive',
              onclick: function () { archiveAccount(acct); },
            }),
      ]);

      var row = el('li', { class: 'account-row' + (acct.archived ? ' account-archived' : '') }, [
        el('div', { class: 'account-info' }, [
          el('span', { class: 'account-name', text: acct.name }),
          el('span', { class: 'muted account-type', text: meta.label || acct.type }),
        ]),
        el('div', { class: 'account-right' }, [
          el('span', { class: 'num account-balance', text: balanceText }),
          actions,
        ]),
      ]);
      list.appendChild(row);
    });

    var toggleBtn = document.getElementById('accounts-toggle-archived');
    if (toggleBtn) {
      var archivedCount = Store.all('accounts').filter(function (a) { return a.archived; }).length;
      toggleBtn.textContent = showArchived ? 'Hide archived' : 'Show archived (' + archivedCount + ')';
      toggleBtn.hidden = archivedCount === 0 && !showArchived;
    }
  }

  function toggleArchived() {
    showArchived = !showArchived;
    render();
  }

  function openCreateModal() {
    var typeOptions = Object.keys(ACCOUNT_TYPES).map(function (key) {
      return el('option', { value: key, text: ACCOUNT_TYPES[key].label });
    });

    var nameInput = el('input', { class: 'input', id: 'new-account-name', type: 'text', placeholder: 'Account name', required: true });
    var typeSelect = el('select', { class: 'input', id: 'new-account-type' }, typeOptions);
    var balanceInput = el('input', { class: 'input', id: 'new-account-balance', type: 'text', inputmode: 'decimal', placeholder: '0.00' });

    var form = el('div', { class: 'modal-form' }, [
      el('label', { class: 'field' }, [el('span', { text: 'Name' }), nameInput]),
      el('label', { class: 'field' }, [el('span', { text: 'Type' }), typeSelect]),
      el('label', { class: 'field' }, [el('span', { text: 'Opening balance (' + CURRENCY.symbol + ')' }), balanceInput]),
    ]);

    UI.openModal({
      title: 'New account',
      body: form,
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Create', kind: 'primary', value: true },
      ],
    }).then(function (ok) {
      if (!ok) return;
      var name = nameInput.value.trim();
      var type = typeSelect.value;
      var balanceCents = parseMoney(balanceInput.value) || 0;
      var problem = UI.validate([{ value: name, label: 'Name', required: true }]);
      if (problem) { UI.toast(problem, 'error'); return; }
      Store.upsert('accounts', {
        name: name,
        type: type,
        opening_balance: balanceCents,
        archived: false,
      });
      UI.toast('Account created');
    });
  }

  function openRenameModal(acct) {
    var nameInput = el('input', { class: 'input', type: 'text', value: acct.name });
    var form = el('div', { class: 'modal-form' }, [
      el('label', { class: 'field' }, [el('span', { text: 'Name' }), nameInput]),
    ]);

    UI.openModal({
      title: 'Rename account',
      body: form,
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Save', kind: 'primary', value: true },
      ],
    }).then(function (ok) {
      if (!ok) return;
      var name = nameInput.value.trim();
      var problem = UI.validate([{ value: name, label: 'Name', required: true }]);
      if (problem) { UI.toast(problem, 'error'); return; }
      Store.upsert('accounts', { id: acct.id, name: name });
      UI.toast('Account renamed');
    });
  }

  function archiveAccount(acct) {
    UI.confirm('Archive "' + acct.name + '"? It will be hidden but its transactions will remain.', {
      title: 'Archive account',
      confirmLabel: 'Archive',
    }).then(function (ok) {
      if (!ok) return;
      Store.upsert('accounts', { id: acct.id, archived: true });
      UI.toast('Account archived');
    });
  }

  function restoreAccount(acct) {
    Store.upsert('accounts', { id: acct.id, archived: false });
    UI.toast('Account restored');
  }

  return { init: init, render: render };
})();
