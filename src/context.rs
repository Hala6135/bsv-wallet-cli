use anyhow::{Context, Result};
use bsv_sdk::primitives::PrivateKey;
use bsv_wallet_toolbox::{Chain, Services, ServicesOptions, StorageSqlx, Wallet, WalletStorageWriter};

use crate::cli::Cli;

pub struct WalletContext {
    pub wallet: Wallet<StorageSqlx, Services>,
    pub identity_key: String,
    pub root_key: PrivateKey,
    pub chain: Chain,
    pub json_output: bool,
}

impl WalletContext {
    pub async fn load(cli: &Cli) -> Result<Self> {
        let root_key_hex =
            std::env::var("ROOT_KEY").context("ROOT_KEY not set. Run `bsv-wallet init` first.")?;

        let root_key = PrivateKey::from_hex(&root_key_hex)?;
        let identity_key = root_key.public_key().to_hex();

        let chain = if cli.testnet {
            Chain::Test
        } else {
            Chain::Main
        };

        let storage = StorageSqlx::open(&cli.db).await?;
        storage.make_available().await?;

        let services = {
            let mut opts = match chain {
                Chain::Main => ServicesOptions::mainnet(),
                Chain::Test => ServicesOptions::testnet(),
            };
            if let Ok(url) = std::env::var("CHAINTRACKS_URL") {
                opts = opts.with_chaintracks_url(url);
            }
            Services::with_options(chain, opts)?
        };

        let wallet = Wallet::new(Some(root_key.clone()), storage, services).await?;

        Ok(Self {
            wallet,
            identity_key,
            root_key,
            chain,
            json_output: cli.json,
        })
    }
}
