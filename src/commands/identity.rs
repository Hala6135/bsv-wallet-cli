use crate::context::WalletContext;
use anyhow::Result;

pub async fn run(ctx: &WalletContext) -> Result<()> {
    let address = ctx.root_key.public_key().to_address();

    if ctx.json_output {
        println!(
            "{}",
            serde_json::json!({
                "identityKey": ctx.identity_key,
                "address": address,
                "chain": format!("{:?}", ctx.chain),
            })
        );
    } else {
        println!("Identity key: {}", ctx.identity_key);
        println!("Address: {}", address);
        println!("Chain: {:?}", ctx.chain);
    }

    Ok(())
}
