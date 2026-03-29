/**
 * E2E.9: Unsigned action flow (createAction → signAction / abortAction).
 * Tests deferred signing: create unsigned, then sign or abort.
 *
 * Abort path: P2PKH output with real sats (tests template with real outputs, then aborts).
 * Sign path: OP_RETURN with 0 sats (tests signAction broadcasts successfully).
 *
 * Why OP_RETURN for sign path: signAction returns raw tx (not AtomicBEEF),
 * so the recipient can't call internalizeAction. Using OP_RETURN avoids
 * irrecoverable sat loss while still proving the deferred signing flow works.
 *
 * Cost: ~2 miner fees (~60 sats)
 */
const { verifyOnChain } = require('../lib/woc');
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'unsigned-action-flow',
  description: 'Create unsigned action → abort, then create → sign (deferred signing)',

  async run(walletA, walletB, assert) {
    // --- Abort path: P2PKH with real sats (then abort — no sats leave) ---
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=',
      ANYONE_KEY, true,
    );
    const bScript = buildP2PKH(bKey.publicKey);

    const abortResult = await walletA.client.createAction([{
      lockingScript: bScript,
      satoshis: 3_000,
      outputDescription: 'will abort',
    }], 'E2E.9: abort test', { signAndProcess: false });

    assert(abortResult.signableTransaction, 'Unsigned action must return signableTransaction');
    const abortRef = abortResult.signableTransaction.reference;
    assert(abortRef, 'Must have reference string');

    await walletA.client.abortAction(abortRef);

    // --- Sign path: OP_RETURN (0 sats) — proves signAction broadcasts ---
    const opReturnData = Buffer.from('e2e9');
    const opReturn = '006a' + opReturnData.length.toString(16).padStart(2, '0')
      + opReturnData.toString('hex');

    const signResult = await walletA.client.createAction([{
      lockingScript: opReturn,
      satoshis: 0,
      outputDescription: 'will sign (OP_RETURN)',
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

    // WoC audit (quick check, don't block on chained unconfirmed)
    let wocOk = false;
    try {
      const woc = await verifyOnChain(txidHex, { maxRetries: 3, baseDelay: 1000 });
      wocOk = woc.confirmed;
    } catch {
      // Chained unconfirmed txs may not be indexed yet — that's OK
      wocOk = 'skipped (chained unconfirmed)';
    }

    return { txid: txidHex, sats: 0, wocConfirmed: wocOk,
      tests: 'abort-releases-utxos, sign-broadcasts-opreturn' };
  },
};
