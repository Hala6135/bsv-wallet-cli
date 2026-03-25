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
const FUNDER_DIR = path.resolve(__dirname, '../../../'); // where funder's .env lives

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
  const balance = parseInt(
    execSync(`cd "${wallet.dir}" && "${BSV}" balance`, { encoding: 'utf-8' }).trim(),
  );

  if (balance < 600) {
    console.log(`  ${wallet.client.name}: ${balance} sats (dust, skipping sweep)`);
    return 0;
  }

  const funderAddr = execSync(
    `cd "${FUNDER_DIR}" && "${BSV}" address`, { encoding: 'utf-8' },
  ).trim();

  // Try full sweep first, then halve on failure to recover what we can
  let sweepAmount = balance - 300; // leave room for fee
  let swept = 0;

  for (let attempt = 0; attempt < 4 && sweepAmount >= 600; attempt++) {
    try {
      const rawResult = execSync(
        `cd "${wallet.dir}" && "${BSV}" --json send "${funderAddr}" ${sweepAmount}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim();

      const parsed = JSON.parse(extractJson(rawResult));

      // Funder internalizes directly
      execSync(
        `cd "${FUNDER_DIR}" && "${BSV}" fund "${parsed.beef}" --vout 0`,
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );

      console.log(`  ${wallet.client.name}: swept ${sweepAmount} sats back to funder`);
      swept += sweepAmount;
      break;
    } catch (e) {
      if (attempt < 3) {
        // Halve the amount and retry — some UTXOs may be unspendable
        const prev = sweepAmount;
        sweepAmount = Math.floor(sweepAmount / 2);
        console.log(`  ${wallet.client.name}: sweep ${prev} failed, retrying with ${sweepAmount}`);
      } else {
        console.log(`  WARNING: ${wallet.client.name}: could not sweep (${sweepAmount} sats stuck)`);
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
