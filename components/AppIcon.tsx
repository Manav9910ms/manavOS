"use client";

import type { LucideIcon } from "lucide-react";

export function AppIcon({
  icon: Icon,
  label,
  description,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="app-icon-card" onClick={onClick} aria-label={label}>
      <span className="app-icon-mark"><Icon size={28} strokeWidth={1.8} /></span>
      <span className="app-icon-label">{label}</span>
      <span className="app-icon-description">{description}</span>
    </button>
  );
}
