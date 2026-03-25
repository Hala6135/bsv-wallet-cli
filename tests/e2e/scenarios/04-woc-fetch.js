/**
 * E2E.1 (revised): WoC is AUDIT ONLY.
 * Verifies all prior transactions landed on-chain via WoC tx lookup.
 * Does NOT fetch BEEF from WoC — that breaks on chained unconfirmed txs (5+ ancestors = 500).
 * The direct BEEF path (scenarios 01-03) is the correct transfer mechanism.
 */
const { verifyOnChain } = require('../lib/woc');

module.exports = {
  name: 'woc-audit',
  description: 'Verify prior transactions exist on WoC (audit only, no BEEF fetch)',

  async run(walletA, walletB, assert) {
    // Get A's recent actions to find txids to audit
    const aActions = await walletA.client.listActions({ labels: ['send'], limit: 10 });
    const actions = aActions.actions || [];

    let audited = 0;
    for (const action of actions) {
      if (action.txid) {
        const woc = await verifyOnChain(action.txid, { maxRetries: 5, baseDelay: 1000 });
        assert(woc.confirmed, `txid ${action.txid.slice(0, 12)}... must be on WoC`);
        audited++;
      }
    }

    assert(audited > 0, 'Must have at least 1 transaction to audit');

    return { txid: null, sats: 0, wocConfirmed: true,
      audited, note: 'WoC audit only — BEEF fetch unreliable on chained unconfirmed txs' };
  },
};
