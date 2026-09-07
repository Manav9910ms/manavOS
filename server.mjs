import http from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import dotenv from "dotenv";
import os from "node:os";

dotenv.config({ path: ".env.local" });

startServer();

async function startServer() {
  const dev = process.env.NODE_ENV === "development";
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = http.createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pin = url.searchParams.get("pin") || "";

    if (!process.env.TERMINAL_PIN || pin !== process.env.TERMINAL_PIN) {
      ws.close(1008, "Invalid terminal PIN");
      return;
    }

    const shell = process.env.SHELL || "/bin/bash";
    const term = pty.spawn(shell, ["-l"], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: process.env.HOME || "/home/ubuntu",
      env: { ...process.env, TERM: "xterm-256color" },
    });

    ws.send(`\r\n\x1b[1;32mmanavOS Terminal\x1b[0m\r\nConnected to ${os.hostname()}\r\n\r\n`);
    term.onData((data) => { if (ws.readyState === 1) ws.send(data); });

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "input" && typeof data.data === "string") term.write(data.data);
        if (data.type === "resize" && Number.isInteger(data.cols) && Number.isInteger(data.rows)) {
          term.resize(Math.max(20, Math.min(240, data.cols)), Math.max(5, Math.min(80, data.rows)));
        }
      } catch {}
    });

    const cleanup = () => { try { term.kill(); } catch {} };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
    if (pathname !== "/terminal") { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, "0.0.0.0", () => {
    console.log(`> manavOS running on http://0.0.0.0:${port}`);
    console.log("> Web terminal endpoint: /terminal");
  });
}
