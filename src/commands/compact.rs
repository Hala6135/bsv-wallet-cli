use anyhow::Result;

use crate::context::WalletContext;

pub async fn run(ctx: &WalletContext) -> Result<()> {
    println!("Analyzing and compacting stored BEEF blobs...\n");

    // Debug: manually replicate compact logic with tracing
    debug_compact(ctx).await?;

    Ok(())
}

async fn debug_compact(ctx: &WalletContext) -> Result<()> {
    use bsv_sdk::transaction::{Beef, MerklePath};

    let pool = ctx.wallet.storage().pool();

    // Grab the largest BEEF
    let rows: Vec<(i64, Vec<u8>)> = sqlx::query_as(
        r#"
        SELECT proven_tx_req_id, input_beef
        FROM proven_tx_reqs
        WHERE status = 'completed'
          AND input_beef IS NOT NULL
          AND LENGTH(input_beef) > 50000
        ORDER BY LENGTH(input_beef) DESC
        LIMIT 1
        "#,
    )
    .fetch_all(pool)
    .await?;

    let (req_id, beef_bytes) = &rows[0];
    let original_size = beef_bytes.len();
    let mut beef = Beef::from_binary(beef_bytes)?;

    println!(
        "BEEF req_id={}: {}KB, {} txs, {} bumps",
        req_id,
        original_size / 1024,
        beef.txs.len(),
        beef.bumps.len()
    );

    let unproven_txids: Vec<String> = beef
        .txs
        .iter()
        .filter(|tx| tx.bump_index().is_none() && !tx.is_txid_only())
        .map(|tx| tx.txid())
        .collect();

    println!("Unproven txids: {}", unproven_txids.len());

    if unproven_txids.is_empty() {
        println!("Nothing to do.");
        return Ok(());
    }

    // Query first 5 unproven txids from proven_txs to inspect
    let sample: Vec<&String> = unproven_txids.iter().take(5).collect();
    let mut upgraded = 0u32;
    let mut parse_errors = 0u32;
    let mut find_failures = 0u32;

    for txid in &sample {
        let row: Option<(Vec<u8>,)> =
            sqlx::query_as("SELECT merkle_path FROM proven_txs WHERE txid = ?")
                .bind(*txid)
                .fetch_optional(pool)
                .await?;

        match row {
            None => {
                println!("  txid {}: NOT in proven_txs", &txid[..16]);
            }
            Some((mp_bytes,)) => {
                println!(
                    "  txid {}: merkle_path {} bytes",
                    &txid[..16],
                    mp_bytes.len()
                );
                match MerklePath::from_binary(&mp_bytes) {
                    Ok(merkle_path) => {
                        let bump_index = beef.merge_bump(merkle_path);
                        match beef.find_txid_mut(txid) {
                            Some(tx) => {
                                tx.set_bump_index(Some(bump_index));
                                upgraded += 1;
                                println!("    -> upgraded! bump_index={}", bump_index);
                            }
                            None => {
                                find_failures += 1;
                                println!("    -> find_txid_mut FAILED");
                            }
                        }
                    }
                    Err(e) => {
                        parse_errors += 1;
                        println!("    -> MerklePath::from_binary FAILED: {}", e);
                        println!(
                            "    -> first 20 bytes: {}",
                            hex::encode(&mp_bytes[..mp_bytes.len().min(20)])
                        );
                    }
                }
            }
        }
    }

    println!(
        "\nSample results: {} upgraded, {} parse errors, {} find failures",
        upgraded, parse_errors, find_failures
    );

    if upgraded > 0 {
        // Now do the full upgrade
        println!(
            "\nRunning full upgrade on all {} unproven txids...",
            unproven_txids.len()
        );
        let mut full_upgraded = 0u32;
        let mut full_errors = 0u32;

        for chunk in unproven_txids.chunks(400) {
            let placeholders: String = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let query_str = format!(
                "SELECT txid, merkle_path FROM proven_txs WHERE txid IN ({})",
                placeholders
            );
            let mut query = sqlx::query(&query_str);
            for txid in chunk {
                query = query.bind(txid);
            }
            let proof_rows = query.fetch_all(pool).await?;

            for row in &proof_rows {
                let txid: String = sqlx::Row::get(row, "txid");
                let mp_bytes: Vec<u8> = sqlx::Row::get(row, "merkle_path");
                match MerklePath::from_binary(&mp_bytes) {
                    Ok(merkle_path) => {
                        let bump_index = beef.merge_bump(merkle_path);
                        if let Some(tx) = beef.find_txid_mut(&txid) {
                            tx.set_bump_index(Some(bump_index));
                            full_upgraded += 1;
                        }
                    }
                    Err(_) => {
                        full_errors += 1;
                    }
                }
            }
        }

        println!("Upgraded {} txs ({} errors)", full_upgraded, full_errors);

        // Trim
        beef.trim_known_proven();
        let new_bytes = beef.to_binary();
        let new_size = new_bytes.len();

        println!(
            "Before: {}KB -> After: {}KB (saved {}KB, {:.0}%)",
            original_size / 1024,
            new_size / 1024,
            (original_size - new_size) / 1024,
            ((original_size - new_size) as f64 / original_size as f64) * 100.0
        );

        if new_size < original_size {
            // Write it back
            let now = chrono::Utc::now();
            sqlx::query(
                "UPDATE proven_tx_reqs SET input_beef = ?, updated_at = ? WHERE proven_tx_req_id = ?"
            )
            .bind(&new_bytes)
            .bind(now)
            .bind(req_id)
            .execute(pool)
            .await?;
            println!("Written back to DB!");
        }
    }

    Ok(())
}
