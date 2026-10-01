# Self-hosting Heirloom

Heirloom is a small web app with one container and one database file. If you can run Docker on a spare computer, a NAS or a Raspberry Pi, you can have your own private cookbook in a few minutes. Your recipes, pantry, guests and family notes stay on your machine.

- [Quickstart](#quickstart)
- [What to know first](#what-to-know-first)
- [Pick your platform](#pick-your-platform)
- [Reaching Heirloom from other devices](#reaching-heirloom-from-other-devices)
- [Reverse proxies](#reverse-proxies)
- [Your data, backups and restore](#your-data-backups-and-restore)
- [Upgrades and maintenance](#upgrades-and-maintenance)
- [When something does not work](#when-something-does-not-work)

## Quickstart

You need Docker Engine (or Docker Desktop) with the Compose plugin, and `git`.

```sh
# 1. Get Heirloom (the image is built from this checkout)
git clone <your-heirloom-repo-url> heirloom && cd heirloom

# 2. Create your settings file and the data folder
cp .env.example .env
mkdir -p data && sudo chown 1000:1000 data && chmod 700 data

# 3. Build and start (the first build takes a few minutes)
docker compose up -d --wait
```

**4. Open <http://localhost:3000>.** On an empty cookbook, choose **Load Starter Heirloom Recipes** for five Greek dishes to explore, then read the [Cook's Handbook](USER_GUIDE.md).

Why the `data` folder is a separate step: Heirloom runs as an unprivileged user (UID 1000) and Compose deliberately refuses to create a root-owned folder for you. On Docker Desktop (macOS/Windows) the `chown` is usually unnecessary.

There is no published image to pull. `docker compose up` builds `heirloom:local` from the repository using the `Dockerfile`.

## What to know first

- **There is no login.** Heirloom is built for one household on a trusted network. Do not put it on the open internet.
- **By default it listens on this computer only** (`127.0.0.1:3000`). That is deliberate; see [Reaching Heirloom from other devices](#reaching-heirloom-from-other-devices) to open it up safely.
- **One copy only.** The database is SQLite. Never run two containers against the same `data` folder.
- **Migrations run automatically** every time the container starts. If one fails, the container stops instead of risking your data.
- **AI keys stay in your browser.** Settings stores them in that browser only; the server does not save them. Heirloom works without any key, using offline fallbacks.

Your settings live in `.env` next to `docker-compose.yml`. Compose reads it automatically:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HEIRLOOM_PORT` | `3000` | Port on the host. Change it if 3000 is taken. |
| `HEIRLOOM_PUBLIC_HOST` | empty | A hostname you use to reach Heirloom through a proxy, such as `heirloom.home`. Comma-separate several. No scheme, port or path. |

`DATABASE_URL` in `.env.example` is for running Heirloom outside Docker. Compose sets its own, `/app/data/heirloom.db`.

## Pick your platform

The same `docker-compose.yml` works everywhere. What differs is where the data folder lives and who may write to it (it must be writable by UID 1000).

| Platform | Notes |
| --- | --- |
| **Raspberry Pi 4 or 5** | Use a 64-bit OS (Raspberry Pi OS 64-bit or Ubuntu). The first build compiles a native SQLite module and can take several minutes; a few GB of RAM or some swap helps. After that it runs comfortably. Put `data` on an SSD or a good SD card, and back it up. |
| **Unraid** | Install the Docker Compose Manager plugin (or use the terminal). Clone into `/mnt/user/appdata/heirloom` and run the quickstart there. Run `chown -R 1000:1000 data` since Unraid's default owner differs. |
| **TrueNAS SCALE** | Run the quickstart from a shell on a dataset (for example `/mnt/pool/apps/heirloom`), or use Dockge or Portainer. Give the `data` folder to UID 1000 in the dataset permissions. |
| **Synology** | Enable SSH, clone onto a volume, then run the quickstart. In Container Manager you can create a Project from the folder. Give `data` to UID 1000 over SSH with `sudo chown 1000:1000 data`. |
| **Portainer** | Create the stack from the repository (Stacks → Add stack → Repository) with `docker-compose.yml`. Create the data folder on the host first and, in an override, use its absolute path instead of `./data`. |
| **Any Linux VPS or home server** | Follow the quickstart. Reach it with an SSH tunnel or a private network, not the public internet. |

These are starting points, not a certified list. If a platform's file permissions are unusual, the symptom is always the same ("unable to open database file") and the fix is the same: the `data` folder must belong to UID 1000.

## Reaching Heirloom from other devices

Heirloom checks two things on every request, and both explain most "it won't let me in" moments:

1. **The Host header must be allowed.** That means `localhost`, `127.0.0.1`, `[::1]`, a private LAN address (`10.x`, `172.16-31.x`, `192.168.x`), or a name you list in `HEIRLOOM_PUBLIC_HOST`.
2. **Saving needs a matching `Origin`.** The address in the browser must be the same one the server sees. Forwarded headers (`X-Forwarded-*`) are deliberately ignored.

Four ways to connect, from simplest to most flexible:

- **Same computer:** `http://localhost:3000`.
- **SSH tunnel from your laptop** (nothing published):

  ```sh
  ssh -L 3000:127.0.0.1:3000 you@your-server
  ```

  Then open `http://localhost:3000`.
- **Straight over your home network by IP.** Publish the port on the LAN with a `docker-compose.override.yml` next to the main file:

  ```yaml
  services:
    heirloom:
      ports: !override
        - "0.0.0.0:3000:3000"
  ```

  Run `docker compose up -d`, then open `http://192.168.1.50:3000` (your server's address) on any device. Your router should not forward this port to the internet.
- **By a friendly name through a reverse proxy,** next section.

A caveat for plain `http://` addresses other than `localhost`: browsers treat them as insecure, so the install-to-home-screen option, camera gestures and the screen wake lock in Kitchen Mode are unavailable there. Cooking, timers, shopping lists and everything else work normally. On a tablet you own, Chrome's `unsafely-treat-insecure-origin-as-secure` flag can lift this for your Heirloom address.

## Reverse proxies

A proxy gives you a name such as `http://heirloom.home` instead of an IP and port.

> **Important: use plain HTTP at the proxy for now.** Heirloom compares the browser's `Origin` with the connection it receives and ignores forwarded headers. A proxy that terminates HTTPS makes those differ (`https://…` versus `http://…`), and every save is refused with "Same-origin request required". Page views still load, so it looks like it is working until you try to save. Heirloom is also designed for a trusted network, so HTTPS from the public internet is not recommended. We tested this behaviour directly against a production build.

Every proxy setup needs the same two things:

1. A name that resolves to your server. Add a record in your router or Pi-hole, or an entry in `/etc/hosts` on each device.
2. That name in `.env`, then recreate the container:

   ```sh
   echo 'HEIRLOOM_PUBLIC_HOST=heirloom.home' >> .env
   docker compose up -d
   ```

Heirloom needs no WebSockets. Recipe import streams its progress with server-sent events, so keep proxy buffering off for that path (the snippets below do), and allow a generous read timeout for slow AI providers. Kitchen timers run in the browser and need nothing from the proxy.

### Caddy

For a Caddy running on the same machine:

```caddyfile
http://heirloom.home {
	reverse_proxy 127.0.0.1:3000
}
```

The `http://` matters. Without it Caddy automatically serves HTTPS and saves will fail.

### Nginx

```nginx
server {
    listen 80;
    server_name heirloom.home;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_buffering off;        # live import progress
        proxy_read_timeout 300s;    # slow AI providers
    }
}
```

### Nginx Proxy Manager

When NPM runs in Docker it cannot reach `127.0.0.1:3000` on the host. Put both on a shared network with this `docker-compose.override.yml`, where `npm_default` is the network NPM already uses (`docker network ls`):

```yaml
services:
  heirloom:
    networks: [default, npm_default]
networks:
  npm_default:
    external: true
```

Then add a **Proxy Host**:

| Field | Value |
| --- | --- |
| Domain Names | `heirloom.home` |
| Scheme / Forward Hostname / Port | `http` / `heirloom` / `3000` |
| Block Common Exploits | on |
| SSL tab | **leave everything off**, including Force SSL |

In the **Advanced** tab, add:

```nginx
proxy_buffering off;
proxy_read_timeout 300s;
```

The Websockets Support switch is harmless but not needed.

### Traefik

Use the plain-HTTP entrypoint (called `web` below) and attach Heirloom to Traefik's network, with this `docker-compose.override.yml`. Replace `proxy` with your Traefik network's name:

```yaml
services:
  heirloom:
    networks: [default, proxy]
    labels:
      - traefik.enable=true
      - traefik.docker.network=proxy
      - traefik.http.routers.heirloom.rule=Host(`heirloom.home`)
      - traefik.http.routers.heirloom.entrypoints=web
      - traefik.http.services.heirloom.loadbalancer.server.port=3000
networks:
  proxy:
    external: true
```

Do not add a `websecure` entrypoint or `tls` labels for now. Traefik passes the original `Host` header through by default, which is what Heirloom needs.

### Cloudflare Tunnel (not supported yet)

We have no `cloudflared` configuration to recommend. A tunnel serves your site over HTTPS at Cloudflare, so the browser's `Origin` is `https://…` while `cloudflared` talks to Heirloom over plain HTTP. Saves would be refused for exactly the reason in the box above, and a public tunnel would also expose a cookbook that has no login. If you need access away from home, use an SSH tunnel or a private VPN such as WireGuard, and add the address you use to `HEIRLOOM_PUBLIC_HOST` (for example a Tailscale `100.x.y.z` address; only RFC 1918 LAN addresses are allowed automatically).

## Your data, backups and restore

Everything lives in one folder on your host: **`./data`**, mounted in the container at `/app/data`. The database is `/app/data/heirloom.db` (plus `heirloom.db-wal` and `heirloom.db-shm` while running). It holds recipes, pantry stock, guests, journal notes and settings. `docker compose down` and upgrades never touch it.

**Back up** (the app is stopped briefly so the copy is consistent):

```sh
docker compose stop && tar -czf "heirloom-backup-$(date +%Y%m%d).tar.gz" data/ && docker compose start
```

The archive lands in the current folder, outside `data`. Copy it somewhere else too: another disk, your NAS, or encrypted cloud storage. It contains personal information, so protect it.

**Restore:**

```sh
docker compose stop
mv data data.old
tar -xzf heirloom-backup-20261001.tar.gz        # recreates data/
sudo chown -R 1000:1000 data && chmod 700 data
docker compose up -d --wait
```

Keep `data.old` until you have checked that everything is back, then delete it. A backup written by a newer version may not open in an older one, so restore onto the same version you backed up from (`git log -1` records it).

Two other ways to save your cookbook:

- **In-app backup:** Settings can download recipes, pantry and cooking journals as a JSON file and restore them later, merging by ID. It does not include guests, memories or settings, so the folder backup is the complete one. Details: [backup-api.md](backup-api.md).
- **Nightly backup:** add a cron line such as `15 3 * * * cd /srv/heirloom && docker compose stop && tar -czf /srv/backups/heirloom-$(date +\%a).tar.gz data/ && docker compose start`. Using the weekday name keeps seven rolling copies.

## Upgrades and maintenance

Because Heirloom is built from your checkout rather than pulled from a registry, `docker compose pull` has nothing to fetch. To upgrade:

```sh
# back up first (see above), then
git pull && docker compose build --pull && docker compose up -d --wait
```

Database migrations run on startup. Read the commit log if you want to see what changed. To go back, restore your backup and check out the earlier version with `git checkout <commit>`.

Everyday upkeep:

```sh
docker compose ps                         # status and health
docker compose logs --tail=100 heirloom   # recent logs
docker image prune                        # reclaim space from old builds
```

Docker checks Heirloom's health every 30 seconds. `restart: unless-stopped` brings it back after a reboot or a crash.

## When something does not work

| You see | Try |
| --- | --- |
| `unable to open database file`, or the container keeps restarting | The `data` folder must exist and belong to UID 1000: `sudo chown -R 1000:1000 data`. |
| `bind source path does not exist` | Create it first: `mkdir -p data`. |
| `403 Host not allowed` | Add the name you typed to `HEIRLOOM_PUBLIC_HOST` in `.env` and run `docker compose up -d`. A private LAN IP needs the port published (see above). `*.local` names are not accepted by the default Compose file; use the IP or a real hostname. |
| Pages load, but saving gives `Same-origin request required` | The proxy is serving HTTPS, or it changes the `Host` header. Serve plain HTTP and pass `Host` through. |
| Port 3000 is already in use | Set `HEIRLOOM_PORT=3107` in `.env`, run `docker compose up -d`, and open that port. |
| No camera gestures, wake lock or install option | The page is not on `localhost` or HTTPS. See [the caveat above](#reaching-heirloom-from-other-devices). |
| Local AI (Ollama) cannot be reached | Heirloom talks to `127.0.0.1:11434`, which inside the container is the container itself. Use a cloud provider, or leave AI off and rely on the offline fallbacks. |

For everyday cooking help, see the [Cook's Handbook](USER_GUIDE.md).
