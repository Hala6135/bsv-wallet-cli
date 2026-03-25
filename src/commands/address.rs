use anyhow::Result;
use bsv_sdk::wallet::{Counterparty, KeyDeriver, Protocol, SecurityLevel};
use bsv_wallet_toolbox::Chain;

use crate::context::WalletContext;

const DEFAULT_DERIVATION_PREFIX: &str = "SfKxPIJNgdI=";
const DEFAULT_DERIVATION_SUFFIX: &str = "NaGLC6fMH50=";
const BRC29_PROTOCOL: &str = "3241645161d8";

pub async fn run(ctx: &WalletContext) -> Result<()> {
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

    let address = match ctx.chain {
        Chain::Test => derived_pubkey.to_address_with_prefix(0x6f),
        Chain::Main => derived_pubkey.to_address(),
    };

    if ctx.json_output {
        println!("{}", serde_json::json!({ "address": address }));
    } else {
        println!("{}", address);
    }

    Ok(())
}
