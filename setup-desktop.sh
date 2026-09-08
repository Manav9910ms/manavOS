#!/usr/bin/env bash
set -euo pipefail

# Install a lightweight Ubuntu GUI and expose it only through localhost VNC + noVNC.
# The manavOS Node server proxies /desktop/* to local port 6080.

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xfce4 xfce4-goodies tigervnc-standalone-server novnc websockify

mkdir -p "$HOME/.vnc"
cat > "$HOME/.vnc/config" <<'EOF'
geometry=1280x800
localhost
session=xfce
securitytypes=VncAuth
EOF

if [ ! -f "$HOME/.vnc/passwd" ]; then
  echo "Create a password for the Ubuntu desktop (no more than 8 characters):"
  vncpasswd
fi

# Stop a stale display if one exists, then create a fresh desktop.
tigervncserver -kill :1 >/dev/null 2>&1 || true
tigervncserver :1 -localhost yes -geometry 1280x800 -depth 24 -SecurityTypes VncAuth

# Keep noVNC's web service on localhost only; manavOS proxies it on /desktop.
sudo tee /etc/systemd/system/manavos-novnc.service >/dev/null <<'EOF'
[Unit]
Description=manavOS noVNC gateway
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/usr/share/novnc
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5901
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now manavos-novnc.service

# Helpful diagnostics.
echo
echo "=== Desktop status ==="
tigervncserver -list || true
sudo systemctl --no-pager --full status manavos-novnc.service || true
echo
echo "Ubuntu desktop is ready on local VNC :1 / TCP 5901 and noVNC localhost:6080."
echo "Do NOT open ports 5901 or 6080 in the AWS security group."
