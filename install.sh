#!/bin/sh
set -e

REPO="Calhooon/bsv-wallet-cli"
BIN_NAME="bsv-wallet"

# --- Detect OS and architecture ---
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin) OS_TAG="apple-darwin" ;;
    Linux)  OS_TAG="unknown-linux-gnu" ;;
    *)      printf "Error: unsupported OS: %s\n" "$OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64)  ARCH_TAG="x86_64" ;;
    aarch64|arm64) ARCH_TAG="aarch64" ;;
    *)       printf "Error: unsupported architecture: %s\n" "$ARCH"; exit 1 ;;
esac

TARGET="${ARCH_TAG}-${OS_TAG}"
ASSET_NAME="${BIN_NAME}-${TARGET}.tar.gz"

printf "Detected platform: %s-%s (%s)\n" "$OS" "$ARCH" "$TARGET"

# --- Choose install directory ---
if [ -w /usr/local/bin ]; then
    INSTALL_DIR="/usr/local/bin"
else
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

# --- Try downloading a pre-built binary from GitHub releases ---
install_from_release() {
    RELEASE_URL="https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}"
    printf "Checking for pre-built binary at GitHub releases...\n"

    TMPDIR_DL="$(mktemp -d)"
    HTTP_CODE=$(curl -sL -o "$TMPDIR_DL/$ASSET_NAME" -w "%{http_code}" "$RELEASE_URL" 2>/dev/null) || HTTP_CODE=0

    if [ "$HTTP_CODE" = "200" ] && [ -s "$TMPDIR_DL/$ASSET_NAME" ]; then
        printf "Downloading %s ... done.\n" "$ASSET_NAME"
        tar -xzf "$TMPDIR_DL/$ASSET_NAME" -C "$TMPDIR_DL"
        if [ -f "$TMPDIR_DL/$BIN_NAME" ]; then
            mv "$TMPDIR_DL/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
            chmod +x "$INSTALL_DIR/$BIN_NAME"
            rm -rf "$TMPDIR_DL"
            return 0
        fi
        rm -rf "$TMPDIR_DL"
    else
        rm -rf "$TMPDIR_DL"
    fi
    return 1
}

# --- Fallback: build from source via cargo ---
install_from_source() {
    if command -v cargo >/dev/null 2>&1; then
        printf "No pre-built binary found. Building from source with cargo...\n"
        cargo install --git "https://github.com/${REPO}.git"
        return 0
    fi
    return 1
}

# --- Main install flow ---
if install_from_release; then
    printf "Installed %s to %s\n" "$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
elif install_from_source; then
    printf "Installed %s via cargo.\n" "$BIN_NAME"
else
    printf "Error: cargo is not installed.\n"
    printf "Install Rust first: https://rustup.rs\n"
    printf "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh\n"
    exit 1
fi

# --- Verify installation ---
if ! command -v "$BIN_NAME" >/dev/null 2>&1; then
    printf "\nNote: %s was installed to %s\n" "$BIN_NAME" "$INSTALL_DIR"
    printf "Add it to your PATH if needed:\n"
    printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
fi

# --- Getting started ---
printf "\n--- Getting started ---\n"
printf "  bsv-wallet init\n"
printf "  bsv-wallet address\n"
printf "  bsv-wallet daemon\n"
