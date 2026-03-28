/**
 * E2E.4: Concurrent sends (FIFO spending lock).
 * Fire multiple simultaneous createAction calls at Wallet A.
 * The FIFO spending lock should serialize them — all should succeed.
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'concurrent-sends',
  description: 'Fire 5 concurrent sends from A — FIFO lock serializes, all succeed',

  async run(walletA, walletB, assert) {
    const sendAmount = 2_000;
    const concurrency = 5;

    // Get B's address for all sends
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=',
      ANYONE_KEY, true,
    );
    const bScript = buildP2PKH(bKey.publicKey);

    const aBalanceBefore = await walletA.client.balance();
    assert(aBalanceBefore >= sendAmount * concurrency,
      `A needs at least ${sendAmount * concurrency} sats, has ${aBalanceBefore}`);

    // Fire all 5 concurrently
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        walletA.client.createAction([{
          lockingScript: bScript,
          satoshis: sendAmount,
          outputDescription: `Concurrent send #${i + 1} of ${concurrency}`,
          tags: ['e2e-concurrent'],
        }], `E2E.4: concurrent #${i + 1}`)
          .then(r => ({ status: 'ok', txid: r.txid, tx: r.tx, index: i }))
          .catch(e => ({ status: 'error', error: e.message, index: i }))
      );
    }

    const results = await Promise.all(promises);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const succeeded = results.filter(r => r.status === 'ok');
    const failed = results.filter(r => r.status === 'error');

    // Report
    for (const r of results) {
      if (r.status === 'ok') {
        console.log(`       #${r.index + 1}: OK txid=${r.txid?.slice(0, 12)}...`);
      } else {
        console.log(`       #${r.index + 1}: FAIL ${r.error.slice(0, 60)}`);
      }
    }
    console.log(`       ${succeeded.length}/${concurrency} succeeded in ${elapsed}s`);

    // All 5 must succeed
    assert(succeeded.length === concurrency,
      `All ${concurrency} sends must succeed, got ${succeeded.length} (${failed.length} failed: ${failed.map(f => f.error.slice(0, 40)).join('; ')})`);

    // All txids must be unique
    const txids = new Set(succeeded.map(r => r.txid));
    assert(txids.size === concurrency,
      `All ${concurrency} txids must be unique, got ${txids.size}`);

    // B internalizes all (so sats can be swept back)
    for (const r of succeeded) {
      if (r.tx && r.tx.length > 0) {
        await walletB.client.internalizeAction(r.tx, [{
          outputIndex: 0,
          protocol: 'wallet payment',
          paymentRemittance: {
            derivationPrefix: 'SfKxPIJNgdI=',
            derivationSuffix: 'NaGLC6fMH50=',
            senderIdentityKey: ANYONE_KEY,
          },
        }], `internalize concurrent send #${r.index + 1}`);
      }
    }

    // Check balances
    const aBalanceAfter = await walletA.client.balance();
    const expectedSpent = sendAmount * concurrency;
    assert(aBalanceAfter < aBalanceBefore,
      `A balance should decrease: was ${aBalanceBefore}, now ${aBalanceAfter}`);

    return {
      txid: succeeded[0]?.txid,
      sats: expectedSpent,
      wocConfirmed: 'n/a',
      succeeded: succeeded.length,
      failed: failed.length,
      elapsed,
    };
  },
};
