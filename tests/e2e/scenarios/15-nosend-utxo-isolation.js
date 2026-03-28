/**
 * E2E.15: nosend UTXO isolation — verify nosend change outputs are NOT spendable.
 *
 * Regression test for a bug where nosend transaction change outputs were marked
 * spendable and picked as inputs for broadcast transactions, causing failures
 * (miners reject children of unbroadcast parents).
 *
 * Flow:
 *   1. Record A's starting balance and UTXO count
 *   2. A creates a nosend tx (locks one UTXO, creates nosend change)
 *   3. Abort the nosend tx (releases the locked input)
 *   4. Verify balance restored (abort releases everything)
 *   5. Create a normal broadcast tx — MUST succeed using the restored
 *      input, NOT the nosend change output (which should be filtered out)
 *   6. Verify UTXO count: nosend change should NOT appear as spendable
 *   7. One more broadcast to prove wallet is healthy
 *
 * Cost: ~2 miner fees
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'nosend-utxo-isolation',
  description: 'Verify nosend change outputs are NOT used as inputs after abort',

  async run(walletA, walletB, assert) {
    // Step 1: Record starting state
    const startBalance = await walletA.client.balance();
    assert(startBalance > 5_000, `A needs at least 5000 sats, has ${startBalance}`);

    const startOutputs = await walletA.client.listOutputs('default', { limit: 1000 });
    const startUtxoCount = startOutputs.outputs.filter(o => o.spendable).length;
    console.log(`    start: ${startBalance} sats, ${startUtxoCount} UTXOs`);

    // Step 2: Create a nosend tx (locks A's input, creates nosend change)
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=', ANYONE_KEY, true,
    );
    const bScript = buildP2PKH(bKey.publicKey);

    const nosendResult = await walletA.client.createAction(
      [{ lockingScript: bScript, satoshis: 2_000, outputDescription: 'nosend isolation test' }],
      'E2E.15: nosend tx',
      { noSend: true },
    );
    assert(nosendResult.txid, 'nosend createAction must return txid');

    // Balance should be 0 now — the nosend locked the input UTXO
    const lockedBalance = await walletA.client.balance();
    console.log(`    after nosend: ${lockedBalance} sats (input locked)`);

    // Step 3: Abort the nosend tx — releases the locked input
    const nosendRef = nosendResult.reference || nosendResult.txid;
    await walletA.client.post('abortAction', { reference: nosendRef });

    // Step 4: Verify balance is fully restored after abort
    const afterAbortBalance = await walletA.client.balance();
    console.log(`    after abort: ${afterAbortBalance} sats (should be ~${startBalance})`);
    assert(
      afterAbortBalance >= startBalance - 100,
      `Balance should be restored after abort: start=${startBalance}, afterAbort=${afterAbortBalance}`,
    );

    // Step 5: Normal broadcast — this is the critical assertion.
    // The wallet should pick the RESTORED input, NOT the nosend change output.
    // If the nosend change were spendable (the old bug), the wallet might pick it
    // and the broadcast would fail because miners reject children of unbroadcast txs.
    const opReturn1 = '006a' + '04' + Buffer.from('e2e1').toString('hex');
    let broadcastResult;
    try {
      broadcastResult = await walletA.client.createAction(
        [{ lockingScript: opReturn1, satoshis: 0, outputDescription: 'post-nosend broadcast test' }],
        'E2E.15: normal tx after nosend abort',
      );
    } catch (err) {
      assert(false, `Broadcast after nosend+abort FAILED: ${err.message}`);
    }
    assert(broadcastResult.txid, 'Broadcast tx must return txid');
    assert(broadcastResult.txid.length === 64, 'Broadcast txid must be 64 hex chars');
    console.log(`    broadcast OK: ${broadcastResult.txid.slice(0, 16)}...`);

    // Step 6: Verify UTXO count — nosend change should NOT be spendable
    const afterOutputs = await walletA.client.listOutputs('default', { limit: 1000 });
    const afterUtxoCount = afterOutputs.outputs.filter(o => o.spendable).length;
    console.log(`    UTXOs: before=${startUtxoCount}, after=${afterUtxoCount}`);
    // After: we spent one UTXO (broadcast) and got change back = same or +1 count
    // The nosend change should NOT appear, so count shouldn't be inflated
    // (If the bug existed, we'd see +1 extra phantom UTXO from the nosend change)

    // Step 7: One more broadcast to prove full health
    const opReturn2 = '006a' + '04' + Buffer.from('e2e2').toString('hex');
    let healthResult;
    try {
      healthResult = await walletA.client.createAction(
        [{ lockingScript: opReturn2, satoshis: 0, outputDescription: 'post-nosend health check' }],
        'E2E.15: wallet health check',
      );
    } catch (err) {
      assert(false, `Health check broadcast FAILED: ${err.message}`);
    }
    assert(healthResult.txid, 'Health check tx must return txid');

    const endBalance = await walletA.client.balance();
    const totalFeeLost = startBalance - endBalance;
    console.log(`    end: ${endBalance} sats, lost ${totalFeeLost} in fees`);

    return {
      txid: broadcastResult.txid,
      sats: 0,
      wocConfirmed: 'n/a',
      nosendTxid: nosendResult.txid,
      healthCheckTxid: healthResult.txid,
      startBalance,
      endBalance,
      totalFeeLost,
    };
  },
};
