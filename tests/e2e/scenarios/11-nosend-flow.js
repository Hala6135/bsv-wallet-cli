/**
 * E2E.11: noSend flow — sign but don't broadcast.
 * Tests createAction with noSend:true returns a signed tx without broadcasting.
 * Also verifies the tx can be used for internalizeAction on the recipient.
 * Cost: ~10000 sats
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'nosend-flow',
  description: 'createAction with noSend:true returns signed tx without broadcasting',

  async run(walletA, walletB, assert) {
    const amount = 10_000;

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

    // Step 5: B internalizes the signed-but-not-broadcast tx directly.
    // senderIdentityKey MUST match the counterparty used in getPublicKey above (ANYONE_KEY),
    // otherwise B's wallet records the wrong derivation path and the output becomes unspendable.
    const internalized = await walletB.client.internalizeAction(
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
      'received noSend tx from A',
    );
    assert(internalized.accepted === true, 'B must accept the noSend tx');

    // Abort the nosend tx to release A's locked UTXOs — don't leave the wallet dirty
    const nosendRef = result.reference || result.txid;
    await walletA.client.post('abortAction', { reference: nosendRef });

    return { txid: result.txid, wocConfirmed: 'n/a (noSend)', sats: amount };
  },
};
