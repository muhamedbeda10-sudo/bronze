"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Boxes, ClipboardCheck, ClipboardList, Database, Factory, FileBarChart, Hammer, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun, Timer, X,
  type LucideIcon,
} from "lucide-react";
import { MODULE_LABEL, MODULE_PATH, moduleOfPath, type Module } from "@/lib/domain/access";
import { initials } from "@/lib/format";
import { signOutAction } from "@/app/actions";

const ICON: Record<Module, LucideIcon> = {
  dashboard: BarChart3,
  workOrders: ClipboardList,
  planning: Factory,
  workshop: Hammer,
  quality: ClipboardCheck,
  inventory: Boxes,
  overtime: Timer,
  reports: FileBarChart,
  masterData: Database,
  settings: Settings,
};

/** The sidebar asks questions of the plant, grouped as the documentation's modules are. */
const GROUPS: { label: string; modules: Module[] }[] = [
  { label: "Operations", modules: ["dashboard", "workOrders", "planning", "workshop", "quality", "inventory", "overtime"] },
  { label: "Management", modules: ["reports"] },
  { label: "Administration", modules: ["masterData", "settings"] },
];

export interface ShellUser {
  name: string;
  roleLabel: string;
  email: string;
}

function NavList({ visible, active, onPick }: { visible: Module[]; active: Module | null; onPick?: () => void }) {
  return (
    <nav className="side-nav no-scrollbar" aria-label="Main">
      {GROUPS.map((g) => {
        const mods = g.modules.filter((m) => visible.includes(m));
        if (!mods.length) return null;
        return (
          <div key={g.label}>
            <div className="side-label">{g.label}</div>
            <ul className="side-list">
              {mods.map((m) => {
                const I = ICON[m];
                const on = m === active;
                return (
                  <li key={m}>
                    <Link href={MODULE_PATH[m]} className={`side-item ${on ? "side-item-on" : ""}`} aria-current={on ? "page" : undefined} title={MODULE_LABEL[m]} onClick={onPick}>
                      <I size={19} className="side-icon" aria-hidden />
                      <span className="side-text">{MODULE_LABEL[m]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ company, logo }: { company: string; logo?: string }) {
  return (
    <Link href="/" className="side-brand" aria-label={`${company} — home`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="side-mark" style={{ objectFit: "contain", background: "#fff", padding: 3 }} />
      ) : (
        <span className="side-mark" aria-hidden>LB</span>
      )}
      <span className="side-word">
        <b>LOTFY BRONZE</b>
        <span>CastFlow MES · since 1960</span>
      </span>
    </Link>
  );
}

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
}

export function AppShell({ user, visible, company, logo, children }: { user: ShellUser; visible: Module[]; company: string; logo?: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = moduleOfPath(pathname);
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  function togglePin() {
    const pinned = !document.documentElement.classList.contains("side-pinned");
    document.documentElement.classList.toggle("side-pinned", pinned);
    try { localStorage.setItem("side", pinned ? "pinned" : "mini"); } catch {}
    setOpen(false);
  }

  // the strip opens over the page after a short rest of the pointer, so a pointer only crossing it opens nothing
  const enter = () => { timer.current = setTimeout(() => setOpen(true), 160); };
  const leave = () => { if (timer.current) clearTimeout(timer.current); setOpen(false); };

  return (
    <>
      <aside className="app-side" data-open={open ? "" : undefined} onMouseEnter={enter} onMouseLeave={leave} onFocus={() => setOpen(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
        <Brand company={company} logo={logo} />
        <NavList visible={visible} active={active} onPick={() => setOpen(false)} />
        <div className="side-foot">
          <button type="button" className="side-item w-full" onClick={togglePin} style={{ border: 0, background: "none", cursor: "pointer" }}>
            <PanelLeftClose size={19} className="side-icon pin-on" aria-hidden />
            <span className="side-text">Keep the menu open</span>
          </button>
        </div>
      </aside>

      {drawer && (
        <>
          <div className="drawer-back" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex items-center justify-between" style={{ borderBottom: "1px solid var(--nav-border)" }}>
              <Brand company={company} logo={logo} />
              <button type="button" className="icon-btn" style={{ color: "var(--nav-fg)", marginInlineEnd: 8 }} onClick={() => setDrawer(false)} aria-label="Close the menu"><X size={20} /></button>
            </div>
            <NavList visible={visible} active={active} onPick={() => setDrawer(false)} />
          </div>
        </>
      )}

      <div className="app-body">
        <header className="app-top no-print">
          <button type="button" className="icon-btn lg:hidden" onClick={() => setDrawer(true)} aria-label="Open the menu"><Menu size={20} /></button>
          <div className="top-title">
            <h1>{active ? MODULE_LABEL[active] : company}</h1>
          </div>
          <div className="flex items-center gap-1" style={{ marginInlineStart: "auto" }}>
            <button type="button" className="icon-btn hidden lg:inline-grid" onClick={togglePin} title="Keep the menu open / fold it" aria-label="Keep the menu open or fold it">
              <PanelLeftOpen size={18} aria-hidden />
            </button>
            <button type="button" className="icon-btn" onClick={toggleTheme} title="Light / dark" aria-label="Toggle dark mode">
              <Moon size={18} className="dark:hidden" aria-hidden />
              <Sun size={18} className="hidden dark:block" aria-hidden />
            </button>
            <div className="relative" ref={menuRef}>
              <button type="button" className="flex items-center gap-2" style={{ background: "none", border: 0, cursor: "pointer", padding: 2 }} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account">
                <span className="avatar">{initials(user.name)}</span>
                <span className="hidden md:flex flex-col items-start" style={{ lineHeight: 1.15 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{user.roleLabel}</span>
                </span>
              </button>
              {menu && (
                <div role="menu" className="card absolute" style={{ insetInlineEnd: 0, top: 44, width: 240, padding: 6, zIndex: 50, boxShadow: "var(--shadow-lg)" }}>
                  <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700 }}>{user.name}</div>
                    <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{user.email}</div>
                  </div>
                  <form action={signOutAction}>
                    <button type="submit" role="menuitem" className="btn btn-ghost w-full" style={{ justifyContent: "flex-start" }}>
                      <LogOut size={16} aria-hidden /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page" id="main">{children}</main>
      </div>
    </>
  );
}
