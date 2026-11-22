import type { Metadata } from "next";
import Link from "next/link";
import { Home, ScanLine } from "lucide-react";
import { pageUser } from "@/lib/server/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Shop-Floor Kiosk" };

/** Full-screen, big-touch layout for a tablet on the shop floor. */
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("workshop", "E");
  const ws = user.workshopId ? await prisma.workshop.findUnique({ where: { id: user.workshopId } }) : null;
  return (
    <div className="kiosk">
      <header className="kiosk-bar">
        <span className="brand-mark" aria-hidden>LB</span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Shop floor{ws ? ` · ${ws.name}` : ""}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{user.name}</div>
        </div>
        <div className="flex gap-2" style={{ marginInlineStart: "auto" }}>
          <Link href="/floor" className="bar-btn" style={{ width: 48, height: 48 }} aria-label="Scan another order"><ScanLine size={24} /></Link>
          <Link href="/" className="bar-btn" style={{ width: 48, height: 48 }} aria-label="Leave the kiosk"><Home size={24} /></Link>
        </div>
      </header>
      <main className="kiosk-body">{children}</main>
    </div>
  );
}
