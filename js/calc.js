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
