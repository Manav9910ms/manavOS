import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "manavOS — Your computer, anywhere", description: "A public cloud workspace." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
