/**
 * E2E.14: BEEF round-trip broadcast.
 *
 * Tests that a transaction created via createAction produces valid BEEF
 * that ARC miners accept. This specifically catches the BEEF serialization
 * round-trip bug where raw tx bytes were lost during parsing, causing
 * truncated BEEF output rejected by miners.
 *
 * Steps:
 *   1. A sends sats to B via HTTP createAction (not CLI) — forces BEEF construction
 *   2. Verify the txid is returned (no broadcast failure)
 *   3. B receives via listOutputs (confirms the UTXO exists)
 *   4. B sends back to A (proves the received UTXO's BEEF ancestry is valid)
 *   5. Verify both txids on WoC
 */
const { verifyOnChain } = require('../lib/woc');

module.exports = {
  name: 'beef-roundtrip-broadcast',
  description: 'createAction produces valid BEEF that miners accept (round-trip)',

  async run(walletA, walletB, assert) {
    // Get B's identity key for payment derivation
    const bIdentity = await walletB.identityKey();
    assert(bIdentity && bIdentity.length === 66, `B identity key should be 66 hex chars, got ${bIdentity?.length}`);

    // Step 1: A creates a payment to B via HTTP createAction
    // This exercises the full BEEF construction path:
    //   pick input UTXOs → sign → build BEEF with ancestors → broadcast via ARC
    const bPubkey = await walletB.getPublicKey(
      [2, '3241645161d8'],       // BRC-29 payment protocol
      'e2e-beef-test payment-1', // unique key_id
      bIdentity,                 // counterparty = A's identity (from B's perspective, A is the sender)
      false,                     // forSelf = false (derive B's receiving key)
    );

    // Build P2PKH locking script from B's derived pubkey
    const bPubkeyHex = bPubkey.publicKey;
    assert(bPubkeyHex.length === 66, `derived pubkey should be 66 hex chars, got ${bPubkeyHex.length}`);

    // Simple P2PKH: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
    const crypto = require('crypto');
    const pubkeyBuf = Buffer.from(bPubkeyHex, 'hex');
    const sha256 = crypto.createHash('sha256').update(pubkeyBuf).digest();
    const hash160 = crypto.createHash('ripemd160').update(sha256).digest();
    const lockingScript = '76a914' + hash160.toString('hex') + '88ac';

    const sendAmount = 5000; // 5000 sats — enough to be meaningful
    const result = await walletA.post('createAction', {
      description: 'E2E BEEF round-trip test: A→B',
      outputs: [{
        lockingScript,
        satoshis: sendAmount,
        outputDescription: 'payment to B',
      }],
    });

    assert(result.txid, `createAction should return txid, got: ${JSON.stringify(result).slice(0, 200)}`);
    assert(result.txid.length === 64, `txid should be 64 hex chars, got ${result.txid.length}`);
    console.log(`    A→B txid: ${result.txid}`);

    // Step 2: B internalizes the payment
    // Get the tx bytes and have B internalize
    const txBytes = result.tx; // array of u8
    assert(txBytes && txBytes.length > 0, 'createAction should return tx bytes');

    await walletB.post('internalizeAction', {
      tx: txBytes,
      outputs: [{
        outputIndex: 0, // first output is our payment
        protocol: 'wallet payment',
        paymentRemittance: {
          derivationPrefix: 'e2e-beef-test',
          derivationSuffix: 'payment-1',
          senderIdentityKey: await walletA.identityKey(),
        },
      }],
      description: 'E2E BEEF round-trip: internalize from A',
    });

    // Step 3: B sends back to A — this proves B can spend the UTXO
    // (the UTXO's BEEF ancestry must be valid for B's createAction to broadcast)
    const aPubkey = await walletA.getPublicKey(
      [2, '3241645161d8'],
      'e2e-beef-test return-1',
      await walletA.identityKey(), // self
      true,
    );
    const aPubkeyBuf = Buffer.from(aPubkey.publicKey, 'hex');
    const aSha256 = crypto.createHash('sha256').update(aPubkeyBuf).digest();
    const aHash160 = crypto.createHash('ripemd160').update(aSha256).digest();
    const aLockingScript = '76a914' + aHash160.toString('hex') + '88ac';

    const returnResult = await walletB.post('createAction', {
      description: 'E2E BEEF round-trip test: B→A (return)',
      outputs: [{
        lockingScript: aLockingScript,
        satoshis: 2000,
        outputDescription: 'return payment to A',
      }],
    });

    assert(returnResult.txid, `B→A createAction should return txid, got: ${JSON.stringify(returnResult).slice(0, 200)}`);
    assert(returnResult.txid.length === 64, `B→A txid should be 64 hex chars`);
    console.log(`    B→A txid: ${returnResult.txid}`);

    // Step 4: Verify both on WoC
    const woc1 = await verifyOnChain(result.txid, { maxRetries: 8, baseDelay: 1500 });
    assert(woc1.confirmed, `A→B tx ${result.txid} must appear on WoC`);

    const woc2 = await verifyOnChain(returnResult.txid, { maxRetries: 8, baseDelay: 1500 });
    assert(woc2.confirmed, `B→A tx ${returnResult.txid} must appear on WoC`);

    return {
      txA2B: result.txid,
      txB2A: returnResult.txid,
      wocConfirmed: true,
    };
  },
};
