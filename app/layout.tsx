import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "manavOS — Your computer, anywhere",
  description: "A cloud-first personal computer that follows you across devices.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
