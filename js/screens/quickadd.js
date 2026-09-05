var QuickAddScreen = (function () {
  var amountStr = '';
  var selectedCategoryId = null;
  var selectedAccountId = null;
  var entryType = 'expense';
  var noteText = '';

  var LS_LAST_ACCOUNT = LS_PREFIX + 'last_account';

  function init() {
    var keypad = document.getElementById('quickadd-keypad');
    keypad.addEventListener('click', function (e) {
      var btn = e.target.closest('.keypad-btn');
      if (!btn) return;
      pressKey(btn.dataset.key);
    });

    document.getElementById('quickadd-chips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      selectCategory(chip.dataset.id);
    });

    document.getElementById('quickadd-type-expense').addEventListener('click', function () {
      setType('expense');
    });
    document.getElementById('quickadd-type-income').addEventListener('click', function () {
      setType('income');
    });

    document.getElementById('quickadd-note-toggle').addEventListener('click', toggleNote);
    document.getElementById('quickadd-save').addEventListener('click', save);
    document.getElementById('quickadd-back').addEventListener('click', close);
  }

  function open(type) {
    amountStr = '';
    selectedCategoryId = null;
    noteText = '';
    entryType = type || 'expense';

    var noteRow = document.getElementById('quickadd-note-row');
    noteRow.hidden = true;
    document.getElementById('quickadd-note').value = '';
    document.getElementById('quickadd-note-toggle').hidden = false;

    var lastAccount = null;
    try { lastAccount = localStorage.getItem(LS_LAST_ACCOUNT); } catch (e) {}

    var accounts = Store.all('accounts').filter(function (a) { return !a.archived; });
    selectedAccountId = null;
    if (lastAccount && accounts.some(function (a) { return a.id === lastAccount; })) {
      selectedAccountId = lastAccount;
    } else if (accounts.length) {
      selectedAccountId = accounts[0].id;
    }

    document.getElementById('quickadd-error').hidden = true;
    Router.show('quickadd-screen');
    render();
  }

  function render() {
    renderAmount();
    renderTypeToggle();
    renderChips();
    renderAccountSelect();
  }

  function renderAmount() {
    var display = document.getElementById('quickadd-amount');
    if (!amountStr) {
      display.textContent = fmtMoney(0);
      return;
    }
    var cents = parseMoney(amountStr);
    display.textContent = cents !== null ? fmtMoney(cents) : CURRENCY.symbol + ' ' + amountStr;
  }

  function renderTypeToggle() {
    var expBtn = document.getElementById('quickadd-type-expense');
    var incBtn = document.getElementById('quickadd-type-income');
    expBtn.classList.toggle('btn-primary', entryType === 'expense');
    incBtn.classList.toggle('btn-primary', entryType === 'income');
  }

  function renderChips() {
    var container = document.getElementById('quickadd-chips');
    clear(container);
    var cats = Store.all('categories');
    var txns = Store.all('transactions');
    var ordered = categoryChipOrder(cats, txns);
    for (var i = 0; i < ordered.length; i++) {
      var cat = ordered[i];
      var chip = el('button', {
        class: 'chip' + (cat.id === selectedCategoryId ? ' selected' : ''),
        text: cat.name,
        dataset: { id: cat.id },
        type: 'button',
      });
      container.appendChild(chip);
    }
  }

  function renderAccountSelect() {
    var select = document.getElementById('quickadd-account');
    clear(select);
    var accounts = Store.all('accounts').filter(function (a) { return !a.archived; });
    for (var i = 0; i < accounts.length; i++) {
      var opt = el('option', { text: accounts[i].name });
      opt.value = accounts[i].id;
      if (accounts[i].id === selectedAccountId) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = function () { selectedAccountId = select.value; };
  }

  function pressKey(key) {
    if (key === 'backspace') {
      amountStr = amountStr.slice(0, -1);
    } else if (key === '.') {
      if (amountStr.indexOf('.') === -1) {
        amountStr += amountStr ? '.' : '0.';
      }
    } else {
      var dotPos = amountStr.indexOf('.');
      if (dotPos !== -1 && amountStr.length - dotPos > 2) return;
      if (amountStr === '0' && key !== '.') amountStr = '';
      amountStr += key;
    }
    renderAmount();
  }

  function selectCategory(id) {
    selectedCategoryId = id;
    renderChips();
  }

  function setType(type) {
    entryType = type;
    renderTypeToggle();
  }

  function toggleNote() {
    var noteRow = document.getElementById('quickadd-note-row');
    var toggle = document.getElementById('quickadd-note-toggle');
    noteRow.hidden = !noteRow.hidden;
    toggle.hidden = !noteRow.hidden;
    if (!noteRow.hidden) {
      document.getElementById('quickadd-note').focus();
    }
  }

  function save() {
    var errorEl = document.getElementById('quickadd-error');

    var cents = parseMoney(amountStr);
    if (!cents || cents <= 0) {
      errorEl.textContent = 'Enter an amount.';
      errorEl.hidden = false;
      return;
    }
    if (!selectedCategoryId) {
      errorEl.textContent = 'Pick a category.';
      errorEl.hidden = false;
      return;
    }

    var noteInput = document.getElementById('quickadd-note');
    noteText = noteInput ? noteInput.value.trim() : '';

    Store.upsert('transactions', {
      date: todayISO(),
      type: entryType,
      amount: cents,
      own_share: cents,
      account_id: selectedAccountId,
      category_id: selectedCategoryId,
      payer: 'me',
      note: noteText || null,
    });

    try { localStorage.setItem(LS_LAST_ACCOUNT, selectedAccountId); } catch (e) {}

    UI.toast(entryType === 'income' ? 'Income saved' : 'Expense saved');
    close();
  }

  function close() {
    Router.show('home-screen');
  }

  return { init: init, open: open };
})();
