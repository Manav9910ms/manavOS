import fs from "node:fs/promises";
import path from "node:path";
function root(user){return path.resolve(user.workspaceRoot);}
export function resolveWorkspacePath(user,relative=""){
 const workspace=root(user), clean=String(relative||"").replace(/^[/\\]+/,""), target=path.resolve(workspace,clean);
 if(target!==workspace&&!target.startsWith(workspace+path.sep))throw new Error("Invalid path");
 return target;
}
export function safeName(value){
 const name=String(value||"").trim();
 if(!name||name==="."||name===".."||name.includes("/")||name.includes("\\")||name.includes("\0"))throw new Error("Invalid name");
 return name;
}
export async function listDirectory(user,relative=""){
 const dir=resolveWorkspacePath(user,relative);
 const entries=await fs.readdir(dir,{withFileTypes:true});
 const items=await Promise.all(entries.map(async e=>{const p=path.join(dir,e.name),s=await fs.stat(p);return{name:e.name,path:path.relative(root(user),p),type:e.isDirectory()?"directory":"file",size:s.size,modified:s.mtime.toISOString()};}));
 items.sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==="directory"?-1:1);
 return {path:path.relative(root(user),dir),items};
}