import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import db from "./db.mjs";

const COOKIE="manavos_guest";
const DAYS=30;
const WORKSPACES=path.resolve(process.env.MANAVOS_WORKSPACES_DIR||"./data/workspaces");
fs.mkdirSync(WORKSPACES,{recursive:true,mode:0o700});

function hash(value){return crypto.createHash("sha256").update(value).digest("hex");}
function parseCookie(header=""){const out={};for(const part of header.split(";")){const p=part.trim();if(!p)continue;const i=p.indexOf("=");if(i<0)continue;out[p.slice(0,i)]=decodeURIComponent(p.slice(i+1));}return out;}
function setCookie(res,token){const secure=process.env.MANAVOS_COOKIE_SECURE==="true"?" Secure":"";res.setHeader("Set-Cookie",COOKIE+"="+encodeURIComponent(token)+"; Path=/; Max-Age="+DAYS*86400+"; HttpOnly; SameSite=Lax"+secure);}
export function ensureSession(req,res){
 const token=parseCookie(req.headers.cookie||"")[COOKIE];
 const now=Date.now();
 if(token){
  const row=db.prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?").get(hash(token),now);
  if(row){
   db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(now,row.id);
   return {id:row.id,workspaceId:row.workspace_id,workspaceRoot:path.join(WORKSPACES,row.workspace_id)};
  }
 }
 const id=crypto.randomUUID(), workspaceId="guest-"+id, newToken=crypto.randomBytes(32).toString("base64url");
 const root=path.join(WORKSPACES,workspaceId);
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 db.prepare("INSERT INTO sessions(id,token_hash,workspace_id,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)").run(id,hash(newToken),workspaceId,now,now,now+DAYS*86400000);
 setCookie(res,newToken);
 return {id,workspaceId,workspaceRoot:root};
}
export function cleanupExpiredSessions(){
 const rows=db.prepare("SELECT workspace_id FROM sessions WHERE expires_at<?").all(Date.now());
 db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now());
 for(const row of rows){try{fs.rmSync(path.join(WORKSPACES,row.workspace_id),{recursive:true,force:true});}catch{}}
}