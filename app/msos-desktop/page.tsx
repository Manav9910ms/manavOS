"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, File, Folder, Globe, Store, Terminal, X } from "lucide-react";
import { api } from "@/lib/api";
import { TerminalWindow } from "@/components/TerminalWindow";
import { FileManager } from "@/components/FileManager";

type Item={name:string;path:string;type:"file"|"directory";size:number};

export default function MSOSDesktop(){
 const[items,setItems]=useState<Item[]>([]); const[window,setWindow]=useState<"terminal"|"files"|"browser"|"store"|null>(null);
 const reload=()=>api<{items:Item[]}>("/api/files").then(d=>setItems(d.items)).catch(()=>{});
 useEffect(()=>{reload();},[]);
 return <main className="desktop-page">
  <header className="desktop-topbar"><button onClick={()=>history.back()}><ArrowLeft size={16}/></button><strong>MS-OS Desktop</strong><span>Anonymous cloud workspace</span></header>
  <section className="desktop-icons">{items.map(item=><button className="desktop-file-icon" key={item.path} onDoubleClick={()=>item.type==="directory"&&setWindow("files")}><span>{item.type==="directory"?<Folder size={30}/>:<File size={28}/>}</span><b>{item.name}</b></button>)}{items.length===0&&<div className="desktop-empty">Workspace is empty. Create something from Terminal or Files.</div>}</section>
  <div className="desktop-dock"><button onClick={()=>setWindow("files")}><Folder size={20}/><span>Files</span></button><button onClick={()=>setWindow("terminal")}><Terminal size={20}/><span>Terminal</span></button><button onClick={()=>setWindow("browser")}><Globe size={20}/><span>Browser</span></button><button onClick={()=>setWindow("store")}><Store size={20}/><span>Store</span></button></div>
  {window&&<div className="desktop-window-layer">
   {window==="terminal"&&<TerminalWindow onClose={()=>{setWindow(null);reload();}}/>}
   {window==="files"&&<FileManager onClose={()=>{setWindow(null);reload();}}/>}
   {(window==="browser"||window==="store")&&<div className="simple-window desktop-placeholder"><div className="window-bar"><strong>{window==="browser"?"Browser":"MS-OS Apps Store"}</strong><button onClick={()=>setWindow(null)}><X size={15}/></button></div><div className="coming"><span>{window==="browser"?"🌐":"🛍️"}</span><h2>Coming next</h2><p>This window is already part of the desktop shell and will be wired to the cloud runtime later.</p></div></div>}
  </div>}
 </main>;
}