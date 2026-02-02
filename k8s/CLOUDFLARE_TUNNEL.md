# Cloudflare Tunnel in Kubernetes

Expose High Command via Cloudflare Tunnel without port forwarding. The tunnel runs as a pod in the cluster and proxies traffic to internal services.

## Prerequisites

- Tunnel created in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels
- Connector token from the tunnel setup (Docker install step)

## Deploy

### 1. Create the secret with your tunnel token

```bash
kubectl create secret generic cloudflared-tunnel-credentials \
  --from-literal=token='eyJhIjoi...' \
  -n high-command
```

Use the token from the Docker command in the Cloudflare dashboard:
`docker run cloudflare/cloudflared:latest tunnel run --token <TOKEN>`

### 2. Deploy the tunnel and gateway alias

```bash
kubectl apply -f gateway-tunnel-service.yaml
kubectl apply -f cloudflared-tunnel-deployment.yaml
```

### 3. Configure ingress in Cloudflare dashboard

Route all traffic to the Envoy Gateway — it already handles path routing (`/api`, `/mcp`, `/`) and MCP path rewrite via the HTTPRoute.

In Zero Trust → Networks → Tunnels → your tunnel → Public Hostname:

| Public hostname | Path | Service | URL |
|-----------------|------|---------|-----|
| `hc.dataknife.ai` | `/` (or leave empty) | HTTPS | `https://high-command-gateway.high-command.svc.cluster.local:443` |

**Additional application settings** (expand the section when adding the route):

- **Origin Server Name**: `hc.dataknife.ai` — The Gateway's listener matches this hostname. Without it, cloudflared sends the internal k8s hostname as SNI and the Gateway resets the connection.
- **No TLS Verify**: Enable this. The Gateway's cert is for `hc.dataknife.ai`, but cloudflared connects to the internal k8s hostname — TLS verification would fail without it.

## Verify

```bash
kubectl get pods -n high-command -l app=cloudflared-tunnel
kubectl logs -n high-command -l app=cloudflared-tunnel -f
```

## Troubleshooting

**Connection refused or TLS errors:**

- Enable **No TLS Verify** in Additional application settings.
- Confirm the Gateway service name is correct (it may change if the Gateway is recreated).

**API or MCP returns 404:**

- The Gateway's HTTPRoute handles path routing. Verify the Gateway and HTTPRoute are healthy: `kubectl get gateway,httproute -n high-command`.

**If the Envoy Gateway service was recreated** (e.g. after a Gateway update), the `high-command-gateway` ExternalName may point to a stale service. Update it:

```bash
NEW_SVC=$(kubectl get svc -n envoy-gateway-system -o name | grep high-command | cut -d/ -f2)
kubectl patch svc high-command-gateway -n high-command -p "{\"spec\":{\"externalName\":\"${NEW_SVC}.envoy-gateway-system.svc.cluster.local\"}}"
```

## Image options

**Default (Alpine)**: Uses `alpine:3.19` and installs cloudflared from Alpine edge/testing at startup. Works without building.

**Custom (latest cloudflared)**: Build `cloudflare/Dockerfile` to get the official `cloudflare/cloudflared:latest` binary with a shell for token injection:
```bash
docker build -t harbor.dataknife.net/library/cloudflared-tunnel:latest cloudflare/
docker push harbor.dataknife.net/library/cloudflared-tunnel:latest
```
Then change the deployment image to `harbor.dataknife.net/library/cloudflared-tunnel:latest` and remove the `command` block.

## Files

- `cloudflared-tunnel-deployment.yaml` - Deployment (token from secret, `--no-autoupdate`)
- `cloudflared-tunnel-secrets-example.yaml` - Secret template (do not commit real token)
- `gateway-tunnel-service.yaml` - Stable alias to Envoy Gateway for tunnel routing
