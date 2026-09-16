# manavOS architecture

## Product layers

manavOS is intentionally split into two user experiences over one cloud computer:

- **manavOS Interface:** the simplified operating layer for files, cloud browser launch, terminal, apps and machine management.
- **Linux Desktop:** the full Ubuntu graphical environment for advanced users and GUI applications.

The product rule is that these are views of the same persistent machine and user data.

## Current request flow

```text
Browser
  |
  +--> Next.js UI
  |
  +--> /api/auth/* ----- SQLite sessions/users
  |
  +--> /api/files ------ authenticated filesystem API
  |
  +--> /terminal ------- authenticated WebSocket -> node-pty
  |
  +--> /desktop/* ------ authenticated noVNC HTTP proxy
  |                         |
  |                         +--> localhost:6080 websockify
  |                                  |
  |                                  +--> localhost:5901 TigerVNC/XFCE
  |
  +--> /api/browser/open - launches Chromium on the cloud Linux DISPLAY
```

## Control plane

The Node server owns authentication, authorization, API routing, WebSocket upgrades, audit events, and optional EC2 lifecycle actions. The frontend never receives AWS credentials.

When `AWS_INSTANCE_ID` is configured, the server uses the AWS SDK and the server-side IAM identity to describe/start/stop/reboot the configured EC2 instance. The IAM role should be restricted to only those operations and resources required by the deployment.

## Data plane

The current development environment uses the local filesystem for user workspaces and a real PTY for the terminal. Every authenticated user gets a distinct workspace directory. Files APIs are restricted to that directory with path-resolution checks.

This directory boundary is an application isolation boundary, not a complete OS security boundary: the current PTY still runs as the host `ubuntu` account. Production multi-tenancy must move execution into per-user containers/VMs or an equivalent hardened isolation mechanism before untrusted customers are allowed to run arbitrary shell commands.

## Desktop

The Ubuntu desktop is intentionally kept behind the manavOS gateway. TCP 5901 and 6080 should not be open in the public security group. Authentication happens at the manavOS layer before the WebSocket is bridged to websockify.

## Browser

The current Browser app does not pretend an iframe is a cloud browser. It launches Chromium on the cloud Linux desktop with a user-specific profile directory. The next production browser milestone is a dedicated remote-browser session UI with proper streaming/input transport, so browser controls do not depend on opening the full Linux desktop.

## Persistence

SQLite is the application-control database for the current deployment. User files live separately under `MANAVOS_WORKSPACES_DIR` and must be placed on persistent storage in production. A production deployment should keep compute lifecycle independent from user data using a durable volume/object-storage-backed design and an explicit backup/restore policy.
