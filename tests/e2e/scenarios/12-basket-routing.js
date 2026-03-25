/**
 * E2E.12: Custom basket routing.
 * Tests that outputs internalized with basket insertion protocol
 * land in the correct basket and can be queried via listOutputs.
 * Cost: ~10000 sats (A sends to B, B internalizes into custom basket)
 */
const { ANYONE_KEY, buildP2PKH } = require('../lib/wallet-client');

module.exports = {
  name: 'basket-routing',
  description: 'Output basket assignment persists and is queryable via listOutputs',

  async run(walletA, walletB, assert) {
    const amount = 5_000;
    const basketName = 'e2e-test-basket';

    // Step 1: Verify basket starts empty on B
    const before = await walletB.client.listOutputs(basketName);
    assert(
      before.outputs.length === 0,
      `basket "${basketName}" should start empty on B`,
    );

    // Step 2: Get B's derived key for P2PKH
    const bKey = await walletB.client.getPublicKey(
      [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=', ANYONE_KEY, true,
    );
    const lockingScript = buildP2PKH(bKey.publicKey);

    // Step 3: A creates and broadcasts action sending to B
    const result = await walletA.client.createAction(
      [{
        lockingScript,
        satoshis: amount,
        outputDescription: 'basket routing test',
        basket: basketName,
        tags: ['e2e-basket-test'],
      }],
      'basket routing scenario',
    );
    assert(result.txid, 'createAction must return txid');
    assert(Array.isArray(result.tx), 'createAction must return tx bytes');

    // Step 4: B internalizes using "basket insertion" protocol into custom basket
    const internalized = await walletB.client.post('internalizeAction', {
      tx: result.tx,
      outputs: [{
        outputIndex: 0,
        protocol: 'basket insertion',
        insertionRemittance: {
          basket: basketName,
          tags: ['e2e-basket-test'],
        },
      }],
      description: 'basket insertion test',
    });
    assert(internalized.accepted === true, 'B must accept the tx');

    // Step 5: Query the custom basket on B — output should be there
    const after = await walletB.client.listOutputs(basketName);
    assert(
      after.outputs.length > 0,
      `basket "${basketName}" should have outputs after internalization, got ${after.outputs.length}`,
    );

    // Step 6: Verify the output has correct satoshis
    const found = after.outputs.find(o => o.satoshis === amount);
    assert(found, `should find output with ${amount} sats in basket "${basketName}"`);

    return { txid: result.txid, wocConfirmed: 'n/a', sats: amount };
  },
};
