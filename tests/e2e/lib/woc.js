/**
 * WhatsOnChain verification helpers.
 * WoC is the auditor, not the courier.
 */

const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main';

/**
 * Verify a transaction exists on-chain via WoC.
 * Polls with exponential backoff.
 * Returns { confirmed, txid, vout: [...] } or throws.
 */
async function verifyOnChain(txid, opts = {}) {
  const maxRetries = opts.maxRetries || 15;
  const baseDelay = opts.baseDelay || 2000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const resp = await fetch(`${WOC_BASE}/tx/${txid}`);
      if (resp.ok) {
        const tx = await resp.json();
        return {
          confirmed: true,
          txid: tx.txid,
          vout: tx.vout.map(v => ({
            sats: Math.round(v.value * 1e8),
            script: v.scriptPubKey.hex,
          })),
        };
      }
      if (resp.status === 404) {
        // Not yet indexed, retry
      } else {
        throw new Error(`WoC /tx/${txid} returned ${resp.status}`);
      }
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
    await sleep(baseDelay * Math.pow(1.5, i));
  }
  throw new Error(`Transaction ${txid} not found on WoC after ${maxRetries} retries`);
}

/**
 * Fetch BEEF from WoC for a given txid.
 * Returns raw BEEF bytes as a Buffer.
 */
async function fetchBeef(txid) {
  const resp = await fetch(`${WOC_BASE}/tx/${txid}/beef`);
  if (!resp.ok) throw new Error(`WoC /tx/${txid}/beef returned ${resp.status}`);
  const raw = await resp.text();
  // WoC returns BEEF as hex string (possibly quoted)
  const clean = raw.trim().replace(/^"|"$/g, '');
  return Buffer.from(clean, 'hex');
}

/**
 * Build AtomicBEEF from raw BEEF bytes + txid.
 * Format: [0x01,0x01,0x01,0x01] + reversed_txid(32 bytes) + beef_bytes
 */
function buildAtomicBEEF(txid, beefBytes) {
  const prefix = Buffer.from([0x01, 0x01, 0x01, 0x01]);
  const txidBytes = Buffer.from(txid, 'hex');
  const reversed = Buffer.from(txidBytes.reverse());
  return Buffer.concat([prefix, reversed, beefBytes]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { verifyOnChain, fetchBeef, buildAtomicBEEF, sleep, WOC_BASE };
