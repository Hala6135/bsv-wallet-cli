/**
 * E2E.2: Direct wallet-to-wallet transfer via HTTP API.
 * A sends to B using AtomicBEEF from createAction response. No WoC in the loop.
 */
const { verifyOnChain } = require('../lib/woc');
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'direct-transfer',
  description: 'A sends to B via HTTP API, B internalizes AtomicBEEF directly',

  async run(walletA, walletB, assert) {
    const sendAmount = 10_000;

    // Get B's BRC-29 derived public key
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'],
      'SfKxPIJNgdI= NaGLC6fMH50=',
      ANYONE_KEY, true,
    );
    const bScript = buildP2PKH(bKey.publicKey);

    // A creates action (sends + broadcasts via ARC)
    const balanceBefore = await walletB.client.balance();
    const result = await walletA.client.createAction([{
      lockingScript: bScript,
      satoshis: sendAmount,
      outputDescription: 'E2E direct transfer',
      tags: ['e2e-test'],
    }], 'E2E.2: direct transfer A→B');

    assert(result.txid, 'createAction must return txid');
    assert(result.tx && result.tx.length > 0, 'createAction must return tx (AtomicBEEF) bytes');
    // Verify AtomicBEEF magic prefix
    assert(result.tx[0] === 1 && result.tx[1] === 1 && result.tx[2] === 1 && result.tx[3] === 1,
      'tx bytes must start with AtomicBEEF magic [01,01,01,01]');

    // B internalizes directly — no WoC
    const internResult = await walletB.client.internalizeAction(
      result.tx,
      [{
        outputIndex: 0,
        protocol: 'wallet payment',
        paymentRemittance: {
          derivationPrefix: 'SfKxPIJNgdI=',
          derivationSuffix: 'NaGLC6fMH50=',
          senderIdentityKey: ANYONE_KEY,
        },
      }],
      'E2E.2: received from A',
    );
    assert(internResult.accepted === true, 'internalizeAction must accept');

    // Verify B's balance increased
    const balanceAfter = await walletB.client.balance();
    assert(balanceAfter >= balanceBefore + sendAmount,
      `B balance should increase by ${sendAmount}, was ${balanceBefore}, now ${balanceAfter}`);

    // WoC audit (background, non-blocking)
    const woc = await verifyOnChain(result.txid, { maxRetries: 5, baseDelay: 1000 });
    assert(woc.confirmed, 'Transaction must appear on WoC');

    return { txid: result.txid, sats: sendAmount, wocConfirmed: woc.confirmed };
  },
};
