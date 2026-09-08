#!/usr/bin/env bash
set -euo pipefail

# Install a lightweight Ubuntu GUI and expose it only through localhost VNC + noVNC.
# manavOS proxies /desktop/* to localhost:6080.

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xfce4 xfce4-goodies tigervnc-standalone-server novnc websockify dbus-x11

mkdir -p "$HOME/.vnc"
cat > "$HOME/.vnc/config" <<'EOF'
geometry=1280x800
localhost
securitytypes=VncAuth
EOF

cat > "$HOME/.vnc/xstartup" <<'EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_CURRENT_DESKTOP=XFCE
export XDG_CONFIG_DIRS=/etc/xdg/xdg-xfce:/etc/xdg
exec dbus-launch --exit-with-session startxfce4
EOF
chmod +x "$HOME/.vnc/xstartup"

if [ ! -f "$HOME/.vnc/passwd" ]; then
  echo "Create a password for the Ubuntu desktop (max 8 characters). Keep it private."
  vncpasswd
fi

# Restart display :1 cleanly.
tigervncserver -kill :1 >/dev/null 2>&1 || true

sudo tee /etc/systemd/system/manavos-vnc.service >/dev/null <<'EOF'
[Unit]
Description=manavOS Ubuntu desktop VNC
After=network.target

[Service]
Type=forking
User=ubuntu
Environment=HOME=/home/ubuntu
ExecStart=/usr/bin/tigervncserver :1 -localhost yes -geometry 1280x800 -depth 24 -SecurityTypes VncAuth
ExecStop=/usr/bin/tigervncserver -kill :1
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/manavos-novnc.service >/dev/null <<'EOF'
[Unit]
Description=manavOS noVNC gateway
Requires=manavos-vnc.service
After=manavos-vnc.service network.target

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
sudo systemctl enable manavos-vnc.service manavos-novnc.service
sudo systemctl restart manavos-vnc.service
sudo systemctl restart manavos-novnc.service

sleep 2

echo
echo "=== VNC status ==="
sudo systemctl --no-pager --full status manavos-vnc.service || true
echo
echo "=== noVNC status ==="
sudo systemctl --no-pager --full status manavos-novnc.service || true
echo
echo "=== Listening ports ==="
sudo ss -lntp | grep -E ':5901|:6080' || true
echo
echo "Ubuntu desktop is local-only on VNC :5901 and noVNC :6080."
echo "Do NOT open ports 5901 or 6080 in the AWS security group."
