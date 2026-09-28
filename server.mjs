import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import db from "./server/db.mjs";
import { ensureSession, getSession, linkFirebaseSession, signOut, cleanupExpiredSessions } from "./server/session.mjs";
import { verifyFirebaseIdToken } from "./server/firebase-admin.mjs";
import { resolveWorkspacePath, safeName, listDirectory } from "./server/files.mjs";
import { startSandboxedTerminal } from "./server/terminal.mjs";

const PORT = Number(process.env.MANAVOS_PORT || process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";
const dir = path.dirname(fileURLToPath(import.meta.url));

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 12 * 1024 * 1024) {
      throw new Error("Request too large");
    }
  }
  return JSON.parse(raw || "{}");
}

function publicUser(firebaseUid) {
  if (!firebaseUid) return null;
  const row = db.prepare(
    "SELECT firebase_uid, email, name FROM users WHERE firebase_uid=?"
  ).get(firebaseUid);

  return row
    ? { uid: row.firebase_uid, email: row.email, name: row.name }
    : null;
}

async function api(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/auth/firebase") {
    try {
      const data = await readBody(req);
      const decoded = await verifyFirebaseIdToken(data.idToken);
      const email = String(decoded.email || "").trim().toLowerCase();
      if (!email) throw new Error("The Firebase account has no email address.");

      const profile = {
        uid: decoded.uid,
        email,
        name: String(decoded.name || email.split("@")[0] || "manavOS User").trim()
      };

      const session = linkFirebaseSession(req, res, profile);
      return json(res, 200, {
        authenticated: true,
        user: { uid: session.firebaseUid, email: session.email, name: session.name },
        workspace: session.workspaceId
      });
    } catch (error) {
      console.error("[auth] Firebase session exchange failed:", error);
      return json(res, 401, {
        error: error instanceof Error ? error.message : "Firebase authentication failed"
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signout") {
    signOut(req, res);
    return json(res, 200, { ok: true });
  }

  const session = ensureSession(req, res);

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    return json(res, 200, {
      authenticated: Boolean(session.firebaseUid),
      user: publicUser(session.firebaseUid),
      workspace: session.workspaceId
    });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "manavOS-backbone" });
  }

  if (req.method === "GET" && url.pathname === "/api/session") {
    return json(res, 200, {
      ok: true,
      workspace: session.workspaceId,
      authenticated: Boolean(session.firebaseUid),
      user: publicUser(session.firebaseUid)
    });
  }

  if (url.pathname === "/api/files") {
    try {
      if (req.method === "GET") {
        return json(res, 200, await listDirectory(
          session,
          url.searchParams.get("path") || ""
        ));
      }

      if (req.method === "POST") {
        const data = await readBody(req);
        if (!data.path) throw new Error("Path required");

        const target = resolveWorkspacePath(session, data.path);
        await fs.mkdir(path.dirname(target), { recursive: true });

        if (data.action === "mkdir") {
          await fs.mkdir(target);
        } else if (data.action === "create") {
          await fs.writeFile(target, "", "utf8");
        } else if (data.action === "upload") {
          const content = String(data.content || "");
          if (content.length > 14000000) throw new Error("Upload too large");
          await fs.writeFile(target, Buffer.from(content, "base64"));
        } else if (data.action === "rename") {
          const name = safeName(data.name);
          await fs.rename(target, path.join(path.dirname(target), name));
        } else {
          throw new Error("Unknown file action");
        }

        return json(res, 200, { ok: true });
      }

      if (req.method === "DELETE") {
        const target = resolveWorkspacePath(
          session,
          url.searchParams.get("path") || ""
        );

        if (target === path.resolve(session.workspaceRoot)) {
          throw new Error("Cannot delete workspace root");
        }

        await fs.rm(target, { recursive: true, force: false });
        return json(res, 200, { ok: true });
      }

      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "File operation failed"
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/files/read") {
    try {
      const target = resolveWorkspacePath(
        session,
        url.searchParams.get("path") || ""
      );
      const stat = await fs.stat(target);
      if (!stat.isFile() || stat.size > 1000000) {
        throw new Error("Preview unavailable");
      }
      return json(res, 200, {
        content: await fs.readFile(target, "utf8")
      });
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Read failed"
      });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/files/download") {
    try {
      const target = resolveWorkspacePath(
        session,
        url.searchParams.get("path") || ""
      );
      const stat = await fs.stat(target);
      if (!stat.isFile()) throw new Error("Not a file");

      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": stat.size,
        "Content-Disposition":
          'attachment; filename="' +
          path.basename(target).replace(/"/g, "") +
          '"',
        "X-Content-Type-Options": "nosniff"
      });

      createReadStream(target).pipe(res);
      return;
    } catch (error) {
      return json(res, 400, {
        error: error instanceof Error ? error.message : "Download failed"
      });
    }
  }

  if (url.pathname.startsWith("/api/browser")) {
    return json(res, 501, { error: "Cloud browser is not connected yet." });
  }

  if (url.pathname.startsWith("/api/apps")) {
    return json(res, 200, { apps: [] });
  }

  return json(res, 404, { error: "API route not found" });
}

async function start() {
  cleanupExpiredSessions();

  const app = next({ dev, dir });
  await app.prepare();

  const handler = app.getRequestHandler();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(
        req.url || "/",
        "http://" + (req.headers.host || "localhost")
      );

      if (url.pathname.startsWith("/api/")) {
        return api(req, res, url);
      }

      return handler(req, res);
    } catch (error) {
      json(res, 500, {
        error: error instanceof Error ? error.message : "Internal server error"
      });
    }
  });

  const terminalWss = new WebSocketServer({ noServer: true });

  terminalWss.on("connection", (ws, req, session) => {
    startSandboxedTerminal(ws, session);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(
      req.url || "/",
      "http://" + (req.headers.host || "localhost")
    );

    if (url.pathname !== "/terminal") {
      return socket.destroy();
    }

    const session = getSession(req);
    if (!session) {
      return socket.destroy();
    }

    terminalWss.handleUpgrade(
      req,
      socket,
      head,
      ws => terminalWss.emit("connection", ws, req, session)
    );
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log("> manavOS backbone on http://0.0.0.0:" + PORT);
  });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
