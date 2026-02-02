# Kubernetes Deployment Files

This directory contains Kubernetes manifests for deploying the High Command stack (UI, API, MCP, Gateway, Cloudflare Tunnel).

## UI Files

- `ui-deployment-blue.yaml` - Blue deployment (active version)
- `ui-deployment-green.yaml` - Green deployment (standby version)
- `ui-service.yaml` - Service to route traffic between blue/green
- `ui-pdb.yaml` - Pod Disruption Budget for availability
- `ui-ingress.yaml` - Ingress configuration for external access

## Full Stack Files

- `api-deployment-blue.yaml`, `api-deployment-green.yaml` - API deployments
- `api-service.yaml`, `api-pdb.yaml` - API service
- `httproute.yaml` - Gateway API HTTPRoute (/api, /claude, /mcp, /)
- `gateway.yaml`, `gatewayclass.yaml`, `gateway-certificate.yaml` - Envoy Gateway
- `gateway-tunnel-service.yaml` - Alias for Cloudflare Tunnel → Gateway
- `cloudflared-tunnel-deployment.yaml` - Cloudflare Tunnel pod
- `mcp-service.yaml`, `mcp-referencegrant.yaml`, `referencegrant.yaml` - MCP routing

See `CLOUDFLARE_TUNNEL.md` for tunnel setup.

## Secrets

**No secrets are stored in these files.**

**Claude (API key in backend):** Store the key in the API secret so the UI never sees it:

```bash
kubectl create secret generic high-command-api-secrets \
  --from-literal=claude-api-key='sk-ant-api03-...' \
  -n high-command
```

The API proxies `/claude/*` to Anthropic and adds the key server-side.

## Cloudflare

The `../cloudflare/` folder contains the tunnel Dockerfile and local dev config (Caddy, docker-compose). GitLab CI builds the cloudflared-tunnel image from `cloudflare/Dockerfile`.

## Environment Variables

The UI uses environment variables at build time (Vite). These are configured in:
- `ui-deployment-blue.yaml`
- `ui-deployment-green.yaml`

Current environment variables:
- `NODE_ENV=production`
- `PORT=3000`

For build-time variables (e.g., `VITE_CLAUDE_API_KEY`), they must be set during the Docker build process, not at runtime.

## Deployment

Deploy all resources:

```bash
kubectl apply -f k8s/
```

Switch between blue/green by updating the service selector in `ui-service.yaml`:

```yaml
selector:
  app: high-command-ui
  version: blue  # or green
```

Or use the annotation:

```bash
kubectl annotate service high-command-ui \
  deployment.kubernetes.io/active-version=green \
  -n high-command
```
