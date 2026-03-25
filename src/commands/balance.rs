use anyhow::Result;
use bsv_wallet_toolbox::{ListOutputsArgs, WalletInterface};

use crate::context::WalletContext;

pub async fn run(ctx: &WalletContext) -> Result<()> {
    let mut balance: u64 = 0;
    let mut offset: i32 = 0;

    loop {
        let args = ListOutputsArgs {
            basket: "default".to_string(),
            tags: None,
            tag_query_mode: None,
            include: None,
            include_custom_instructions: None,
            include_tags: None,
            include_labels: None,
            limit: Some(100),
            offset: Some(offset),
            seek_permission: None,
        };

        let result = ctx.wallet.list_outputs(args, "bsv-wallet-cli").await?;

        for output in &result.outputs {
            balance += output.satoshis;
        }

        offset += result.outputs.len() as i32;
        if result.outputs.is_empty() || offset >= result.total_outputs as i32 {
            break;
        }
    }

    if ctx.json_output {
        println!("{}", serde_json::json!({ "satoshis": balance }));
    } else {
        println!("{} satoshis", balance);
    }

    Ok(())
}
