/**
 * Multi-wallet setup and teardown.
 * Spawns fresh wallets on test ports, funds them from the funder on :3322.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { WalletClient, ANYONE_KEY, buildP2PKH } = require('./wallet-client');
const { fetchBeef, buildAtomicBEEF, sleep } = require('./woc');

const BSV = path.resolve(__dirname, '../../../target/release/bsv-wallet');
const FUNDER_PORT = 3322;
const FUNDER_DIR = process.env.FUNDER_DIR || path.resolve(__dirname, '../../../');

/**
 * Initialize and start a wallet on a given port.
 * Returns { dir, proc, client, identityKey, address }.
 */
async function startWallet(port, name) {
  const dir = fs.mkdtempSync(`/tmp/bsv-wallet-${name}-`);

  // Init wallet (generates ROOT_KEY + wallet.db)
  execSync(`cd "${dir}" && "${BSV}" init`, { stdio: 'pipe' });

  // Start serve in background
  const proc = spawn(BSV, ['--port', String(port), 'serve'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Wait for health
  const client = new WalletClient(port, name);
  for (let i = 0; i < 20; i++) {
    try {
      await client.isAuthenticated();
      break;
    } catch {
      if (i === 19) throw new Error(`${name} on :${port} failed to start`);
      await sleep(500);
    }
  }

  const identityKey = await client.identityKey();
  const addrResult = execSync(`cd "${dir}" && "${BSV}" address`, { encoding: 'utf-8' }).trim();

  return { dir, proc, client, identityKey, address: addrResult, port };
}

/**
 * Fund a wallet from the funder on :3322 using CLI.
 * Uses --json send to get BEEF, then fund directly (no WoC).
 */
async function fundWallet(wallet, satoshis) {
  // Send from funder to wallet's address using --json for BEEF output.
  // Note: tracing logs may be mixed into stdout, so we extract only the JSON line.
  const rawResult = execSync(
    `cd "${FUNDER_DIR}" && "${BSV}" --json send "${wallet.address}" ${satoshis}`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();

  const result = extractJson(rawResult);
  const parsed = JSON.parse(result);
  if (!parsed.beef) throw new Error('Funder send did not return BEEF');

  // Wallet internalizes directly from BEEF (no WoC!)
  execSync(
    `cd "${wallet.dir}" && "${BSV}" fund "${parsed.beef}" --vout 0`,
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );

  return { txid: parsed.txid, sats: satoshis };
}

/**
 * Sweep all funds from a wallet back to the funder.
 * Returns sats swept, or 0 if balance too low.
 *
 * If the full sweep fails (e.g., some UTXOs are unspendable due to wrong derivation
 * or basket insertion), retries with progressively smaller amounts to recover as much
 * as possible. This prevents losing sats when a scenario creates unspendable outputs.
 */
async function sweepToFunder(wallet) {
  // Use HTTP API for full balance (covers all baskets)
  const balance = await wallet.client.balance();

  if (balance < 600) {
    console.log(`  ${wallet.client.name}: ${balance} sats (dust, skipping sweep)`);
    return 0;
  }

  // Get funder's receiving key via HTTP API
  const funderClient = new WalletClient(FUNDER_PORT, 'funder');
  const funderKey = await funderClient.getPublicKey(
    [2, '3241645161d8'], 'SfKxPIJNgdI= NaGLC6fMH50=', ANYONE_KEY, true,
  );
  const funderScript = buildP2PKH(funderKey.publicKey);

  let sweepAmount = balance - 300; // leave room for fee
  let swept = 0;

  for (let attempt = 0; attempt < 4 && sweepAmount >= 600; attempt++) {
    try {
      const result = await wallet.client.createAction(
        [{ lockingScript: funderScript, satoshis: sweepAmount, outputDescription: 'sweep to funder' }],
        `sweep ${sweepAmount} sats back to funder`,
      );

      // Funder internalizes the BEEF
      await funderClient.internalizeAction(result.tx, [{
        outputIndex: 0,
        protocol: 'wallet payment',
        paymentRemittance: {
          derivationPrefix: 'SfKxPIJNgdI=',
          derivationSuffix: 'NaGLC6fMH50=',
          senderIdentityKey: ANYONE_KEY,
        },
      }], `sweep from ${wallet.client.name}`);

      console.log(`  ${wallet.client.name}: swept ${sweepAmount} sats back to funder`);
      swept += sweepAmount;
      break;
    } catch (e) {
      if (attempt < 3) {
        const prev = sweepAmount;
        sweepAmount = Math.floor(sweepAmount / 2);
        console.log(`  ${wallet.client.name}: sweep ${prev} failed (${e.message.slice(0, 60)}), retrying with ${sweepAmount}`);
      } else {
        console.log(`  WARNING: ${wallet.client.name}: could not sweep (${sweepAmount} sats stuck: ${e.message.slice(0, 80)})`);
      }
    }
  }

  return swept;
}

/** Kill wallet process and remove temp dir. */
function teardownWallet(wallet) {
  if (wallet.proc && !wallet.proc.killed) {
    wallet.proc.kill('SIGTERM');
  }
  if (wallet.dir && fs.existsSync(wallet.dir)) {
    fs.rmSync(wallet.dir, { recursive: true, force: true });
  }
}

/**
 * Extract JSON from CLI output that may contain tracing log lines.
 * Finds the line starting with '{' and returns it.
 */
function extractJson(output) {
  const lines = output.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{')) return line;
  }
  throw new Error(`No JSON found in output: ${output.slice(0, 200)}`);
}

module.exports = { startWallet, fundWallet, sweepToFunder, teardownWallet, extractJson, BSV, FUNDER_PORT };
