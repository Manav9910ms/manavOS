import http from "node:http";
import { request as httpRequest } from "node:http";
import next from "next";
import WebSocket, { WebSocketServer } from "ws";
import pty from "node-pty";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand, RebootInstancesCommand } from "@aws-sdk/client-ec2";
import db from "./server/db.mjs";
import { clearSessionCookie, createSession, destroySession, getClientIp, getSessionToken, getUserFromRequest, hashPassword, normalizeEmail, sessionCookie, userPublic, validateEmail, validatePassword, verifyPassword } from "./server/auth.mjs";
import { audit, rateLimit, sameOrigin, securityHeaders } from "./server/security.mjs";

dotenv.config({ path: ".env.local" });
const PORT = Number(process.env.PORT || 3000);
const WORKSPACES_DIR = path.resolve(process.env.MANAVOS_WORKSPACES_DIR || "./data/workspaces");
const NOVNC_HOST = "127.0.0.1";
const NOVNC_PORT = 6080;
const NOVNC_ROOT = "/desktop";
const maxBodyBytes = 35 * 1024 * 1024;

function json(res, status, data, extra = {}) {
  if (res.headersSent) return;
  securityHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBodyBytes) { req.destroy(); reject(new Error("Request too large")); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
function safeSegment(value) {
  const s = String(value || "").trim();
  if (!s || s === "." || s === ".." || s.includes("/") || s.includes("\\") || /[\0]/.test(s)) throw new Error("Invalid name");
  return s;
}
function userRoot(user) { return path.resolve(user.workspaceRoot); }
function resolveUserPath(user, relative = "") {
  const clean = String(relative || "").replace(/^[/\\]+/, "");
  const root = userRoot(user);
  const target = path.resolve(root, clean);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error("Invalid path");
  return target;
}
function requireAuth(req, res) {
  const user = getUserFromRequest(req);
  if (!user) { json(res, 401, { error: "Authentication required" }); return null; }
  return user;
}
function machineRecord(user) {
  const now = Date.now();
  const provider = process.env.AWS_INSTANCE_ID ? "aws-ec2" : "local";
  const providerId = process.env.AWS_INSTANCE_ID || os.hostname();
  const id = `machine-${user.id}`;
  const existing = db.prepare("SELECT * FROM machines WHERE id=?").get(id);
  if (existing) return existing;
  db.prepare(`INSERT INTO machines (id,user_id,provider,provider_instance_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, user.id, provider, providerId, "My Cloud PC", "unknown", now, now);
  return db.prepare("SELECT * FROM machines WHERE id=?").get(id);
}
async function localMachineState() {
  const stat = await fs.statfs("/");
  const totalBytes = Number(stat.blocks) * Number(stat.bsize);
  const freeBytes = Number(stat.bavail) * Number(stat.bsize);
  return { status: "online", cpu: os.cpus().length, memoryMb: Math.round(os.totalmem() / 1024 / 1024), storageGb: Math.round(totalBytes / 1024 / 1024 / 1024), freeStorageGb: Math.round(freeBytes / 1024 / 1024 / 1024), provider: "local", providerInstanceId: os.hostname() };
}
let ec2Client;
function getEc2() { if (!ec2Client) ec2Client = new EC2Client({ region: process.env.AWS_REGION || "ap-south-1" }); return ec2Client; }
async function awsMachineState(instanceId) {
  const out = await getEc2().send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const i = out.Reservations?.[0]?.Instances?.[0];
  if (!i) throw new Error("Configured EC2 instance not found");
  const state = i.State?.Name || "unknown";
  const cpu = i.CpuOptions?.CoreCount ? i.CpuOptions.CoreCount * (i.CpuOptions.ThreadsPerCore || 1) : undefined;
  const rootDevice = i.BlockDeviceMappings?.find(x => x.DeviceName === i.RootDeviceName)?.Ebs?.VolumeId;
  return { status: state, cpu, memoryMb: null, storageGb: null, freeStorageGb: null, provider: "aws-ec2", providerInstanceId: instanceId, publicIp: i.PublicIpAddress || null, instanceType: i.InstanceType || null, rootDeviceId: rootDevice || null };
}
async function machineState(user) {
  machineRecord(user);
  return process.env.AWS_INSTANCE_ID ? awsMachineState(process.env.AWS_INSTANCE_ID) : localMachineState();
}

async function handleAuth(req, res, url) {
  const ip = getClientIp(req);
  const rl = rateLimit(`auth:${ip}`, 20, 60_000);
  if (!rl.allowed) return json(res, 429, { error: "Too many authentication attempts", retryAfter: rl.retryAfter });
  try {
    if (req.method === "GET" && url.pathname === "/api/auth/me") {
      const user = getUserFromRequest(req);
      return json(res, 200, user ? { authenticated: true, user: userPublic(user) } : { authenticated: false });
    }
    if (req.method !== "POST" || !sameOrigin(req)) return json(res, 405, { error: "Method not allowed" });
    const body = await parseBody(req);
    if (url.pathname === "/api/auth/signup") {
      const email = normalizeEmail(body.email), name = String(body.name || "").trim().slice(0, 80), password = String(body.password || "");
      if (!validateEmail(email) || !name || !validatePassword(password)) return json(res, 400, { error: "Use a valid name, email, and password (8–128 characters)." });
      if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email)) return json(res, 409, { error: "An account with this email already exists." });
      const id = crypto.randomUUID();
      const workspaceRoot = path.join(WORKSPACES_DIR, id);
      await fs.mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
      const now = Date.now();
      db.prepare("INSERT INTO users (id,email,name,password_hash,workspace_root,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
        .run(id, email, name, hashPassword(password), workspaceRoot, now, now);
      const token = createSession(id);
      audit(db, { userId: id, action: "signup", ip, userAgent: req.headers["user-agent"] });
      res.setHeader("Set-Cookie", sessionCookie(token));
      return json(res, 201, { user: { id, email, name } });
    }
    if (url.pathname === "/api/auth/signin") {
      const email = normalizeEmail(body.email), password = String(body.password || "");
      const row = db.prepare("SELECT id,email,name,password_hash FROM users WHERE email=?").get(email);
      if (!row || !verifyPassword(password, row.password_hash)) return json(res, 401, { error: "Invalid email or password." });
      const token = createSession(row.id);
      audit(db, { userId: row.id, action: "signin", ip, userAgent: req.headers["user-agent"] });
      res.setHeader("Set-Cookie", sessionCookie(token));
      return json(res, 200, { user: { id: row.id, email: row.email, name: row.name } });
    }
    if (url.pathname === "/api/auth/signout") {
      const user = getUserFromRequest(req); const token = getSessionToken(req); destroySession(token);
      if (user) audit(db, { userId: user.id, action: "signout", ip, userAgent: req.headers["user-agent"] });
      res.setHeader("Set-Cookie", clearSessionCookie());
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "Not found" });
  } catch (e) { return json(res, 400, { error: e instanceof Error ? e.message : "Authentication failed" }); }
}

async function handleFiles(req, res, url, user) {
  try {
    if (req.method === "GET") {
      if (url.pathname === "/api/files") {
        const rel = url.searchParams.get("path") || "";
        const dir = resolveUserPath(user, rel);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const items = await Promise.all(entries.filter(e => !e.name.startsWith("." )).map(async e => {
          const p = path.join(dir, e.name), s = await fs.stat(p);
          return { name: e.name, path: path.relative(userRoot(user), p), type: e.isDirectory() ? "directory" : "file", size: s.size, modified: s.mtime.toISOString() };
        }));
        items.sort((a,b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1);
        return json(res, 200, { path: path.relative(userRoot(user), dir), items });
      }
      if (url.pathname === "/api/files/read") {
        const target = resolveUserPath(user, url.searchParams.get("path") || "");
        const st = await fs.stat(target); if (!st.isFile() || st.size > 1_000_000) throw new Error("Preview unavailable for this file");
        return json(res, 200, { path: path.relative(userRoot(user), target), content: await fs.readFile(target, "utf8") });
      }
      if (url.pathname === "/api/files/download") {
        const target = resolveUserPath(user, url.searchParams.get("path") || "");
        const st = await fs.stat(target); if (!st.isFile()) throw new Error("Not a file");
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": st.size, "Content-Disposition": `attachment; filename="${path.basename(target).replace(/"/g,"\\\"")}"` });
        return createReadStream(target).pipe(res);
      }
    }
    if (req.method === "POST") {
      const d = await parseBody(req); const target = resolveUserPath(user, d.path);
      if (!d.path) throw new Error("Path required");
      const parent = path.dirname(target); await fs.mkdir(parent, { recursive: true });
      if (d.action === "mkdir") await fs.mkdir(target);
      else if (d.action === "create") await fs.writeFile(target, String(d.content ?? ""), "utf8");
      else if (d.action === "upload") await fs.writeFile(target, Buffer.from(String(d.content || ""), "base64"));
      else if (d.action === "rename") { const newName = safeSegment(d.name); await fs.rename(target, path.join(parent, newName)); }
      else throw new Error("Unknown file action");
      audit(db, { userId: user.id, action: `file.${d.action}`, ip: getClientIp(req), userAgent: req.headers["user-agent"], metadata: { path: d.path } });
      return json(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      const target = resolveUserPath(user, url.searchParams.get("path") || "");
      if (target === userRoot(user)) throw new Error("Cannot delete workspace root");
      await fs.rm(target, { recursive: true, force: false });
      audit(db, { userId: user.id, action: "file.delete", ip: getClientIp(req), userAgent: req.headers["user-agent"], metadata: { path: path.relative(userRoot(user), target) } });
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (e) { return json(res, 400, { error: e instanceof Error ? e.message : "File operation failed" }); }
}

async function handleMachine(req, res, url, user) {
  try {
    if (req.method === "GET" && url.pathname === "/api/machine") return json(res, 200, { machine: machineRecord(user), ...(await machineState(user)) });
    if (req.method !== "POST" || !sameOrigin(req)) return json(res, 405, { error: "Method not allowed" });
    const action = url.pathname.split("/").pop();
    if (!["start","stop","restart"].includes(action)) return json(res, 404, { error: "Unknown machine action" });
    if (!process.env.AWS_INSTANCE_ID) return json(res, 503, { error: "Cloud provider control is not configured on this server yet." });
    const instanceId = process.env.AWS_INSTANCE_ID;
    const command = action === "start" ? new StartInstancesCommand({ InstanceIds: [instanceId] }) : action === "stop" ? new StopInstancesCommand({ InstanceIds: [instanceId] }) : new RebootInstancesCommand({ InstanceIds: [instanceId] });
    await getEc2().send(command);
    audit(db, { userId: user.id, action: `machine.${action}`, ip: getClientIp(req), userAgent: req.headers["user-agent"], metadata: { instanceId } });
    return json(res, 202, { ok: true, action, status: action === "start" ? "pending" : action === "stop" ? "stopping" : "rebooting" });
  } catch (e) { return json(res, 502, { error: e instanceof Error ? e.message : "Machine operation failed" }); }
}

function launchCloudBrowser(user, url) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const env = { ...process.env, DISPLAY: process.env.MANAVOS_DISPLAY || ":1", HOME: user.workspaceRoot, XDG_CONFIG_HOME: path.join(user.workspaceRoot, ".config"), XDG_CACHE_HOME: path.join(user.workspaceRoot, ".cache") };
  const browser = process.env.MANAVOS_BROWSER || "chromium";
  const child = spawn(browser, ["--no-first-run", "--no-default-browser-check", `--user-data-dir=${path.join(user.workspaceRoot, "browser")}`, target], { env, detached: true, stdio: "ignore" });
  child.unref();
  return child.pid;
}

function proxyNoVNC(req, res, url) {
  const targetPath = url.pathname.replace(new RegExp(`^${NOVNC_ROOT}`), "") || "/";
  const target = httpRequest({ hostname: NOVNC_HOST, port: NOVNC_PORT, path: targetPath + (url.search || ""), method: req.method, headers: { ...req.headers, host: `${NOVNC_HOST}:${NOVNC_PORT}` } }, upstream => { res.writeHead(upstream.statusCode || 502, upstream.headers); upstream.pipe(res); });
  target.on("error", err => json(res, 502, { error: `Desktop gateway unavailable: ${err.message}` }));
  req.pipe(target);
}

async function startServer() {
  await fs.mkdir(WORKSPACES_DIR, { recursive: true, mode: 0o700 });
  const app = next({ dev: process.env.NODE_ENV !== "production" }); await app.prepare(); const handle = app.getRequestHandler();
  const server = http.createServer(async (req,res) => {
    securityHeaders(res);
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/auth/" ) || url.pathname === "/api/auth/me") return handleAuth(req,res,url);
    if (url.pathname === "/api/machine" || url.pathname.startsWith("/api/machine/")) { const user=requireAuth(req,res); if(user)return handleMachine(req,res,url,user); return; }
    if (url.pathname.startsWith("/api/files")) { const user=requireAuth(req,res); if(user)return handleFiles(req,res,url,user); return; }
    if (url.pathname === "/api/browser/open") { const user=requireAuth(req,res); if(!user)return; try{if(req.method!=="POST"||!sameOrigin(req))return json(res,405,{error:"Method not allowed"});const d=await parseBody(req);const pid=launchCloudBrowser(user,String(d.url||"about:blank"));audit(db,{userId:user.id,action:"browser.open",ip:getClientIp(req),userAgent:req.headers["user-agent"],metadata:{url:String(d.url||"about:blank")}});return json(res,202,{ok:true,pid});}catch(e){return json(res,502,{error:e instanceof Error?e.message:"Could not launch cloud browser"});} }
    if (url.pathname.startsWith("/desktop")) { const user=requireAuth(req,res); if(user)return proxyNoVNC(req,res,url); return; }
    return handle(req,res);
  });

  const terminalWss = new WebSocketServer({ noServer: true });
  terminalWss.on("connection", (ws, req, user) => {
    const rl = rateLimit(`ws-terminal:${user.id}`, 10, 60_000); if(!rl.allowed){ws.close(1013,"Rate limited");return;}
    const shell = process.env.SHELL || "/bin/bash";
    const term = pty.spawn(shell,["-l"],{name:"xterm-256color",cols:120,rows:32,cwd:user.workspaceRoot,env:{...process.env,TERM:"xterm-256color",HOME:user.workspaceRoot,USER:user.name,LOGNAME:user.name}});
    ws.send(`\r\n\x1b[1;32mmanavOS Terminal\x1b[0m\r\nConnected to ${os.hostname()}\r\nWorkspace: ${user.workspaceRoot}\r\n\r\n`);
    term.onData(data=>{if(ws.readyState===WebSocket.OPEN)ws.send(data);});
    ws.on("message",message=>{try{const d=JSON.parse(message.toString());if(d.type==="input"&&typeof d.data==="string")term.write(d.data);if(d.type==="resize"&&Number.isInteger(d.cols)&&Number.isInteger(d.rows))term.resize(Math.max(20,Math.min(240,d.cols)),Math.max(5,Math.min(80,d.rows)));}catch{}});
    const cleanup=()=>{try{term.kill();}catch{}}; ws.on("close",cleanup);ws.on("error",cleanup);
  });

  const desktopWss = new WebSocketServer({ noServer: true });
  desktopWss.on("connection",(client,req,user)=>{
    const requestUrl=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`); const targetPath=requestUrl.pathname.replace(/^\/desktop/,"")||"/websockify";
    const target=new WebSocket(`ws://${NOVNC_HOST}:${NOVNC_PORT}${targetPath}${requestUrl.search||""}`);
    const closeBoth=()=>{try{if([WebSocket.OPEN,WebSocket.CONNECTING].includes(target.readyState))target.close();}catch{}try{if([WebSocket.OPEN,WebSocket.CONNECTING].includes(client.readyState))client.close();}catch{}};
    target.on("open",()=>{});client.on("message",(data,isBinary)=>{if(target.readyState===WebSocket.OPEN)target.send(data,{binary:isBinary});});target.on("message",(data,isBinary)=>{if(client.readyState===WebSocket.OPEN)client.send(data,{binary:isBinary});});target.on("error",closeBoth);target.on("close",closeBoth);client.on("error",closeBoth);client.on("close",closeBoth);
  });

  server.on("upgrade",(req,socket,head)=>{const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`);const user=getUserFromRequest(req);if(!user){socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");socket.destroy();return;}if(url.pathname==="/terminal"){return terminalWss.handleUpgrade(req,socket,head,ws=>terminalWss.emit("connection",ws,req,user));}if(url.pathname==="/desktop/websockify"||url.pathname==="/desktop/websockify/"){return desktopWss.handleUpgrade(req,socket,head,ws=>desktopWss.emit("connection",ws,req,user));}socket.destroy();});
  server.listen(PORT,"0.0.0.0",()=>console.log(`> manavOS running on http://0.0.0.0:${PORT}`));
}
startServer().catch(err=>{console.error(err);process.exit(1);});
