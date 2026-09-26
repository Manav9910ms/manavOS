# manavOS

Public cloud workspace for manavos.vercel.app.

No visible login is used. Each browser receives an anonymous session and a private workspace on the EC2 backbone. Files and Terminal operate on the same workspace. The MS-OS Desktop is a web desktop at /msos-desktop with an aqua background.

The landing shell uses a coffee-cream background and exposes Terminal, Files, Browser, MS-OS Apps Store, MS-OS Desktop and Fullscreen.

Browser and Apps Store are intentionally scaffolded for later implementation.

EC2 setup:
1. npm install
2. bash setup-ec2.sh
3. npm run build
4. pm2 start server.mjs --name manavOS
5. pm2 save

Vercel:
Set MANAVOS_BACKEND_URL to the EC2 backbone URL. The included API route proxies /api traffic.

For Terminal on an HTTPS Vercel deployment, set NEXT_PUBLIC_TERMINAL_WS_URL to a real WSS endpoint. A raw ws:// endpoint cannot be used from an HTTPS page.

Security:
The terminal is designed to run through Bubblewrap with network isolation and only the anonymous workspace mounted writable. Do not expose the host filesystem or SSH directly to the browser.