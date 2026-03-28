#!/usr/bin/env node
/**
 * bsv-wallet-cli E2E Test Runner
 *
 * Spawns two fresh wallets on :3323 and :3324, funds them from the funder on :3322,
 * runs scenarios, verifies on WoC, then sweeps everything back to the funder.
 *
 * Usage:
 *   node run.js                    # Run all scenarios
 *   node run.js --scenario 1       # Run single scenario
 *   node run.js --dry-run          # Setup only, no scenarios
 *   node run.js --skip-woc         # Skip WoC verification (faster)
 */

const { startWallet, fundWallet, sweepToFunder, teardownWallet } = require('./lib/setup');
const { WalletClient } = require('./lib/wallet-client');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BSV = path.resolve(__dirname, '../../target/release/bsv-wallet');
const FUNDER_DIR = process.env.FUNDER_DIR || path.resolve(__dirname, '../../');

// Parse CLI args
const args = process.argv.slice(2);
const scenarioFilter = args.includes('--scenario') ? parseInt(args[args.indexOf('--scenario') + 1]) : null;
const dryRun = args.includes('--dry-run');
const skipWoc = args.includes('--skip-woc');

// Load scenarios
const scenarioFiles = fs.readdirSync(path.join(__dirname, 'scenarios'))
  .filter(f => f.endsWith('.js'))
  .sort();

const scenarios = scenarioFiles.map(f => require(`./scenarios/${f}`));

async function main() {
  let walletA, walletB;
  const results = [];
  let funderBalanceBefore;

  try {
    // Check funder is running
    const funder = new WalletClient(3322, 'funder');
    try { await funder.isAuthenticated(); } catch {
      console.error('ERROR: Funder wallet not running on :3322');
      process.exit(1);
    }

    funderBalanceBefore = parseInt(
      execSync(`cd "${FUNDER_DIR}" && "${BSV}" balance`, { encoding: 'utf-8' }).trim(),
    );

    console.log('');
    console.log('================================================================');
    console.log('  bsv-wallet-cli E2E Test Suite');
    console.log('================================================================');
    console.log(`  Funder: :3322  Balance: ${funderBalanceBefore.toLocaleString()} sats`);

    // Start test wallets
    console.log('  Starting test wallets...');
    walletA = await startWallet(3323, 'wallet-A');
    walletB = await startWallet(3324, 'wallet-B');
    console.log(`  Wallet A: :3323 (${walletA.identityKey.slice(0, 12)}...)  ${walletA.address}`);
    console.log(`  Wallet B: :3324 (${walletB.identityKey.slice(0, 12)}...)  ${walletB.address}`);

    // Fund wallet A
    const fundAmount = 300_000;
    console.log(`  Funding A with ${fundAmount.toLocaleString()} sats from funder...`);
    const funded = await fundWallet(walletA, fundAmount);
    console.log(`  Funded: txid=${funded.txid.slice(0, 16)}...`);

    const aBalance = parseInt(
      execSync(`cd "${walletA.dir}" && "${BSV}" balance`, { encoding: 'utf-8' }).trim(),
    );
    console.log(`  A balance: ${aBalance.toLocaleString()} sats`);
    console.log('================================================================');

    if (dryRun) {
      console.log('  --dry-run: skipping scenarios');
      console.log('================================================================');
      return;
    }

    // Run scenarios
    const toRun = scenarioFilter !== null
      ? scenarios.filter((_, i) => i + 1 === scenarioFilter)
      : scenarios;

    for (let i = 0; i < toRun.length; i++) {
      const scenario = toRun[i];
      const num = scenarioFilter || (i + 1);
      const assertions = [];
      let failed = false;

      function assert(condition, message) {
        if (!condition) {
          failed = true;
          assertions.push(`FAIL: ${message}`);
          throw new Error(message);
        }
        assertions.push(`OK: ${message}`);
      }

      console.log(`  [${num}] ${scenario.name}: ${scenario.description}`);
      const start = Date.now();

      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT: scenario exceeded 120s')), 120_000));
        const result = await Promise.race([scenario.run(walletA, walletB, assert), timeout]);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`       PASS (${elapsed}s) txid=${result.txid?.slice(0, 12) || 'n/a'}... woc=${result.wocConfirmed || 'n/a'}`);
        results.push({ num, name: scenario.name, status: 'PASS', elapsed, ...result });
      } catch (e) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`       FAIL (${elapsed}s): ${e.message}`);
        results.push({ num, name: scenario.name, status: 'FAIL', elapsed, error: e.message });
      }
    }

  } finally {
    // Sweep and teardown
    console.log('================================================================');
    console.log('  Sweeping remaining funds back to funder...');

    let sweptTotal = 0;
    if (walletB) {
      try { sweptTotal += await sweepToFunder(walletB); } catch (e) {
        console.log(`  WARNING: B sweep failed: ${e.message}`);
      }
    }
    if (walletA) {
      try { sweptTotal += await sweepToFunder(walletA); } catch (e) {
        console.log(`  WARNING: A sweep failed: ${e.message}`);
      }
    }

    // Teardown
    if (walletB) teardownWallet(walletB);
    if (walletA) teardownWallet(walletA);

    // Final accounting
    const funderBalanceAfter = parseInt(
      execSync(`cd "${FUNDER_DIR}" && "${BSV}" balance`, { encoding: 'utf-8' }).trim(),
    );

    const passed = results.filter(r => r.status === 'PASS').length;
    const total = results.length;
    const netCost = funderBalanceBefore - funderBalanceAfter;

    console.log('');
    console.log('================================================================');
    console.log('  RESULTS');
    console.log('================================================================');

    for (const r of results) {
      const icon = r.status === 'PASS' ? 'OK' : '!!';
      console.log(`  [${icon}] ${r.num}. ${r.name}: ${r.status} (${r.elapsed}s)`);
    }

    console.log('----------------------------------------------------------------');
    console.log(`  Passed:       ${passed}/${total}`);
    console.log(`  Funder before: ${funderBalanceBefore.toLocaleString()} sats`);
    console.log(`  Funder after:  ${funderBalanceAfter.toLocaleString()} sats`);
    console.log(`  Net cost:      ${netCost.toLocaleString()} sats`);
    console.log(`  A/B balance:   0 (swept)`);
    console.log('================================================================');

    // Check wallets are empty
    if (walletA) {
      try {
        const aRemaining = parseInt(
          execSync(`cd "${walletA.dir}" && "${BSV}" balance`, { encoding: 'utf-8' }).trim(),
        );
        if (aRemaining > 0) console.log(`  WARNING: A still has ${aRemaining} sats (dust)`);
      } catch { /* already torn down */ }
    }

    process.exit(passed === total ? 0 : 1);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
