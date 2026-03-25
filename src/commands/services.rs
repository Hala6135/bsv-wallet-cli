use anyhow::Result;
use bsv_wallet_toolbox::{Chain, Services, ServicesOptions, WalletServices};

use crate::cli::Cli;

pub async fn run(cli: &Cli) -> Result<()> {
    let chain = if cli.testnet {
        Chain::Test
    } else {
        Chain::Main
    };

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

    let chain_name = match chain {
        Chain::Main => "mainnet",
        Chain::Test => "testnet",
    };

    match services.get_height().await {
        Ok(height) => {
            if cli.json {
                println!(
                    "{}",
                    serde_json::json!({
                        "chain": chain_name,
                        "height": height,
                    })
                );
            } else {
                println!("Chain: {}", chain_name);
                println!("Block height: {}", height);
            }
        }
        Err(e) => {
            if cli.json {
                println!(
                    "{}",
                    serde_json::json!({
                        "chain": chain_name,
                        "error": e.to_string(),
                    })
                );
            } else {
                println!("Chain: {}", chain_name);
                println!("Error fetching height: {}", e);
            }
        }
    }

    Ok(())
}
