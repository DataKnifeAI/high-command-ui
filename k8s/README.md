# High Command Kubernetes (Kustomize)

Kustomize-based deployment for the High Command stack: UI, API, Poller, PostgreSQL, Gateway, Cloudflare Tunnel.

## Structure

```
k8s/
├── base/                    # Base resources by component
│   ├── api/                 # API deployments (blue/green), service, pdb
│   ├── ui/                  # UI deployments (blue/green), service, pdb
│   ├── poller/              # Data collector
│   ├── postgres/            # CloudNativePG cluster, pooler
│   ├── gateway/             # Envoy Gateway, HTTPRoute, certificate
│   ├── mcp/                 # MCP service alias, ReferenceGrant
│   └── cloudflare/          # Cloudflare Tunnel deployment
├── overlays/
│   └── default/             # Default overlay (no patches)
├── docs/
│   └── CLOUDFLARE_TUNNEL.md # Tunnel setup guide
└── README.md
```

## Quick Start

```bash
# 1. Create secrets (required before deploy)
kubectl create secret generic high-command-postgres-credentials \
  --from-literal=username=highcommand \
  --from-literal=password='$(openssl rand -base64 32)' \
  -n high-command

kubectl create secret generic high-command-api-secrets \
  --from-literal=database-url='postgresql://user:pass@high-command-postgres-rw.high-command.svc.cluster.local:5432/highcommand' \
  --from-literal=claude-api-key='sk-ant-...' \
  -n high-command

kubectl create secret generic high-command-poller-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=helldivers-api-base='https://api.helldivers2.dev/api/v1' \
  --from-literal=helldivers-api-client-name='High Command' \
  --from-literal=helldivers-api-contact='lee@fullmetal.dev' \
  --from-literal=scrape-interval='300' \
  -n high-command

# 2. Deploy
kubectl apply -k overlays/default

# 3. Cloudflare Tunnel (optional, see docs/CLOUDFLARE_TUNNEL.md)
kubectl create secret generic cloudflared-tunnel-credentials --from-literal=token='...' -n high-command
kubectl apply -k overlays/default
```

## Commands

```bash
# Build manifests (dry-run)
kubectl kustomize overlays/default

# Deploy
kubectl apply -k overlays/default

# Delete
kubectl delete -k overlays/default
```

## Secrets Examples

Secret templates are in `base/*/` with `-example` suffix. Create secrets with `kubectl create`, do not apply example files:

- `base/api/api-secrets-example.yaml`
- `base/ui/ui-secrets-example.yaml`
- `base/poller/poller-secrets-example.yaml`
- `base/postgres/postgres-credentials-example.yaml`
- `base/cloudflare/cloudflared-tunnel-secrets-example.yaml`

## Prerequisites

- **CloudNativePG operator** – for PostgreSQL cluster
- **Envoy Gateway** – for Gateway API
- **cert-manager** – for TLS certificates
- **Namespace** – `kubectl create namespace high-command` (or let apply create it)

## Blue/Green Switching

```bash
kubectl patch svc high-command-ui -n high-command -p '{"spec":{"selector":{"version":"green"}}}'
kubectl patch svc high-command-api -n high-command -p '{"spec":{"selector":{"version":"green"}}}'
```
