"use client";

import { useEffect, useState } from "react";
import { AppWindow, ArrowRight, Folder, Globe, Maximize, Monitor, Sparkles, Store, Terminal, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { FileManager } from "@/components/FileManager";
import { TerminalWindow } from "@/components/TerminalWindow";

type Panel = "terminal" | "files" | "browser" | "store" | null;

export default function HomePage() {
  const [panel, setPanel] = useState<Panel>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
      .then(response => setReady(response.ok))
      .catch(() => setReady(false));
  }, []);

  const fullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  return (
    <main className="os-page">
      <header className="landing-top">
        <div className="logo">
          <span>m</span>
          <strong>manavOS</strong>
          <small>cloud workspace</small>
        </div>

        <div className="top-right">
          <span className={"session-pill " + (ready ? "ready" : "")}>
            <i />
            {ready ? "Cloud ready" : "Starting cloud"}
          </span>
          <button className="fullscreen-button" onClick={fullscreen}>
            <Maximize size={15} />
            Fullscreen
          </button>
        </div>
      </header>

      <section className="landing-center">
        <div className="hero-copy">
          <div className="hero-badge"><Sparkles size={13} /> instant cloud workspace</div>
          <span className="kicker">PUBLIC CLOUD COMPUTER</span>
          <h1>Your computer,<br /><em>anywhere.</em></h1>
          <p>Open an app and start working. Files and Terminal share one persistent workspace on the cloud backbone.</p>
        </div>

        <div className="launcher-grid">
          <AppIcon icon={Terminal} label="Terminal" description="Run commands" onClick={() => setPanel("terminal")} />
          <AppIcon icon={Folder} label="Files" description="Manage your storage" onClick={() => setPanel("files")} />
          <AppIcon icon={Globe} label="Browser" description="Cloud browsing" onClick={() => setPanel("browser")} />
          <AppIcon icon={Store} label="MS-OS Apps Store" description="Apps & tools" onClick={() => setPanel("store")} />
          <AppIcon icon={Monitor} label="MS-OS Desktop" description="Open your workspace" onClick={() => { location.href = "/msos-desktop"; }} />
        </div>

        <div className="workspace-strip">
          <div>
            <span className="workspace-dot" />
            <strong>{ready ? "Workspace online" : "Connecting to workspace"}</strong>
            <small>Anonymous cloud session</small>
          </div>
          <button onClick={() => setPanel("files")}>
            Open Files <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>manavOS 1.0</span>
        <span>Files · Terminal · Desktop</span>
        <span>EC2 backbone</span>
      </footer>

      {panel && (
        <div
          className="panel-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPanel(null);
          }}
        >
          <div className="panel-shell">
            {panel === "terminal" && <TerminalWindow onClose={() => setPanel(null)} />}
            {panel === "files" && <FileManager onClose={() => setPanel(null)} />}
            {(panel === "browser" || panel === "store") && (
              <div className="simple-window">
                <div className="window-bar">
                  <div className="window-title">
                    <span className="window-folder"><AppWindow size={15} /></span>
                    <strong>{panel === "browser" ? "Browser" : "MS-OS Apps Store"}</strong>
                  </div>
                  <button onClick={() => setPanel(null)} aria-label="Close"><X size={15} /></button>
                </div>
                <div className="coming">
                  <span>{panel === "browser" ? "🌐" : "🛍️"}</span>
                  <h2>{panel === "browser" ? "Cloud Browser" : "MS-OS Apps Store"}</h2>
                  <p>This module is ready in the shell and will be connected to its real cloud runtime next.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
