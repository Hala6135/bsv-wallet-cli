/**
 * E2E.8: Transaction history and UTXO accounting.
 * Verifies listActions and listOutputs produce accurate records after all prior scenarios.
 * Run AFTER scenarios 01-08 for maximum coverage.
 * Cost: 0 sats (read-only queries).
 */

module.exports = {
  name: 'history-accounting',
  description: 'listActions/listOutputs match balances (0 sats)',

  async run(walletA, walletB, assert) {
    // --- Wallet A: listOutputs should sum to balance ---
    const aBalance = await walletA.client.balance();
    const aOutputs = await walletA.client.listOutputs('default', {
      limit: 10000, includeEnvelope: false,
    });
    const aOutputList = aOutputs.outputs || aOutputs.BEEF?.outputs || aOutputs || [];

    if (Array.isArray(aOutputList) && aOutputList.length > 0) {
      const aOutputSum = aOutputList.reduce((s, o) => s + (o.satoshis || 0), 0);
      // Allow small discrepancy for outputs in non-default baskets
      assert(Math.abs(aOutputSum - aBalance) < 1000,
        `A outputs sum (${aOutputSum}) should be close to balance (${aBalance})`);
    }

    // --- Wallet A: listActions should have entries ---
    const aActions = await walletA.client.listActions({ limit: 100 });
    const aActionList = aActions.actions || aActions || [];
    if (Array.isArray(aActionList)) {
      assert(aActionList.length > 0, 'A should have transaction history');
    }

    // --- Wallet B: listOutputs should sum to balance ---
    const bBalance = await walletB.client.balance();
    const bOutputs = await walletB.client.listOutputs('default', {
      limit: 10000, includeEnvelope: false,
    });
    const bOutputList = bOutputs.outputs || bOutputs.BEEF?.outputs || bOutputs || [];

    if (Array.isArray(bOutputList) && bOutputList.length > 0) {
      const bOutputSum = bOutputList.reduce((s, o) => s + (o.satoshis || 0), 0);
      assert(Math.abs(bOutputSum - bBalance) < 1000,
        `B outputs sum (${bOutputSum}) should be close to balance (${bBalance})`);
    }

    // --- Wallet B: should also have history ---
    const bActions = await walletB.client.listActions({ limit: 100 });
    const bActionList = bActions.actions || bActions || [];
    if (Array.isArray(bActionList)) {
      assert(bActionList.length > 0, 'B should have transaction history');
    }

    // --- Both wallets still healthy ---
    const aHealth = await walletA.client.isAuthenticated();
    const bHealth = await walletB.client.isAuthenticated();
    assert(aHealth.authenticated, 'A must be healthy');
    assert(bHealth.authenticated, 'B must be healthy');

    return { txid: null, sats: 0, wocConfirmed: 'n/a',
      aBalance, bBalance,
      aActions: Array.isArray(aActionList) ? aActionList.length : '?',
      bActions: Array.isArray(bActionList) ? bActionList.length : '?',
    };
  },
};
