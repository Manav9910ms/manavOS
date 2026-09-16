#!/usr/bin/env bash
set -euo pipefail

# Install a cloud browser for the manavOS Linux desktop.
# The exact package is detected so the application can be started with MANAVOS_BROWSER.

sudo apt-get update

if command -v chromium >/dev/null 2>&1; then
  echo "Chromium already installed: $(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  echo "Chromium already installed: $(command -v chromium-browser)"
elif command -v google-chrome >/dev/null 2>&1; then
  echo "Google Chrome already installed: $(command -v google-chrome)"
else
  echo "Installing Chromium..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y chromium
fi

if command -v chromium >/dev/null 2>&1; then
  browser_path="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  browser_path="$(command -v chromium-browser)"
elif command -v google-chrome >/dev/null 2>&1; then
  browser_path="$(command -v google-chrome)"
else
  echo "No supported Chromium-compatible browser was found." >&2
  exit 1
fi

echo
printf 'Cloud browser installed: %s\n' "$browser_path"
echo 'Set MANAVOS_BROWSER to this path if it is not simply "chromium".'
