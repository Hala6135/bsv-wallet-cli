use anyhow::Result;
use bsv_sdk::primitives::PrivateKey;
use bsv_wallet_toolbox::{StorageSqlx, WalletStorageWriter};

pub async fn run(db_path: &str, key: Option<&str>) -> Result<()> {
    // Generate or import root key
    let private_key = if let Some(hex) = key {
        PrivateKey::from_hex(hex)?
    } else {
        PrivateKey::random()
    };

    let public_key = private_key.public_key();
    let identity_key = public_key.to_hex();
    let address = public_key.to_address();

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
