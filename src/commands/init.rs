use anyhow::Result;
use bsv_sdk::primitives::PrivateKey;
use bsv_sdk::wallet::{Counterparty, KeyDeriver, Protocol, SecurityLevel};
use bsv_wallet_toolbox::{StorageSqlx, WalletStorageWriter};

const BRC29_PROTOCOL: &str = "3241645161d8";
const DEFAULT_DERIVATION_PREFIX: &str = "SfKxPIJNgdI=";
const DEFAULT_DERIVATION_SUFFIX: &str = "NaGLC6fMH50=";

pub async fn run(db_path: &str, key: Option<&str>) -> Result<()> {
    // Generate or import root key
    let private_key = if let Some(hex) = key {
        PrivateKey::from_hex(hex)?
    } else {
        PrivateKey::random()
    };

    let public_key = private_key.public_key();
    let identity_key = public_key.to_hex();

    // Derive the BRC-29 receiving address (not the identity key address)
    let deriver = KeyDeriver::new(Some(private_key.clone()));
    let (_, anyone_pubkey) = KeyDeriver::anyone_key();
    let protocol = Protocol::new(SecurityLevel::Counterparty, BRC29_PROTOCOL);
    let key_id = format!(
        "{} {}",
        DEFAULT_DERIVATION_PREFIX, DEFAULT_DERIVATION_SUFFIX
    );
    let derived_pubkey = deriver.derive_public_key(
        &protocol,
        &key_id,
        &Counterparty::Other(anyone_pubkey),
        true,
    )?;
    let address = derived_pubkey.to_address();

    // Create and migrate storage
    let storage = StorageSqlx::open(db_path).await?;
    storage.migrate("bsv-wallet-cli", &identity_key).await?;
    storage.make_available().await?;

    // Write .env file
    let env_content = format!("ROOT_KEY={}\n", private_key.to_hex());
    std::fs::write(".env", &env_content)?;

    println!("Wallet initialized!");
    println!("Identity key: {}", identity_key);
    println!("Address: {}", address);
    println!("Database: {}", db_path);
    println!("Root key saved to .env");

    Ok(())
}
