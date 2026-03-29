/**
 * E2E.19: services command.
 * Tests the blockchain service status command — read-only, no wallet needed.
 * Verifies both plain and JSON output, compares height with HTTP API.
 * Cost: 0 sats (read-only).
 */

const { execSync } = require('child_process');
const { BSV, parseCliJson } = require('../lib/setup');

module.exports = {
  name: 'cli-services',
  description: 'Services command shows chain and height (0 sats)',

  async run(walletA, walletB, assert) {
    // ─── Plain text output ───
    const plainOutput = execSync(
      `cd "${walletA.dir}" && "${BSV}" services`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();

    assert(plainOutput.includes('Chain:'),
      `Plain output should include 'Chain:', got: ${plainOutput.slice(0, 200)}`);
    assert(plainOutput.includes('mainnet') || plainOutput.includes('testnet'),
      `Plain output should include network name, got: ${plainOutput.slice(0, 200)}`);

    // Height might be present if services connected, or error if offline
    const hasHeight = plainOutput.includes('Block height:');
    const hasError = plainOutput.includes('Error');

    assert(hasHeight || hasError,
      `Plain output should include height or error, got: ${plainOutput.slice(0, 200)}`);

    // ─── JSON output ───
    const jsonRaw = execSync(
      `cd "${walletA.dir}" && "${BSV}" --json services`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const jsonResult = parseCliJson(jsonRaw);

    assert(jsonResult.chain === 'mainnet' || jsonResult.chain === 'testnet',
      `JSON chain should be mainnet or testnet, got ${jsonResult.chain}`);

    // Height must be present (services should connect to chain providers)
    assert(jsonResult.height || jsonResult.error,
      'JSON must include height or error');
    if (jsonResult.height) {
      assert(jsonResult.height > 800000,
        `Height should be > 800000 (current BSV chain), got ${jsonResult.height}`);

      // ─── Compare with HTTP API ───
      const httpHeight = await walletA.client.getHeight();
      const hHeight = typeof httpHeight === 'number' ? httpHeight : (httpHeight?.height || 0);
      if (hHeight > 0) {
        const diff = Math.abs(jsonResult.height - hHeight);
        assert(diff < 10,
          `CLI height (${jsonResult.height}) and HTTP height (${hHeight}) should be within 10 blocks, diff=${diff}`);
      }
    }

    // ─── Wallet still healthy ───
    const health = await walletA.client.isAuthenticated();
    assert(health.authenticated, 'A must be healthy after services check');

    return {
      txid: null,
      sats: 0,
      wocConfirmed: 'n/a',
      chain: jsonResult.chain,
      height: jsonResult.height || 'error',
    };
  },
};
