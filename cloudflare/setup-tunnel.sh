#!/usr/bin/env bash
# One-time setup for High Command Cloudflare Tunnel
# Run from project root: ./cloudflare/setup-tunnel.sh

set -e

TUNNEL_NAME="high-command"
CONFIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFLARED_DIR="${HOME}/.cloudflared"

echo "=== High Command Cloudflare Tunnel Setup ==="
echo

# Check cloudflared
if ! command -v cloudflared &>/dev/null; then
    echo "cloudflared not found. Install it first:"
    echo "  Arch:   sudo pacman -S cloudflared"
    echo "  Debian: see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
fi

# Login if no cert
if [[ ! -f "${CLOUDFLARED_DIR}/cert.pem" ]]; then
    echo "Authenticating with Cloudflare..."
    cloudflared tunnel login
fi

# Create tunnel if it doesn't exist
if ! cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
    echo "Creating tunnel: ${TUNNEL_NAME}"
    cloudflared tunnel create "${TUNNEL_NAME}"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "${TUNNEL_NAME}" | awk '{print $1}')
if [[ -z "${TUNNEL_ID}" ]]; then
    echo "Could not find tunnel ID. Run: cloudflared tunnel list"
    exit 1
fi

CREDS_FILE="${CLOUDFLARED_DIR}/${TUNNEL_ID}.json"
if [[ ! -f "${CREDS_FILE}" ]]; then
    echo "Credentials file not found: ${CREDS_FILE}"
    exit 1
fi

echo
echo "Tunnel ID: ${TUNNEL_ID}"
echo "Credentials: ${CREDS_FILE}"
echo

# Generate config from template
CONFIG_FILE="${CONFIG_DIR}/config.yml"
sed -e "s/TUNNEL_UUID/${TUNNEL_ID}/g" \
    -e "s|/home/YOUR_USERNAME|${HOME}|g" \
    "${CONFIG_DIR}/config.yml.example" > "${CONFIG_FILE}"
echo "Generated: ${CONFIG_FILE}"

# Route DNS (optional - may fail if zone not on Cloudflare)
echo
read -p "Route hc.dataknife.ai to this tunnel? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cloudflared tunnel route dns "${TUNNEL_NAME}" hc.dataknife.ai
    echo "DNS route created."
fi

echo
echo "=== Setup complete ==="
echo "Start services (UI:3000, API:5000, MCP:8000), then run:"
echo "  cloudflared tunnel --config ${CONFIG_FILE} run ${TUNNEL_NAME}"
echo
