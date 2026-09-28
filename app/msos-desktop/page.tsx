"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, File, Folder, Globe, RefreshCw, Store, Terminal, X } from "lucide-react";
import { api } from "@/lib/api";
import { TerminalWindow } from "@/components/TerminalWindow";
import { FileManager } from "@/components/FileManager";

type Item = { name: string; path: string; type: "file" | "directory"; size: number };

export default function MSOSDesktop() {
  const [items, setItems] = useState<Item[]>([]);
  const [window, setWindow] = useState<"terminal" | "files" | "browser" | "store" | null>(null);
  const [viewer, setViewer] = useState<{ item: Item; content: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const reload = async () => {
    setRefreshing(true);
    try {
      const data = await api<{ items: Item[] }>("/api/files");
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openItem = async (item: Item) => {
    if (item.type === "directory") {
      setWindow("files");
      return;
    }

    setOpening(true);
    try {
      const data = await api<{ content: string }>(
        "/api/files/read?path=" + encodeURIComponent(item.path)
      );
      setViewer({ item, content: data.content });
    } catch {
      setWindow("files");
    } finally {
      setOpening(false);
    }
  };

  return (
    <main className="desktop-page">
      <header className="desktop-topbar">
        <button onClick={() => history.back()} title="Back"><ArrowLeft size={16} /></button>
        <div className="desktop-brand">
          <strong>MS-OS Desktop</strong>
          <small>Cloud workspace</small>
        </div>
        <div className="desktop-status">
          <span className="workspace-dot" />
          <span>Online</span>
          <button onClick={reload} disabled={refreshing} title="Refresh workspace">
            <RefreshCw className={refreshing ? "spin" : ""} size={15} />
          </button>
        </div>
      </header>

      <section className="desktop-icons">
        {items.map(item => (
          <button className="desktop-file-icon" key={item.path} onDoubleClick={() => openItem(item)} title={"Open " + item.name}>
            <span>
              {item.type === "directory"
                ? <Folder className="folder-icon-blue" size={30} />
                : <File className="file-icon-white" size={28} />}
            </span>
            <b>{item.name}</b>
          </button>
        ))}
        {items.length === 0 && (
          <div className="desktop-empty">
            <Folder size={32} />
            <strong>No files yet</strong>
            <span>Create something from Terminal or Files and it will appear here.</span>
          </div>
        )}
      </section>

      <div className="desktop-dock">
        <button onClick={() => setWindow("files")}><Folder size={20} /><span>Files</span></button>
        <button onClick={() => setWindow("terminal")}><Terminal size={20} /><span>Terminal</span></button>
        <button onClick={() => setWindow("browser")}><Globe size={20} /><span>Browser</span></button>
        <button onClick={() => setWindow("store")}><Store size={20} /><span>Store</span></button>
      </div>

      {opening && <div className="file-opening">Opening file…</div>}

      {window && (
        <div className="desktop-window-layer">
          {window === "terminal" && (
            <TerminalWindow onClose={() => { setWindow(null); reload(); }} />
          )}
          {window === "files" && (
            <FileManager onClose={() => { setWindow(null); reload(); }} />
          )}
          {(window === "browser" || window === "store") && (
            <div className="simple-window desktop-placeholder">
              <div className="window-bar">
                <strong>{window === "browser" ? "Browser" : "MS-OS Apps Store"}</strong>
                <button onClick={() => setWindow(null)} title="Close"><X size={15} /></button>
              </div>
              <div className="coming">
                <span>{window === "browser" ? "🌐" : "🛍️"}</span>
                <h2>{window === "browser" ? "Cloud Browser" : "MS-OS Apps Store"}</h2>
                <p>This window is ready in the shell. The real cloud module will be connected next.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {viewer && (
        <div
          className="file-preview-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setViewer(null);
          }}
        >
          <div className="file-preview-window">
            <div className="window-bar">
              <div className="window-title">
                <span className="window-folder"><File className="file-icon-white" size={15} /></span>
                <strong>{viewer.item.name}</strong>
                <small>/{viewer.item.path}</small>
              </div>
              <div className="window-actions">
                <a href={"/api/files/download?path=" + encodeURIComponent(viewer.item.path)} title="Download">
                  <Download size={15} />
                </a>
                <button onClick={() => setViewer(null)} title="Close"><X size={15} /></button>
              </div>
            </div>
            <pre className="file-preview-content">
              {viewer.content || "This file is empty."}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
