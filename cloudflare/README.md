# Cloudflare Tunnel Image

Builds the cloudflared image for Kubernetes deployment. The official `cloudflare/cloudflared` image is distroless (no shell), so we use Alpine + shell to inject the tunnel token from a k8s secret at runtime.

**Deployment:** See `../k8s/CLOUDFLARE_TUNNEL.md`

**GitLab CI:** The `publish-cloudflared` job builds and pushes this image on tags.
