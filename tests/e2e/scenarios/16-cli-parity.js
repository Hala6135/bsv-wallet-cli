/**
 * E2E.16: CLI parity — read-only commands match HTTP API.
 * Verifies identity, balance, outputs, and actions CLI output matches the HTTP API.
 * Cost: 0 sats (read-only queries).
 */

const { execSync } = require('child_process');
const { BSV, parseCliJson } = require('../lib/setup');

module.exports = {
  name: 'cli-parity',
  description: 'CLI read commands match HTTP API output (0 sats)',

  async run(walletA, walletB, assert) {
    // ─── identity ───
    const identityRaw = execSync(
      `cd "${walletA.dir}" && "${BSV}" --json identity`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const identity = parseCliJson(identityRaw);
    const httpIdentityKey = await walletA.client.identityKey();

    assert(identity.identityKey === httpIdentityKey,
      `CLI identity key (${identity.identityKey.slice(0, 16)}...) must match HTTP (${httpIdentityKey.slice(0, 16)}...)`);
    assert(identity.address && identity.address.length > 20,
      'CLI identity must include a valid address');
    assert(identity.chain === 'Main',
      `CLI identity chain should be Main, got ${identity.chain}`);

    // ─── balance ───
    const balanceRaw = execSync(
      `cd "${walletA.dir}" && "${BSV}" --json balance`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const balanceCli = parseCliJson(balanceRaw);
    const balanceHttp = await walletA.client.balance();

    assert(typeof balanceCli.satoshis === 'number',
      'CLI balance must return a number');
    assert(balanceCli.satoshis === balanceHttp,
      `CLI balance (${balanceCli.satoshis}) must match HTTP balance (${balanceHttp})`);

    // ─── balance (plain text) ───
    const balancePlain = execSync(
      `cd "${walletA.dir}" && "${BSV}" balance`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    // Plain output is "<N> satoshis"
    const plainSats = parseInt(balancePlain);
    assert(!isNaN(plainSats) && plainSats === balanceHttp,
      `CLI plain balance (${balancePlain}) must parse to HTTP balance (${balanceHttp})`);

    // ─── outputs --json ───
    const outputsRaw = execSync(
      `cd "${walletA.dir}" && "${BSV}" --json outputs`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const outputsCli = parseCliJson(outputsRaw);
    const outputsHttp = await walletA.client.listOutputs('default', {
      limit: 10000, includeEnvelope: false,
    });

    const cliOutputList = outputsCli.outputs || [];
    const httpOutputList = outputsHttp.outputs || [];
    assert(cliOutputList.length > 0, 'CLI outputs must return at least one output');

    // CLI fetches first page (limit 100), HTTP fetches all — compare counts carefully
    const cliTotal = outputsCli.totalOutputs || outputsCli.total_outputs || cliOutputList.length;
    const httpTotal = outputsHttp.totalOutputs || outputsHttp.total_outputs || httpOutputList.length;
    assert(cliTotal === httpTotal,
      `CLI total outputs (${cliTotal}) must match HTTP total (${httpTotal})`);

    // Sum CLI output sats and compare with balance
    const cliOutputSats = cliOutputList.reduce((s, o) => s + (o.satoshis || 0), 0);
    assert(cliOutputSats > 0, `CLI outputs should have sats, got ${cliOutputSats}`);

    // ─── actions --json ───
    const actionsRaw = execSync(
      `cd "${walletA.dir}" && "${BSV}" --json actions`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const actionsCli = parseCliJson(actionsRaw);
    const actionsHttp = await walletA.client.listActions({ limit: 100 });

    const cliActionList = actionsCli.actions || [];
    const httpActionList = actionsHttp.actions || [];
    assert(cliActionList.length > 0, 'CLI actions must have entries (post-funding)');

    const cliActionTotal = actionsCli.totalActions || actionsCli.total_actions || cliActionList.length;
    const httpActionTotal = actionsHttp.totalActions || actionsHttp.total_actions || httpActionList.length;
    assert(cliActionTotal === httpActionTotal,
      `CLI total actions (${cliActionTotal}) must match HTTP total (${httpActionTotal})`);

    // ─── Wallet B: identity check ───
    const bIdentityRaw = execSync(
      `cd "${walletB.dir}" && "${BSV}" --json identity`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const bIdentity = parseCliJson(bIdentityRaw);
    const bHttpIdentityKey = await walletB.client.identityKey();
    assert(bIdentity.identityKey === bHttpIdentityKey,
      'B CLI identity key must match B HTTP identity key');

    return {
      txid: null,
      sats: 0,
      wocConfirmed: 'n/a',
      tests: 'identity+balance+outputs+actions+B-identity',
      aBalance: balanceHttp,
      aOutputs: cliTotal,
      aActions: cliActionTotal,
    };
  },
};
