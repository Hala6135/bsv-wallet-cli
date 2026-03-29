/**
 * E2E.4: Concurrent sends (FIFO spending lock).
 * Fire multiple simultaneous createAction calls at Wallet A.
 * The FIFO spending lock should serialize them — all should succeed.
 *
 * Each send uses a unique derivation path so B can internalize all 5
 * without derivation collision. The keyId format is "{prefix} {suffix}"
 * where the suffix varies per send.
 *
 * Cost: 5 × 2000 sats + 5 fees ≈ 10,150 sats (all recoverable via sweep)
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'concurrent-sends',
  description: 'Fire 5 concurrent sends from A — FIFO lock serializes, all succeed',

  async run(walletA, walletB, assert) {
    const sendAmount = 2_000;
    const concurrency = 5;

    const aBalanceBefore = await walletA.client.balance();
    assert(aBalanceBefore >= sendAmount * concurrency,
      `A needs at least ${sendAmount * concurrency} sats, has ${aBalanceBefore}`);

    // Derive unique receiving address per send (sequential — just setup)
    const sends = [];
    for (let i = 0; i < concurrency; i++) {
      const suffix = `e2eConcSend${i}`;
      const bKey = await walletB.client.getPublicKey(
        [2, '3241645161d8'], `SfKxPIJNgdI= ${suffix}`,
        ANYONE_KEY, true,
      );
      sends.push({ index: i, suffix, script: buildP2PKH(bKey.publicKey) });
    }

    // Fire all 5 concurrently (each to its unique address)
    const start = Date.now();
    const promises = sends.map(s =>
      walletA.client.createAction([{
        lockingScript: s.script,
        satoshis: sendAmount,
        outputDescription: `Concurrent send #${s.index + 1} of ${concurrency}`,
        tags: ['e2e-concurrent'],
      }], `E2E.4: concurrent #${s.index + 1}`)
        .then(r => ({ status: 'ok', txid: r.txid, tx: r.tx, ...s }))
        .catch(e => ({ status: 'error', error: e.message, ...s }))
    );

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

    // B internalizes all 5 (each with its unique derivation suffix)
    for (const r of succeeded) {
      if (r.tx && r.tx.length > 0) {
        await walletB.client.internalizeAction(r.tx, [{
          outputIndex: 0,
          protocol: 'wallet payment',
          paymentRemittance: {
            derivationPrefix: 'SfKxPIJNgdI=',
            derivationSuffix: r.suffix,
            senderIdentityKey: ANYONE_KEY,
          },
        }], `internalize concurrent send #${r.index + 1}`);
      }
    }

    // Check balances
    const aBalanceAfter = await walletA.client.balance();
    assert(aBalanceAfter < aBalanceBefore,
      `A balance should decrease: was ${aBalanceBefore}, now ${aBalanceAfter}`);

    return {
      txid: succeeded[0]?.txid,
      sats: sendAmount * concurrency,
      wocConfirmed: 'n/a',
      succeeded: succeeded.length,
      failed: failed.length,
      elapsed,
    };
  },
};
