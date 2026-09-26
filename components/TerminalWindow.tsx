"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Terminal as XTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export function TerminalWindow({ onClose }: { onClose?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const [state, setState] = useState("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_TERMINAL_WS_URL?.trim();
    const url = configured || (window.location.protocol === "http:" ? `ws://${window.location.host}/terminal` : "");
    if (!url) {
      setState("error");
      setError("Secure terminal endpoint is not configured for this HTTPS deployment.");
      return;
    }

    const socket = new WebSocket(url);
    socket.onopen = () => {
      setState("connected");
      const term = new XTerminal({
        cursorBlink: true, convertEol: true, scrollback: 5000, fontSize: 14,
        fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
        theme: { background: "#151515", foreground: "#f5f0e6", cursor: "#e5d5be" }
      });
      term.open(host.current!);
      term.focus();
      term.onData(data => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", data }));
      });
      term.onResize(({ cols, rows }) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "resize", cols, rows }));
      });
      termRef.current = term;
    };
    socket.onmessage = event => termRef.current?.write(typeof event.data === "string" ? event.data : "");
    socket.onerror = () => { setState("error"); setError("Cloud terminal connection failed."); };
    socket.onclose = () => setState("closed");

    return () => {
      socket.close();
      termRef.current?.dispose();
      termRef.current = null;
    };
  }, []);

  return <div className="terminal-window">
    <div className="window-bar dark">
      <div className="window-title">
        <span className="traffic red" /><span className="traffic amber" /><span className="traffic green" />
        <strong>Terminal</strong><small>{state}</small>
      </div>
      <div className="window-actions">
        <button onClick={() => host.current?.requestFullscreen?.()} title="Fullscreen"><Maximize2 size={15}/></button>
        {onClose && <button onClick={onClose} title="Close"><X size={15}/></button>}
      </div>
    </div>
    <div className="terminal-body" ref={host}/>
    {error && <div className="terminal-error">{error}</div>}
  </div>;
}
