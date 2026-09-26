import { spawn } from "node-pty";
import fs from "node:fs";

const BWRAP = process.env.MANAVOS_BWRAP || "/usr/bin/bwrap";

export function startSandboxedTerminal(ws, user) {
  if (!fs.existsSync(BWRAP)) {
    ws.send(
      "\r\n\x1b[1;31mTerminal sandbox unavailable.\x1b[0m\r\n" +
      "Bubblewrap is not installed on the EC2 backbone.\r\n"
    );
    ws.close(1011, "sandbox unavailable");
    return;
  }

  const args = [
    "--die-with-parent",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--unshare-net",

    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/etc", "/etc",

    "--dev", "/dev",
    "--proc", "/proc",
    "--tmpfs", "/tmp",

    "--bind", user.workspaceRoot, "/home/guest/workspace",
    "--chdir", "/home/guest/workspace",

    "--setenv", "HOME", "/home/guest/workspace",
    "--setenv", "USER", "guest",
    "--setenv", "TERM", "xterm-256color",
    "--setenv", "PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",

    "/bin/bash", "--noprofile", "--norc", "-i"
  ];

  let term;

  try {
    term = spawn(BWRAP, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      cwd: user.workspaceRoot,
      env: {
        ...process.env,
        HOME: "/home/guest/workspace",
        USER: "guest",
        TERM: "xterm-256color"
      }
    });
  } catch (error) {
    ws.send(
      "\r\n\x1b[1;31mTerminal failed to start.\x1b[0m\r\n" +
      (error instanceof Error ? error.message : "unknown error") +
      "\r\n"
    );
    ws.close(1011, "spawn failed");
    return;
  }

  ws.send(
    "\r\n\x1b[1;36mmanavOS Terminal\x1b[0m\r\n" +
    "Anonymous cloud workspace connected.\r\n\r\n"
  );

  term.onData(data => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  ws.on("message", message => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "input" && typeof data.data === "string") {
        term.write(data.data);
      }

      if (
        data.type === "resize" &&
        Number.isInteger(data.cols) &&
        Number.isInteger(data.rows)
      ) {
        term.resize(
          Math.max(20, Math.min(220, data.cols)),
          Math.max(5, Math.min(80, data.rows))
        );
      }
    } catch {
      // Ignore malformed websocket messages.
    }
  });

  const cleanup = () => {
    try {
      term.kill();
    } catch {}
  };

  ws.on("close", cleanup);
  ws.on("error", cleanup);
  term.onExit(cleanup);
}
