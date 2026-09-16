# manavOS

**Your computer, anywhere.**

manavOS is a cloud-computer interface designed around two views of the same persistent machine:

1. **manavOS Interface** — a simplified, cloud-first workspace for everyday tasks such as Files, Browser, Terminal and machine management.
2. **Linux Desktop** — the complete Ubuntu graphical environment for advanced workflows and applications.

## Current architecture

The repository currently uses Next.js + React + TypeScript for the UI and a custom Node server for WebSockets, filesystem APIs and the desktop gateway. A SQLite database stores users, sessions, machines and audit events. Authentication is cookie-based with server-side sessions; protected HTTP APIs and WebSocket upgrades require a valid session.

The current cloud-computer development setup uses Ubuntu + XFCE + TigerVNC + noVNC/websockify. VNC and noVNC should remain on localhost and be reached through the authenticated manavOS desktop gateway rather than by exposing ports 5901/6080 publicly.

Files are stored in an authenticated per-user workspace directory. Terminal sessions start in the same workspace directory, so manavOS Files and Terminal operate on the same application data. A production deployment must use isolated compute (for example per-user VM/container or equivalent) so a user cannot escape their workspace through a shell and access another tenant.

## Environment

Copy `.env.example` to `.env.local` and configure values for the deployment.

Important variables:

- `PORT` — manavOS HTTP/WebSocket port.
- `MANAVOS_DATA_DIR` — persistent directory for the SQLite database.
- `MANAVOS_WORKSPACES_DIR` — persistent per-user workspace root.
- `MANAVOS_DISPLAY` — Linux display used for cloud GUI applications, normally `:1` with the included desktop setup.
- `MANAVOS_BROWSER` — Chromium/Chrome executable used by the cloud browser launcher.
- `AWS_REGION` — AWS region for the EC2 control plane.
- `AWS_INSTANCE_ID` — optional EC2 instance ID. When present, machine start/stop/restart calls are sent to EC2 using the server's IAM credentials. Never put AWS credentials in the frontend or Git.

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production

```bash
npm install
npm run build
npm start
```

For a persistent server process, use PM2 or systemd. The server must have a persistent writable data directory and an IAM role with only the AWS permissions it needs.

## Ubuntu desktop

Run the existing desktop setup on the Ubuntu cloud machine:

```bash
chmod +x setup-desktop.sh
sudo ./setup-desktop.sh
```

Do **not** expose TCP 5901 or TCP 6080 in the AWS security group.

## Cloud browser

The Browser app launches Chromium/Chrome on the cloud Linux desktop with a user-specific browser profile. Install a Chromium-compatible browser with:

```bash
chmod +x setup-browser.sh
./setup-browser.sh
```

The current implementation intentionally reuses the remote Linux desktop for the first cloud-browser integration instead of pretending that an iframe is a cloud browser.

## Security status

The repository now contains the foundation for:

- server-side authentication and sessions
- authenticated WebSockets
- per-user application workspace paths
- path traversal protection
- request limits and basic rate limiting
- secure HTTP headers
- audit events
- real machine-state reporting
- optional AWS EC2 lifecycle operations

The remaining production work includes true per-user compute isolation, full cloud-browser session streaming/UI, persistent storage independent from compute, infrastructure provisioning, backup/restore automation, and complete end-to-end tests against the target AWS deployment.
