# Kubernetes Deployment Files

This directory contains Kubernetes manifests for deploying the High Command UI.

## Files

- `ui-deployment-blue.yaml` - Blue deployment (active version)
- `ui-deployment-green.yaml` - Green deployment (standby version)
- `ui-service.yaml` - Service to route traffic between blue/green
- `ui-pdb.yaml` - Pod Disruption Budget for availability
- `ui-ingress.yaml` - Ingress configuration for external access

## Secrets

**No secrets are stored in these files.**

If you need to use Claude integration, add the API key as a Kubernetes Secret:

```bash
kubectl create secret generic high-command-ui-secrets \
  --from-literal=vite-claude-api-key='your-api-key-here' \
  -n high-command
```

Then update the deployments to reference the secret:

```yaml
env:
- name: VITE_CLAUDE_API_KEY
  valueFrom:
    secretKeyRef:
      name: high-command-ui-secrets
      key: vite-claude-api-key
```

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
