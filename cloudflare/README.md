# Cloudflare Tunnel Setup for High Command

This guide covers exposing the High Command site via Cloudflare Tunnel (cloudflared), so you can access it over the internet without opening firewall ports or exposing your origin IP.

## Architecture

High Command uses path-based routing (same as the k8s Gateway):

| Path   | Service | Local Port |
|--------|---------|------------|
| `/`    | UI      | 3000       |
| `/api` | API     | 5000       |
| `/mcp` | MCP     | 8000       |

Cloudflare Tunnel supports path-based ingress rules, so we route traffic accordingly.

## Prerequisites

- **cloudflared** installed ([download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/))
- For custom domain (`hc.dataknife.ai`): domain on Cloudflare, nameservers pointed to Cloudflare
- Local services running: UI (3000), API (5000), MCP (8000)

### Install cloudflared (Arch Linux)

```bash
sudo pacman -S cloudflared
```

### Install cloudflared (Debian/Ubuntu)

```bash
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-2.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-2.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

---

## Option 1: Quick Tunnel (No Account, Dev/Testing)

For a fast shareable URL without Cloudflare account or domain setup:

```bash
# Start your local stack first, then:
cloudflared tunnel --url http://localhost:3000
```

This gives you a random `*.trycloudflare.com` URL. **Limitations:**

- UI only (no `/api` or `/mcp` routing)
- 200 concurrent request limit
- No SSE support (affects MCP chat)
- No custom domain

---

## Option 2: Named Tunnel with Custom Domain

For production use with `hc.dataknife.ai`:

### 1. Authenticate

```bash
cloudflared tunnel login
```

This opens a browser to select your Cloudflare account and zone. A `cert.pem` is saved to `~/.cloudflared/`.

### 2. Create the Tunnel

```bash
cloudflared tunnel create high-command
```

Note the tunnel UUID from the output. Credentials are saved to `~/.cloudflared/<UUID>.json`.

### 3. Configure DNS

Route your hostname to the tunnel:

```bash
cloudflared tunnel route dns high-command hc.dataknife.ai
```

This creates a CNAME record: `hc.dataknife.ai` → `<tunnel-id>.cfargotunnel.com`.

### 4. Start Local Services

Ensure all three services are running:

```bash
# Terminal 1: API
cd high-command-api && make run  # or: uvicorn src.app_readonly:app --host 0.0.0.0 --port 5000

# Terminal 2: MCP
cd high-command-mcp && MCP_TRANSPORT=http make run  # or: python -m highcommand.server

# Terminal 3: UI
cd high-command-ui && npm run dev  # Vite dev server on 3000
```

### 5. Generate Config and Run

Run the setup script to generate `config.yml` from the example (replaces tunnel UUID and paths):

```bash
./cloudflare/setup-tunnel.sh
```

Or manually: copy `config.yml.example` to `config.yml`, replace `TUNNEL_UUID` with your tunnel ID, and `YOUR_USERNAME` with your home path.

Then run the tunnel:

```bash
cloudflared tunnel --config cloudflare/config.yml run high-command
```

---

## Option 3: Tunnel to Kubernetes Gateway

If High Command is already running in k8s with a LoadBalancer (e.g. `192.168.14.184` for `hc.dataknife.ai`), you can tunnel to that instead of localhost:

1. Copy `config.yml` to `config-k8s.yml`
2. Replace `localhost` with your gateway IP/hostname in each `service` URL
3. Run: `cloudflared tunnel --config cloudflare/config-k8s.yml run high-command`

This is useful when the tunnel runs on a different machine than the k8s cluster.

---

## MCP Path Rewrite

The k8s Gateway rewrites `/mcp/messages` → `/messages` for the MCP server. Cloudflared does not support path rewriting, so we have two choices:

1. **Use the provided Caddy reverse proxy** (recommended for local dev): Caddy handles path rewrite and routing; cloudflared tunnels to Caddy.
2. **Tunnel directly with path rules**: The MCP server may accept `/mcp/messages` if configured. Check `high-command-mcp` for path handling.

The `config.yml` uses direct path-based routing. If MCP fails, use the Caddy setup below.

---

## Using Caddy as Local Reverse Proxy (Optional)

For full k8s-like routing including MCP path rewrite, run Caddy in front:

```bash
cd cloudflare && caddy run --config Caddyfile
```

Then tunnel to Caddy only:

```bash
# Quick tunnel (no config):
cloudflared tunnel --url http://localhost:8080
```

For a named tunnel with `config-caddy.yml`, replace `TUNNEL_UUID` and `YOUR_USERNAME` as in the main config, or run `setup-tunnel.sh` and manually edit the service URL to `http://localhost:8080`.

---

## Option 4: Docker with Token (Remote Tunnel)

For tunnels created in the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/) (Networks → Tunnels), use the one-time token from the connector setup:

```bash
docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <YOUR_TUNNEL_TOKEN>
```

The token embeds tunnel credentials and routing. Ingress rules are configured in the dashboard, not in a local config file. Use `host.docker.internal` (or `host-gateway` on Linux) to reach services on the host:

- **macOS/Windows**: `http://host.docker.internal:3000` for UI
- **Linux**: add `--add-host=host.docker.internal:host-gateway` and use `http://host.docker.internal:3000`

Or use the host network when running on the same machine:

```bash
docker run --network host cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <YOUR_TUNNEL_TOKEN>
```

With docker-compose (uses host network to reach localhost services):

```bash
CLOUDFLARED_TOKEN=eyJ... docker compose -f cloudflare/docker-compose.yml up -d
```

Or create `cloudflare/.env` with `CLOUDFLARED_TOKEN=...` (add to `.gitignore`).

---

## Run as a Service (Linux)

```bash
sudo cloudflared service install
```

Config path is typically `/etc/cloudflared/config.yml`. Copy your config there and ensure `credentials-file` uses an absolute path.

---

## Troubleshooting

### Connectivity pre-checks

```bash
cloudflared tunnel connectivity precheck
```

### Validate config

```bash
cloudflared tunnel ingress validate
```

### Test which rule matches a URL

```bash
cloudflared tunnel ingress rule https://hc.dataknife.ai/api/health
```

### Quick tunnel fails with "config exists"

Rename or remove `~/.cloudflared/config.yml`; quick tunnels don't work when a config file exists.

---

## Security Notes

- **Cloudflare Access**: Consider protecting the tunnel with [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (e.g. email OTP, GitHub) for non-public demos.
- **Origin validation**: Enable [application token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/) so requests bypassing Access are rejected.
- **Secrets**: Never commit `cert.pem` or `*.json` credentials; they're in `.gitignore`.
