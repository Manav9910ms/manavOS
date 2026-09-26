"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Eye, File, Folder, FolderOpen, FolderPlus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { api } from "@/lib/api";

type Item = { name: string; path: string; type: "file" | "directory"; size: number; modified: string };

export function FileManager({ onClose }: { onClose?: () => void }) {
  const [cwd, setCwd] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<{ item: Item; content: string } | null>(null);
  const [opening, setOpening] = useState(false);

  const load = async (path = cwd) => {
    setLoading(true); setError("");
    try {
      const d = await api<{ path: string; items: Item[] }>("/api/files?path=" + encodeURIComponent(path));
      setCwd(d.path); setItems(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load files");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(""); }, []);

  const create = async (action: "mkdir" | "create") => {
    const name = prompt(action === "mkdir" ? "Folder name" : "File name", action === "mkdir" ? "New Folder" : "new.txt");
    if (!name) return;
    try {
      await api("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, path: cwd ? cwd + "/" + name : name })
      });
      load(cwd);
    } catch (e) { setError(e instanceof Error ? e.message : "Create failed"); }
  };

  const remove = async (item: Item) => {
    if (!confirm("Delete " + item.name + "?")) return;
    try {
      await api("/api/files?path=" + encodeURIComponent(item.path), { method: "DELETE" });
      load(cwd);
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  };

  const upload = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (file.size > 10 * 1024 * 1024) { setError(file.name + " is larger than 10 MB."); continue; }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("Read failed"));
        reader.readAsDataURL(file);
      });
      try {
        await api("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload", path: cwd ? cwd + "/" + file.name : file.name, content: base64 })
        });
      } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    }
    load(cwd);
  };

  const openItem = async (item: Item) => {
    if (item.type === "directory") {
      await load(item.path);
      return;
    }

    setOpening(true);
    setError("");
    try {
      const data = await api<{ content: string }>(
        "/api/files/read?path=" + encodeURIComponent(item.path)
      );
      setViewer({ item, content: data.content });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setOpening(false);
    }
  };

  const parent = cwd ? cwd.split("/").slice(0, -1).join("/") : "";

  return <div className="files-window">
    <div className="window-bar">
      <div className="window-title"><span className="window-folder"><FolderOpen size={15}/></span><strong>Files</strong><small>/{cwd || "home"}</small></div>
      <div className="window-actions"><button onClick={() => load(cwd)} title="Refresh"><RefreshCw size={15}/></button>{onClose && <button onClick={onClose} title="Close"><X size={15}/></button>}</div>
    </div>
    <div className="file-toolbar">
      <button disabled={!cwd} onClick={() => load(parent)}><ArrowLeft size={14}/>Back</button>
      <button onClick={() => create("mkdir")}><FolderPlus size={14}/>Folder</button>
      <button onClick={() => create("create")}><File size={14}/>File</button>
      <label className="toolbar-label"><Upload size={14}/>Upload<input type="file" multiple hidden onChange={e => { upload(e.target.files); e.currentTarget.value = ""; }}/></label>
    </div>
    {error && <div className="file-error">{error}</div>}
    <div className="file-table-head"><span>Name</span><span>Type</span><span>Size</span><span/></div>
    <div className="file-list">
      {loading ? <div className="empty">Loading cloud storage…</div> :
       items.length === 0 ? <div className="empty"><FolderOpen size={24}/>Empty folder</div> :
       items.map(item => <div className="file-row" key={item.path} onDoubleClick={() => openItem(item)}>
         <span className="file-main">{item.type === "directory" ? <Folder size={17}/> : <File size={17}/>}<b>{item.name}</b></span>
         <span>{item.type === "directory" ? "Folder" : "File"}</span>
         <span>{item.type === "directory" ? "—" : Math.max(1, item.size) + " B"}</span>
         <div className="row-actions">
           {item.type === "file" && <button onClick={() => openItem(item)} title="Open"><Eye size={14}/></button>}
           {item.type === "file" && <a href={"/api/files/download?path=" + encodeURIComponent(item.path)} title="Download"><Download size={14}/></a>}
           <button onClick={() => remove(item)} title="Delete"><Trash2 size={14}/></button>
         </div>
       </div>)}
    </div>
    {opening && <div className="file-opening">Opening file…</div>}

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
              <span className="window-folder"><File size={15} /></span>
              <strong>{viewer.item.name}</strong>
              <small>/{viewer.item.path}</small>
            </div>
            <div className="window-actions">
              <a
                href={"/api/files/download?path=" + encodeURIComponent(viewer.item.path)}
                title="Download"
              >
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

    <div className="file-status">Anonymous cloud workspace · /{cwd || "home"}</div>
  </div>;
}
