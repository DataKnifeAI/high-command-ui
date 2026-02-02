# Cloudflared with shell for k8s token injection
# Official image is distroless (no /bin/sh) - we need shell to pass token from secret
FROM harbor.dataknife.net/dockerhub/cloudflare/cloudflared:latest AS cf
FROM harbor.dataknife.net/dockerhub/library/alpine:3.19
COPY --from=cf /usr/local/bin/cloudflared /usr/local/bin/cloudflared
ENTRYPOINT ["/bin/sh", "-c", "exec cloudflared --no-autoupdate tunnel run --token \"$TUNNEL_TOKEN\""]
