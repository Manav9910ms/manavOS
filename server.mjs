import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import next from "next";
import { WebSocketServer } from "ws";
import { ensureSession, cleanupExpiredSessions } from "./server/session.mjs";
import { resolveWorkspacePath, safeName, listDirectory } from "./server/files.mjs";
import { startSandboxedTerminal } from "./server/terminal.mjs";

const PORT=Number(process.env.MANAVOS_PORT||process.env.PORT||3000);
const dev=process.env.NODE_ENV!=="production";
const dir=path.dirname(fileURLToPath(import.meta.url));

function json(res,status,data){
 res.statusCode=status;
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 res.setHeader("Referrer-Policy","same-origin");
 res.end(JSON.stringify(data));
}
async function readBody(req){
 let raw="";
 for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12*1024*1024)throw new Error("Request too large");}
 return JSON.parse(raw||"{}");
}
async function api(req,res,url){
 const session=ensureSession(req,res);
 if(req.method==="GET"&&url.pathname==="/api/health")return json(res,200,{ok:true,service:"manavOS-backbone"});
 if(req.method==="GET"&&url.pathname==="/api/session")return json(res,200,{ok:true,workspace:session.workspaceId});
 if(url.pathname==="/api/files"){
  try{
   if(req.method==="GET")return json(res,200,await listDirectory(session,url.searchParams.get("path")||""));
   if(req.method==="POST"){
    const data=await readBody(req);if(!data.path)throw new Error("Path required");
    const target=resolveWorkspacePath(session,data.path);await fs.mkdir(path.dirname(target),{recursive:true});
    if(data.action==="mkdir")await fs.mkdir(target);
    else if(data.action==="create")await fs.writeFile(target,"","utf8");
    else if(data.action==="upload"){const content=String(data.content||"");if(content.length>14000000)throw new Error("Upload too large");await fs.writeFile(target,Buffer.from(content,"base64"));}
    else if(data.action==="rename"){const name=safeName(data.name);await fs.rename(target,path.join(path.dirname(target),name));}
    else throw new Error("Unknown file action");
    return json(res,200,{ok:true});
   }
   if(req.method==="DELETE"){
    const target=resolveWorkspacePath(session,url.searchParams.get("path")||"");
    if(target===path.resolve(session.workspaceRoot))throw new Error("Cannot delete workspace root");
    await fs.rm(target,{recursive:true,force:false});return json(res,200,{ok:true});
   }
   return json(res,405,{error:"Method not allowed"});
  }catch(e){return json(res,400,{error:e instanceof Error?e.message:"File operation failed"});}
 }
 if(req.method==="GET"&&url.pathname==="/api/files/read"){
  try{const target=resolveWorkspacePath(session,url.searchParams.get("path")||"");const stat=await fs.stat(target);if(!stat.isFile()||stat.size>1000000)throw new Error("Preview unavailable");return json(res,200,{content:await fs.readFile(target,"utf8")});}
  catch(e){return json(res,400,{error:e instanceof Error?e.message:"Read failed"});}
 }
 if(req.method==="GET"&&url.pathname==="/api/files/download"){
  try{const target=resolveWorkspacePath(session,url.searchParams.get("path")||"");const stat=await fs.stat(target);if(!stat.isFile())throw new Error("Not a file");res.writeHead(200,{"Content-Type":"application/octet-stream","Content-Length":stat.size,"Content-Disposition":"attachment; filename=\""+path.basename(target).replace(/"/g,"")+"\"","X-Content-Type-Options":"nosniff"});createReadStream(target).pipe(res);return;}
  catch(e){return json(res,400,{error:e instanceof Error?e.message:"Download failed"});}
 }
 if(url.pathname.startsWith("/api/browser"))return json(res,501,{error:"Cloud browser is not connected yet."});
 if(url.pathname.startsWith("/api/apps"))return json(res,200,{apps:[]});
 return json(res,404,{error:"API route not found"});
}

async function start(){
 cleanupExpiredSessions();
 const app=next({dev,dir});await app.prepare();const handler=app.getRequestHandler();
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));if(url.pathname.startsWith("/api/"))return api(req,res,url);return handler(req,res);}catch(e){json(res,500,{error:e instanceof Error?e.message:"Internal server error"});}});
 const terminalWss=new WebSocketServer({noServer:true});
 terminalWss.on("connection",(ws,req,session)=>startSandboxedTerminal(ws,session));
 server.on("upgrade",(req,socket,head)=>{const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));if(url.pathname!=="/terminal")return socket.destroy();const session=ensureSession(req,{setHeader(){},get headersSent(){return false;},writeHead(){},end(){}});terminalWss.handleUpgrade(req,socket,head,ws=>terminalWss.emit("connection",ws,req,session));});
 server.listen(PORT,"0.0.0.0",()=>console.log("> manavOS backbone on http://0.0.0.0:"+PORT));
}
start().catch(e=>{console.error(e);process.exit(1);});