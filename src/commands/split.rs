use anyhow::Result;
use bsv_sdk::primitives::to_hex;
use bsv_sdk::script::templates::P2PKH;
use bsv_sdk::wallet::{
    Counterparty, CreateActionArgs, CreateActionOptions, CreateActionOutput, KeyDeriver,
    ListOutputsArgs, Protocol, SecurityLevel, WalletInterface,
};

use crate::context::WalletContext;

const DEFAULT_DERIVATION_PREFIX: &str = "SfKxPIJNgdI=";
const DEFAULT_DERIVATION_SUFFIX: &str = "NaGLC6fMH50=";
const BRC29_PROTOCOL: &str = "3241645161d8";

pub async fn run(ctx: &WalletContext, count: u32) -> Result<()> {
    if count < 2 {
        anyhow::bail!("Split count must be at least 2");
    }

    // Get current outputs to find total balance
    let list = ctx
        .wallet
        .list_outputs(
            ListOutputsArgs {
                basket: "default".to_string(),
                tags: None,
                tag_query_mode: None,
                include: None,
                include_custom_instructions: None,
                include_tags: None,
                include_labels: None,
                limit: None,
                offset: None,
                seek_permission: None,
            },
            "bsv-wallet-cli",
        )
        .await?;

    let total_sats: u64 = list.outputs.iter().map(|o| o.satoshis).sum();
    let utxo_count = list.outputs.len();

    if utxo_count == 0 || total_sats == 0 {
        anyhow::bail!(
            "No UTXOs to split (balance: {} sats, {} UTXOs)",
            total_sats,
            utxo_count
        );
    }

    // Derive the wallet's own address locking script (same logic as address.rs)
    let wallet_deriver = KeyDeriver::new(Some(ctx.root_key.clone()));
    let (_, anyone_pubkey) = KeyDeriver::anyone_key();
    let protocol = Protocol::new(SecurityLevel::Counterparty, BRC29_PROTOCOL);
    let key_id = format!(
        "{} {}",
        DEFAULT_DERIVATION_PREFIX, DEFAULT_DERIVATION_SUFFIX
    );
    let derived_pubkey = wallet_deriver.derive_public_key(
        &protocol,
        &key_id,
        &Counterparty::Other(anyone_pubkey),
        true,
    )?;
    let address = derived_pubkey.to_address();
    let lock = P2PKH::lock_from_address(&address)?;
    let lock_bytes = lock.to_binary();

    // Reserve ~200 sats for fees, split the rest evenly
    let fee_reserve: u64 = 200;
    if total_sats <= fee_reserve {
        anyhow::bail!(
            "Balance too low to split ({} sats, need > {} for fees)",
            total_sats,
            fee_reserve
        );
    }
    let available = total_sats - fee_reserve;
    let per_output = available / count as u64;
    if per_output < 1 {
        anyhow::bail!(
            "Cannot create {} outputs from {} available sats",
            count,
            available
        );
    }

    // Build outputs
    let outputs: Vec<CreateActionOutput> = (0..count)
        .map(|_| CreateActionOutput {
            locking_script: lock_bytes.clone(),
            satoshis: per_output,
            output_description: "split output".to_string(),
            basket: Some("default".to_string()),
            custom_instructions: None,
            tags: None,
        })
        .collect();

    let args = CreateActionArgs {
        description: format!("Split into {} UTXOs ({} sats each)", count, per_output),
        input_beef: None,
        inputs: Some(vec![]),
        outputs: Some(outputs),
        lock_time: None,
        version: None,
        labels: Some(vec!["split".to_string()]),
        options: Some(CreateActionOptions {
            randomize_outputs: Some(false),
            sign_and_process: Some(true),
            no_send: Some(false),
            ..Default::default()
        }),
    };

    let result = ctx.wallet.create_action(args, "bsv-wallet-cli").await?;

    let txid = result.txid.expect("Expected txid from split transaction");
    let txid_hex = to_hex(&txid);

    if ctx.json_output {
        println!(
            "{}",
            serde_json::json!({
                "txid": txid_hex,
                "outputs": count,
                "satoshisPerOutput": per_output
            })
        );
    } else {
        println!("Split into {} UTXOs ({} sats each)", count, per_output);
        println!("TxID: {}", txid_hex);
        println!("View: https://whatsonchain.com/tx/{}", txid_hex);
    }

    Ok(())
}
