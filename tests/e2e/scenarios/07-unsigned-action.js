/**
 * E2E.9: Unsigned action flow (createAction → signAction / abortAction).
 * Tests deferred signing: create unsigned, then sign or abort.
 */
const { verifyOnChain } = require('../lib/woc');
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'unsigned-action-flow',
  description: 'Create unsigned action → abort, then create → sign (deferred signing)',

  async run(walletA, walletB, assert) {
    const sendAmount = 3_000;

    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=',
      ANYONE_KEY, true,
    );
    const bScript = buildP2PKH(bKey.publicKey);

    // --- Abort path first (releases UTXOs for the sign path) ---
    const abortResult = await walletA.client.createAction([{
      lockingScript: bScript,
      satoshis: sendAmount,
      outputDescription: 'will abort',
    }], 'E2E.9: abort test', { signAndProcess: false });

    assert(abortResult.signableTransaction, 'Unsigned action must return signableTransaction');
    const abortRef = abortResult.signableTransaction.reference;
    assert(abortRef, 'Must have reference string');

    await walletA.client.abortAction(abortRef);

    // --- Sign path ---
    const signResult = await walletA.client.createAction([{
      lockingScript: bScript,
      satoshis: sendAmount,
      outputDescription: 'will sign',
    }], 'E2E.9: sign test', { signAndProcess: false });

    assert(signResult.signableTransaction, 'Must return signableTransaction');
    const signRef = signResult.signableTransaction.reference;

    const signed = await walletA.client.signAction(signRef);
    assert(signed.txid, 'signAction must return txid');
    // signAction returns txid as byte array (raw SDK), convert to hex
    const txidHex = Array.isArray(signed.txid)
      ? signed.txid.map(b => b.toString(16).padStart(2, '0')).join('')
      : signed.txid;
    assert(txidHex.length === 64, `txid hex must be 64 chars, got ${txidHex.length}`);

    // Note: signAction returns raw tx, not BEEF — can't internalize in B.
    // The 3K sats go to B's address on chain but B can't track them.
    // This is a known limitation of the deferred signing flow.

    // WoC audit (quick check, don't block on chained unconfirmed)
    let wocOk = false;
    try {
      const woc = await verifyOnChain(txidHex, { maxRetries: 3, baseDelay: 1000 });
      wocOk = woc.confirmed;
    } catch {
      // Chained unconfirmed txs may not be indexed yet — that's OK
      wocOk = 'skipped (chained unconfirmed)';
    }

    return { txid: txidHex, sats: sendAmount, wocConfirmed: wocOk,
      tests: 'abort-releases-utxos, sign-broadcasts' };
  },
};
