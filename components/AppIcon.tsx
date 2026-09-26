"use client";

import type { LucideIcon } from "lucide-react";

export function AppIcon({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <button className="app-icon-card" onClick={onClick}><span className="app-icon-mark"><Icon size={28} strokeWidth={1.8} /></span><span>{label}</span></button>;
}
