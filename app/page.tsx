"use client";
import { useEffect, useState } from "react";
import { AppWindow, Folder, Globe, Maximize, Monitor, Store, Terminal, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { FileManager } from "@/components/FileManager";
import { TerminalWindow } from "@/components/TerminalWindow";

type Panel="terminal"|"files"|"browser"|"store"|null;

export default function HomePage(){
 const[panel,setPanel]=useState<Panel>(null); const[ready,setReady]=useState(false);
 useEffect(()=>{fetch("/api/session",{credentials:"same-origin",cache:"no-store"}).then(()=>setReady(true)).catch(()=>setReady(false));},[]);
 const fullscreen=async()=>{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.();};
 return <main className="os-page">
  <header className="landing-top"><div className="logo"><span>m</span><strong>manavOS</strong></div><div className="top-right"><span className={"session-pill "+(ready?"ready":"")}><i/>{ready?"Cloud ready":"Starting cloud"}</span><button className="fullscreen-button" onClick={fullscreen}><Maximize size={15}/>Fullscreen</button></div></header>
  <section className="landing-center"><div className="hero-copy"><span className="kicker">PUBLIC CLOUD COMPUTER</span><h1>Your computer,<br/><em>anywhere.</em></h1><p>Open a tool and start working. Your files and terminal share one anonymous cloud workspace.</p></div>
   <div className="launcher-grid">
    <AppIcon icon={Terminal} label="Terminal" onClick={()=>setPanel("terminal")}/>
    <AppIcon icon={Folder} label="Files" onClick={()=>setPanel("files")}/>
    <AppIcon icon={Globe} label="Browser" onClick={()=>setPanel("browser")}/>
    <AppIcon icon={Store} label="MS-OS Apps Store" onClick={()=>setPanel("store")}/>
    <AppIcon icon={Monitor} label="MS-OS Desktop" onClick={()=>{location.href="/msos-desktop";}}/>
   </div>
  </section>
  <footer className="landing-footer"><span>manavOS 1.0 · anonymous workspace</span><span>EC2 backbone</span></footer>
  {panel&&<div className="panel-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPanel(null);}}><div className="panel-shell">
   {panel==="terminal"&&<TerminalWindow onClose={()=>setPanel(null)}/>}
   {panel==="files"&&<FileManager onClose={()=>setPanel(null)}/>}
   {(panel==="browser"||panel==="store")&&<div className="simple-window"><div className="window-bar"><div className="window-title"><span className="window-folder"><AppWindow size={15}/></span><strong>{panel==="browser"?"Browser":"MS-OS Apps Store"}</strong></div><button onClick={()=>setPanel(null)}><X size={15}/></button></div><div className="coming"><span>{panel==="browser"?"🌐":"🛍️"}</span><h2>{panel==="browser"?"Browser is next.":"Apps Store is next."}</h2><p>The shell is ready. The real cloud runtime for this module will be connected next.</p></div></div>}
  </div></div>}
 </main>;
}