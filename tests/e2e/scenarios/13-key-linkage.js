/**
 * E2E.13: Key linkage reveal between wallets (BRC-69 / BRC-70).
 * Tests revealCounterpartyKeyLinkage and revealSpecificKeyLinkage
 * with real wallet identity keys.
 * Cost: 0 sats (crypto only)
 */

module.exports = {
  name: 'key-linkage',
  description: 'Key linkage reveal between wallets (BRC-69/BRC-70)',

  async run(walletA, walletB, assert) {
    const aKey = await walletA.client.identityKey();
    const bKey = await walletB.client.identityKey();

    // --- BRC-69: revealCounterpartyKeyLinkage ---
    // A reveals its key linkage with B to B (B is both counterparty and verifier)
    const linkageResp = await walletA.client.post('revealCounterpartyKeyLinkage', {
      counterparty: bKey,
      verifier: bKey,
    });

    assert(linkageResp.linkage !== undefined, 'counterparty linkage should include linkage object');
    assert(linkageResp.linkage.prover, 'linkage should include prover');
    assert(linkageResp.linkage.verifier, 'linkage should include verifier');
    assert(linkageResp.linkage.counterparty, 'linkage should include counterparty');
    assert(linkageResp.linkage.encryptedLinkage, 'linkage should include encryptedLinkage');
    assert(linkageResp.linkage.encryptedLinkageProof, 'linkage should include encryptedLinkageProof');
    assert(linkageResp.revelationTime, 'response should include revelationTime');

    // --- BRC-70: revealSpecificKeyLinkage ---
    const specificResp = await walletA.client.post('revealSpecificKeyLinkage', {
      counterparty: bKey,
      verifier: bKey,
      protocolID: [2, 'e2e linkage test'],
      keyID: '1',
    });

    assert(specificResp.linkage !== undefined, 'specific linkage should include linkage object');
    assert(specificResp.linkage.prover, 'specific linkage should include prover');
    assert(specificResp.linkage.verifier, 'specific linkage should include verifier');
    assert(specificResp.linkage.counterparty, 'specific linkage should include counterparty');
    assert(specificResp.linkage.encryptedLinkage, 'specific linkage should include encryptedLinkage');
    assert(specificResp.protocol, 'specific linkage should include protocol');

    // --- Invalid input: bad counterparty key should return a clear error ---
    try {
      await walletA.client.post('revealCounterpartyKeyLinkage', {
        counterparty: 'not-a-valid-pubkey',
        verifier: bKey,
      });
      assert(false, 'bad counterparty should have thrown');
    } catch (e) {
      assert(
        e.message.includes('400') || e.message.includes('error'),
        `bad counterparty should return error, got: ${e.message}`,
      );
    }

    return { txid: null, wocConfirmed: 'n/a', sats: 0 };
  },
};
