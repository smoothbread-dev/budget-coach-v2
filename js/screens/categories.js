// Categories screen: create, rename, archive, with subcategory nesting.

var CategoriesScreen = (function () {
  var showArchived = false;

  function init() {
    var addBtn = document.getElementById('categories-add');
    if (addBtn) addBtn.addEventListener('click', openCreateModal);
    var toggleBtn = document.getElementById('categories-toggle-archived');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleArchived);
    Store.subscribe(render);
  }

  function render() {
    var list = document.getElementById('categories-list');
    if (!list) return;
    clear(list);

    var all = Store.all('categories');
    var visible = all.filter(function (c) {
      return showArchived || !c.archived;
    });

    if (!visible.length) {
      list.appendChild(el('li', { class: 'muted', text: showArchived ? 'No categories.' : 'No active categories.' }));
      return;
    }

    var tree = categoryTree(visible);
    tree.forEach(function (node) {
      list.appendChild(buildRow(node, false));
      node.children.forEach(function (child) {
        list.appendChild(buildRow(child, true));
      });
    });

    var toggleBtn = document.getElementById('categories-toggle-archived');
    if (toggleBtn) {
      var archivedCount = all.filter(function (c) { return c.archived; }).length;
      toggleBtn.textContent = showArchived ? 'Hide archived' : 'Show archived (' + archivedCount + ')';
      toggleBtn.hidden = archivedCount === 0 && !showArchived;
    }
  }

  function buildRow(cat, isChild) {
    var kindLabel = CATEGORY_KINDS[cat.kind] || cat.kind;
    var hasChildren = Store.where('categories', function (c) { return c.parent_id === cat.id; }).length > 0;

    var actions = el('span', { class: 'category-actions' }, [
      el('button', {
        class: 'btn btn-link',
        type: 'button',
        'aria-label': 'Rename ' + cat.name,
        text: 'Rename',
        onclick: function () { openRenameModal(cat); },
      }),
      cat.archived
        ? el('button', {
            class: 'btn btn-link',
            type: 'button',
            'aria-label': 'Restore ' + cat.name,
            text: 'Restore',
            onclick: function () { restoreCategory(cat); },
          })
        : el('button', {
            class: 'btn btn-link btn-link-danger',
            type: 'button',
            'aria-label': 'Archive ' + cat.name,
            text: 'Archive',
            onclick: function () { archiveCategory(cat); },
          }),
    ]);

    var infoChildren = [
      el('span', { class: 'category-name', text: cat.name }),
      el('span', { class: 'muted category-kind', text: kindLabel }),
    ];
    if (hasChildren) {
      infoChildren.push(el('span', { class: 'muted category-parent-label', text: 'Parent' }));
    }

    var classes = 'category-row';
    if (isChild) classes += ' category-child';
    if (cat.archived) classes += ' category-archived';

    return el('li', { class: classes }, [
      el('div', { class: 'category-info' }, infoChildren),
      el('div', { class: 'category-right' }, [actions]),
    ]);
  }

  function toggleArchived() {
    showArchived = !showArchived;
    render();
  }

  function openCreateModal() {
    var topLevel = Store.where('categories', function (c) {
      return !c.parent_id && !c.archived;
    }).sort(byName);

    var parentOptions = [el('option', { value: '', text: 'None (top-level)' })];
    topLevel.forEach(function (c) {
      parentOptions.push(el('option', { value: c.id, text: c.name }));
    });

    var kindOptions = Object.keys(CATEGORY_KINDS).map(function (key) {
      return el('option', { value: key, text: CATEGORY_KINDS[key] });
    });

    var nameInput = el('input', { class: 'input', id: 'new-category-name', type: 'text', placeholder: 'Category name', required: true });
    var kindSelect = el('select', { class: 'input', id: 'new-category-kind' }, kindOptions);
    var parentSelect = el('select', { class: 'input', id: 'new-category-parent' }, parentOptions);

    var kindField = el('label', { class: 'field' }, [el('span', { text: 'Kind' }), kindSelect]);

    parentSelect.addEventListener('change', function () {
      var parentId = parentSelect.value;
      if (parentId) {
        var parent = Store.byId('categories', parentId);
        if (parent) {
          kindSelect.value = parent.kind;
          kindField.hidden = true;
        }
      } else {
        kindField.hidden = false;
      }
    });

    var form = el('div', { class: 'modal-form' }, [
      el('label', { class: 'field' }, [el('span', { text: 'Name' }), nameInput]),
      kindField,
      el('label', { class: 'field' }, [el('span', { text: 'Parent' }), parentSelect]),
    ]);

    UI.openModal({
      title: 'New category',
      body: form,
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Create', kind: 'primary', value: true },
      ],
    }).then(function (ok) {
      if (!ok) return;
      var name = nameInput.value.trim();
      var problem = UI.validate([{ value: name, label: 'Name', required: true }]);
      if (problem) { UI.toast(problem, 'error'); return; }

      var parentId = parentSelect.value || null;
      var kind = parentId ? Store.byId('categories', parentId).kind : kindSelect.value;

      Store.upsert('categories', {
        name: name,
        kind: kind,
        parent_id: parentId,
        archived: false,
        sort: 0,
      });
      UI.toast('Category created');
    });
  }

  function openRenameModal(cat) {
    var nameInput = el('input', { class: 'input', type: 'text', value: cat.name });
    var form = el('div', { class: 'modal-form' }, [
      el('label', { class: 'field' }, [el('span', { text: 'Name' }), nameInput]),
    ]);

    UI.openModal({
      title: 'Rename category',
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
      Store.upsert('categories', { id: cat.id, name: name });
      UI.toast('Category renamed');
    });
  }

  function archiveCategory(cat) {
    var hasChildren = Store.where('categories', function (c) { return c.parent_id === cat.id; }).length > 0;
    var message = hasChildren
      ? 'Archive "' + cat.name + '" and all its subcategories?'
      : 'Archive "' + cat.name + '"?';

    UI.confirm(message, {
      title: 'Archive category',
      confirmLabel: 'Archive',
    }).then(function (ok) {
      if (!ok) return;
      Store.upsert('categories', { id: cat.id, archived: true });
      if (hasChildren) {
        Store.where('categories', function (c) { return c.parent_id === cat.id; }).forEach(function (child) {
          Store.upsert('categories', { id: child.id, archived: true });
        });
      }
      UI.toast('Category archived');
    });
  }

  function restoreCategory(cat) {
    Store.upsert('categories', { id: cat.id, archived: false });
    if (cat.parent_id) {
      var parent = Store.byId('categories', cat.parent_id);
      if (parent && parent.archived) {
        Store.upsert('categories', { id: parent.id, archived: false });
      }
    }
    UI.toast('Category restored');
  }

  return { init: init, render: render };
})();
