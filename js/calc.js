// Pure money maths. No DOM, no state, no I/O.

/**
 * Running balance for an account, derived from its opening balance and every
 * transaction that touches it. Never stored — always computed.
 *
 * balance = opening_balance + income − expenses ± transfers
 */
function accountBalance(accountId, accounts, transactions) {
  const account = accounts.find(function (a) { return a.id === accountId; });
  if (!account) return 0;
  var total = account.opening_balance || 0;
  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    if (tx.account_id !== accountId) continue;
    var amount = tx.amount || 0;
    if (tx.type === 'income') total += amount;
    else if (tx.type === 'expense') total -= amount;
    else if (tx.type === 'transfer_in') total += amount;
    else if (tx.type === 'transfer_out') total -= amount;
  }
  return total;
}

function categoryTree(categories) {
  var parentIds = {};
  for (var i = 0; i < categories.length; i++) {
    if (!categories[i].parent_id) parentIds[categories[i].id] = true;
  }

  var roots = [];
  var childrenMap = {};

  for (var j = 0; j < categories.length; j++) {
    var cat = categories[j];
    if (cat.parent_id && parentIds[cat.parent_id]) {
      if (!childrenMap[cat.parent_id]) childrenMap[cat.parent_id] = [];
      childrenMap[cat.parent_id].push(cat);
    } else {
      roots.push(cat);
    }
  }

  return roots.map(function (root) {
    return {
      id: root.id,
      name: root.name,
      kind: root.kind,
      archived: root.archived,
      sort: root.sort,
      parent_id: root.parent_id,
      children: (childrenMap[root.id] || []).slice().sort(byName),
    };
  }).sort(byName);
}

function leafCategories(categories) {
  var hasChildren = {};
  for (var i = 0; i < categories.length; i++) {
    var pid = categories[i].parent_id;
    if (pid) hasChildren[pid] = true;
  }
  return categories.filter(function (c) {
    return !hasChildren[c.id];
  });
}

function categoryChipOrder(categories, transactions) {
  var leaves = leafCategories(categories).filter(function (c) { return !c.archived; });
  var stats = {};
  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    if (!tx.category_id) continue;
    var s = stats[tx.category_id];
    if (!s) {
      s = { lastUsed: tx.date || '', count: 0 };
      stats[tx.category_id] = s;
    }
    s.count++;
    if ((tx.date || '') > s.lastUsed) s.lastUsed = tx.date;
  }
  return leaves.slice().sort(function (a, b) {
    var sa = stats[a.id] || { lastUsed: '', count: 0 };
    var sb = stats[b.id] || { lastUsed: '', count: 0 };
    if (sa.lastUsed !== sb.lastUsed) return sa.lastUsed > sb.lastUsed ? -1 : 1;
    if (sa.count !== sb.count) return sb.count - sa.count;
    return byName(a, b);
  });
}
