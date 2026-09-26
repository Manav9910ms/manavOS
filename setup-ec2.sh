#!/usr/bin/env bash
set -euo pipefail
sudo apt-get update
sudo apt-get install -y bubblewrap
mkdir -p "$HOME/manavOS/data/workspaces"
echo "manavOS backbone dependencies installed."
echo "Use: npm install && npm run build && pm2 start server.mjs --name manavOS && pm2 save"