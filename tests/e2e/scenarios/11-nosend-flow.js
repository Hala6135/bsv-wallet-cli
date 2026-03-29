/**
 * E2E.11: noSend flow — sign but don't broadcast.
 * Tests createAction with noSend:true returns a signed tx without broadcasting,
 * and abortAction releases the locked UTXOs.
 *
 * IMPORTANT: We do NOT have B internalize the nosend tx because
 * internalizeAction broadcasts the tx to the network, which defeats
 * the purpose of noSend and makes the subsequent abort a double-spend.
 *
 * Cost: ~1 miner fee (abort path only)
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'nosend-flow',
  description: 'createAction with noSend:true → verify response → abort releases UTXOs',

  async run(walletA, walletB, assert) {
    const amount = 10_000;

    const balBefore = await walletA.client.balance();
    assert(balBefore >= amount, `A needs at least ${amount} sats, has ${balBefore}`);

    // Step 1: Get B's derived key for P2PKH
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=', ANYONE_KEY, true,
    );
    const lockingScript = buildP2PKH(bKey.publicKey);

    // Step 2: A creates action with noSend:true
    const result = await walletA.client.createAction(
      [{ lockingScript, satoshis: amount, outputDescription: 'noSend test' }],
      'noSend flow test',
      { noSend: true },
    );

    // Step 3: Verify response shape
    assert(result.txid, 'noSend must return txid (tx IS signed)');
    assert(result.txid.length === 64, `txid must be 64 hex chars, got ${result.txid.length}`);
    assert(Array.isArray(result.tx), 'noSend must return tx byte array');
    assert(result.tx.length > 0, 'tx must not be empty');
    assert(
      result.tx[0] === 1 && result.tx[1] === 1 && result.tx[2] === 1 && result.tx[3] === 1,
      'tx must be AtomicBEEF (magic bytes 01010101)',
    );

    // Step 4: Verify noSendChange is present
    assert(result.noSendChange !== undefined, 'noSend must return noSendChange');

    // Step 5: Abort — releases A's locked UTXOs without broadcasting
    const nosendRef = result.reference || result.txid;
    await walletA.client.post('abortAction', { reference: nosendRef });

    // Step 6: Verify A's balance is fully restored after abort
    const balAfter = await walletA.client.balance();
    assert(
      balAfter >= balBefore - 100,
      `Balance should be restored after abort: before=${balBefore}, after=${balAfter}`,
    );
    console.log(`       balance: before=${balBefore}, after=${balAfter} (restored)`);

    return { txid: result.txid, wocConfirmed: 'n/a (noSend)', sats: 0 };
  },
};
