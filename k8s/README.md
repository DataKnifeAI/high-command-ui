# Kubernetes Deployment Files

This directory contains Kubernetes manifests for deploying the High Command stack (UI, API, MCP, Gateway, Cloudflare Tunnel).

## Architecture

Traffic flow: **Cloudflare Tunnel** → **Envoy Gateway** → **HTTPRoute** → UI/API/MCP. No nginx Ingress.

## UI Files

- `ui-deployment-blue.yaml`, `ui-deployment-green.yaml` - Blue/green deployments
- `ui-service.yaml` - Service routing
- `ui-pdb.yaml` - Pod Disruption Budget

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

**API secrets** (required): `database-url` and optionally `claude-api-key`:

```bash
kubectl create secret generic high-command-api-secrets \
  --from-literal=database-url='postgresql://user:password@high-command-postgres-rw.high-command.svc.cluster.local:5432/highcommand' \
  --from-literal=claude-api-key='sk-ant-api03-...' \
  -n high-command
```

See `api-secrets-example.yaml` for details.

## Cloudflare

The `../cloudflare/` folder contains the tunnel Dockerfile. GitLab CI builds the cloudflared-tunnel image from `cloudflare/Dockerfile`.

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
