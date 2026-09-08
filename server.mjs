import http from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import dotenv from "dotenv";
import os from "node:os";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

dotenv.config({ path: ".env.local" });
const HOME = process.env.MANAVOS_HOME || process.env.HOME || "/home/ubuntu";
const resolveSafe = (relative = "") => { const clean=String(relative).replace(/^[/\\]+/,""); const target=path.resolve(HOME,clean); if(target!==HOME&&!target.startsWith(HOME+path.sep)) throw new Error("Invalid path"); return target; };
const json=(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));};
const body=req=>new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>40*1024*1024) req.destroy(new Error("Request too large"));});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"));}catch{reject(new Error("Invalid JSON"));}});req.on("error",reject);});

startServer();

async function handleFiles(req,res,url){try{
  if(req.method==="GET"){const rel=url.searchParams.get("path")||"";const dir=resolveSafe(rel);const entries=await fs.readdir(dir,{withFileTypes:true});const items=await Promise.all(entries.filter(e=>!e.name.startsWith(".")).map(async e=>{const p=path.join(dir,e.name);const s=await fs.stat(p);return{name:e.name,path:path.relative(HOME,p),type:e.isDirectory()?"directory":"file",size:s.size,modified:s.mtime.toISOString()};}));items.sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==="directory"?-1:1);return json(res,200,{path:path.relative(HOME,dir),items});}
  if(req.method==="POST"){const d=await body(req);const target=resolveSafe(d.path);if(!d.path||path.basename(target).startsWith("."))throw new Error("Invalid file name");await fs.mkdir(path.dirname(target),{recursive:true});if(d.action==="mkdir")await fs.mkdir(target);else if(d.action==="create")await fs.writeFile(target,String(d.content??""),"utf8");else if(d.action==="upload")await fs.writeFile(target,Buffer.from(String(d.content||""),"base64"));else throw new Error("Unknown action");return json(res,200,{ok:true,path:path.relative(HOME,target)});}
  if(req.method==="DELETE"){const target=resolveSafe(url.searchParams.get("path")||"");if(target===HOME)throw new Error("Cannot delete home");await fs.rm(target,{recursive:true});return json(res,200,{ok:true});}
  return json(res,405,{error:"Method not allowed"});
}catch(e){return json(res,400,{error:e instanceof Error?e.message:"File operation failed"});}}

async function handleDownload(req,res,url){try{const target=resolveSafe(url.searchParams.get("path")||"");const stat=await fs.stat(target);if(!stat.isFile())throw new Error("Not a file");const filename=path.basename(target).replace(/"/g,"\\\"");res.writeHead(200,{"Content-Type":"application/octet-stream","Content-Length":stat.size,"Content-Disposition":`attachment; filename="${filename}"`});createReadStream(target).pipe(res);}catch(e){json(res,404,{error:e instanceof Error?e.message:"File not found"});}}

async function startServer(){
  const dev=process.env.NODE_ENV==="development";const app=next({dev});const handle=app.getRequestHandler();await app.prepare();
  const server=http.createServer(async(req,res)=>{const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`);if(url.pathname==="/api/files")return handleFiles(req,res,url);if(url.pathname==="/api/files/download")return handleDownload(req,res,url);return handle(req,res);});
  const wss=new WebSocketServer({noServer:true});
  wss.on("connection",(ws,req)=>{const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`);const pin=url.searchParams.get("pin")||"";if(!process.env.TERMINAL_PIN||pin!==process.env.TERMINAL_PIN){ws.close(1008,"Invalid terminal PIN");return;}const shell=process.env.SHELL||"/bin/bash";const term=pty.spawn(shell,["-l"],{name:"xterm-256color",cols:120,rows:30,cwd:HOME,env:{...process.env,TERM:"xterm-256color"}});ws.send(`\r\n\x1b[1;32mmanavOS Terminal\x1b[0m\r\nConnected to ${os.hostname()}\r\n\r\n`);term.onData(data=>{if(ws.readyState===1)ws.send(data);});ws.on("message",message=>{try{const d=JSON.parse(message.toString());if(d.type==="input"&&typeof d.data==="string")term.write(d.data);if(d.type==="resize"&&Number.isInteger(d.cols)&&Number.isInteger(d.rows))term.resize(Math.max(20,Math.min(240,d.cols)),Math.max(5,Math.min(80,d.rows)));}catch{}});const cleanup=()=>{try{term.kill();}catch{}};ws.on("close",cleanup);ws.on("error",cleanup);});
  server.on("upgrade",(req,socket,head)=>{const pathname=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`).pathname;if(pathname!=="/terminal"){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req));});
  const port=Number(process.env.PORT||3000);server.listen(port,"0.0.0.0",()=>console.log(`> manavOS running on http://0.0.0.0:${port}`));
}
