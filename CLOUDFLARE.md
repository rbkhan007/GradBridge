# GradBridge — Cloudflare Tunnel + Zero Trust Deployment

Expose your GradBridge instance to the internet for free using Cloudflare Tunnel.
No port forwarding, no public IP needed — works behind NAT/firewall.

## Prerequisites

1. A Cloudflare account (free tier)
2. A domain added to Cloudflare (or use a free `.workers.dev` subdomain)
3. Docker running (`docker compose up -d --build`)

## Step 1 — Install cloudflared

```bash
# Windows (winget)
winget install cloudflare.cloudflared

# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

## Step 2 — Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser — select your domain. A certificate is saved to `~/.cloudflared/`.

## Step 3 — Create a Tunnel

```bash
cloudflared tunnel create gradbridge
```

Save the tunnel ID from the output. Add it to your `.env`:

```
CLOUDFLARE_TUNNEL_ID="your-tunnel-id"
```

## Step 4 — Configure the Tunnel

Create `cloudflared-config.yml` (already in the repo):

```yaml
tunnel: gradbridge
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: gradbridge.yourdomain.com
    service: http://web:3000
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

## Step 5 — Add DNS Record

```bash
cloudflared tunnel route dns gradbridge gradbridge.yourdomain.com
```

## Step 6 — Run via Docker Compose

The `docker-compose.yml` already includes a `cloudflared` service.
Just set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` and run:

```bash
docker compose up -d --build
```

Or run cloudflared manually:

```bash
cloudflared tunnel run --config cloudflared-config.yml gradbridge
```

## Step 7 — Enable Zero Trust (Optional but Recommended)

1. Go to https://one.dash.cloudflare.com
2. Networks → Tunnels → select your tunnel
3. Configure → Access policies
4. Add policy:
   - Name: "GradBridge Access"
   - Action: Allow
   - Include: Emails → your@email.com
5. Your app is now behind Zero Trust authentication

## Free Domain Options

| Provider | Free Domain | Example |
|----------|-------------|---------|
| Cloudflare | `.workers.dev` | `gradbridge.your-name.workers.dev` |
| Cloudflare | `.pages.dev` | `gradbridge.your-name.pages.dev` |
| Free DNS | Freenom | `.tk`, `.ml`, `.ga` |
| Your own | Any TLD | `gradbridge.yourdomain.com` |

## Production Checklist

- [ ] `GRADBRIDGE_SECRET` is a strong random string
- [ ] `OPENROUTER_API_KEY` or `GROQ_API_KEY` is set (for LLM responses)
- [ ] Docker containers are healthy: `docker compose ps`
- [ ] Cloudflare tunnel is running: `cloudflared tunnel info gradbridge`
- [ ] Zero Trust policy is configured (optional)
- [ ] pgAdmin4 accessible at `http://localhost:5050`

## Troubleshooting

### Tunnel not connecting
```bash
cloudflared tunnel run --config cloudflared-config.yml gradbridge
# Check logs for errors
```

### 502 Bad Gateway
- Ensure `web` container is running: `docker compose ps`
- Check web logs: `docker compose logs web`
- The tunnel connects to `web:3000` — verify port

### Database connection refused
- Ensure `postgres` container is healthy: `docker compose ps`
- Check postgres logs: `docker compose logs postgres`
