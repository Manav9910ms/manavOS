"use client";

import { useEffect, useState } from "react";
import { Cloud, Cpu, HardDrive, MemoryStick, Monitor, Power, Settings, Wifi, Folder, Globe, Terminal, Plus, ChevronRight } from "lucide-react";

const specs = [
  [Cpu, "CPU", "4 vCPU"],
  [MemoryStick, "Memory", "8 GB RAM"],
  [HardDrive, "Storage", "256 GB SSD"],
] as const;

export default function Home() {
  const [powered, setPowered] = useState(true);
  const [modal, setModal] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  const apps = [[Folder, "Files"], [Globe, "Browser"], [Terminal, "Terminal"], [Plus, "App store"]] as const;

  return <main className="os-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">m</span><strong>manavOS</strong></div><div className="status"><Wifi size={15}/><span>Connected</span><i/></div><button className="avatar">M</button></header>
    <section className="workspace">
      <div className="hero"><div><p className="eyebrow">PERSONAL CLOUD COMPUTER</p><h1>Your computer,<br/><em>anywhere.</em></h1><p className="sub">A persistent computer in the cloud. Sign in from any device and pick up exactly where you left off.</p></div><div className="hero-actions"><button className={powered ? "power" : "power off"} onClick={() => setPowered(!powered)}><Power size={17}/>{powered ? "Running" : "Start computer"}</button><button className="icon-button"><Settings size={18}/></button></div></div>
      <div className="machine-card"><div className="machine-head"><div className="machine-title"><div className="computer-icon"><Monitor size={22}/></div><div><h2>My Cloud PC</h2><p>{powered ? "Online · Ready to use" : "Offline · Your data is safe"}</p></div></div><span className={powered ? "pill online" : "pill"}><i/> {powered ? "Online" : "Offline"}</span></div>
        <div className="spec-grid">{specs.map(([Icon,label,value]) => <div className="spec" key={label}><Icon size={18}/><div><small>{label}</small><strong>{value}</strong></div></div>)}</div>
        <div className="machine-footer"><span><Cloud size={15}/> Persistent cloud storage enabled</span><button onClick={() => setModal("configuration")}>Change configuration <ChevronRight size={15}/></button></div>
      </div>
      <div className="section-row"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Everything you need</h2></div><button className="new-app" onClick={() => setModal("App store")}><Plus size={16}/> Add app</button></div>
      <div className="apps">{apps.map(([Icon,name]) => <button className={name === "App store" ? "app muted" : "app"} key={name} onClick={() => setModal(name)}><div className="app-icon"><Icon size={22}/></div><span>{name}</span><ChevronRight size={15}/></button>)}</div>
      <div className="upgrade-banner"><div><span className="eyebrow">BUILD YOUR COMPUTER</span><h3>Need more power?</h3><p>Scale CPU, memory and storage whenever you need it — without moving your data.</p></div><button onClick={() => setModal("configuration")}>Configure computer <ChevronRight size={16}/></button></div>
    </section>
    <footer className="dock"><span>● &nbsp;manavOS 0.1</span><span>{now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span></footer>
    {modal && <div className="backdrop" onClick={() => setModal(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setModal(null)}>×</button>{modal === "configuration" ? <><p className="eyebrow">COMPUTER CONFIGURATION</p><h2>Choose your power</h2><p className="copy">Your files and desktop stay exactly where they are when you change the machine.</p><div className="plans"><button><b>Starter</b><span>2 vCPU · 4 GB · 128 GB</span></button><button className="selected"><b>Personal</b><span>4 vCPU · 8 GB · 256 GB</span></button><button><b>Power</b><span>8 vCPU · 16 GB · 512 GB</span></button></div><button className="primary" onClick={() => setModal(null)}>Save configuration</button></> : <><div className="modal-icon"><Monitor size={23}/></div><h2>{modal}</h2><p className="copy">This is the manavOS preview. The cloud runtime and remote application layer will connect here next.</p><button className="primary" onClick={() => setModal(null)}>Got it</button></>}</div></div>}
  </main>;
}
