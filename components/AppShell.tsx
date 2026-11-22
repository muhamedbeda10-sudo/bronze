"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Bell, Boxes, CalendarDays, ChartGantt, CheckCheck, ChevronDown, ClipboardCheck, ClipboardList, Clock, Database, Factory, FileBarChart, Gauge, Grid3x3, Hammer, History,
  Home, Kanban, LayoutList, ListOrdered, LogOut, Menu, Moon, Plus, Search, Settings, Sun, Tablet, Truck, Users, BookOpen, X, type LucideIcon,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { locate, type AppDef, type IconName, type NavSection } from "@/lib/nav";
import { initials } from "@/lib/format";
import { signOutAction } from "@/app/actions";

export const ICONS: Record<IconName, LucideIcon> = {
  home: Home, orders: ClipboardList, plus: Plus, board: Factory, queue: ListOrdered, calendar: CalendarDays, gauge: Gauge, bell: Bell, hammer: Hammer, history: History,
  list: LayoutList, tablet: Tablet, check: ClipboardCheck, boxes: Boxes, truck: Truck, ledger: BookOpen, clock: Clock, chart: BarChart3, report: FileBarChart, db: Database,
  users: Users, settings: Settings, kanban: Kanban, gantt: ChartGantt,
};

export interface ShellUser { name: string; roleLabel: string; email: string }

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

/** The links of one or more sections, as a menu's rows. */
function SectionLinks({ sections, current, onPick }: { sections: NavSection[]; current: string | null; onPick: () => void }) {
  return (
    <>
      {sections.map((s, i) => (
        <div key={i}>
          {i > 0 && <div className="dropdown-sep" />}
          {s.label && <div className="dropdown-head">{s.label}</div>}
          {s.links.map((l, j) => {
            const I = ICONS[l.icon];
            // a subheading where a group starts (Reporting: Analytics · Reports · History)
            const head = l.group && l.group !== s.links[j - 1]?.group;
            return (
              <Fragment key={l.href}>
                {head && j > 0 && <div className="dropdown-sep" />}
                {head && <div className="dropdown-head dropdown-subhead">{l.group}</div>}
                <Link href={l.href} className={`dropdown-item ${current === l.href ? "on" : ""}`} onClick={onPick} role="menuitem">
                  <I size={16} className="di-icon" aria-hidden />
                  <span style={{ flex: 1 }}>{l.label}</span>
                  {l.hint && <span className="muted" style={{ fontSize: 11 }}>{l.hint}</span>}
                </Link>
              </Fragment>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** A labelled section of the current app: a dropdown on the bar. */
function SectionMenu({ section, current }: { section: NavSection; current: string | null }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  const on = section.links.some((l) => l.href === current);
  return (
    <div ref={ref} style={{ position: "relative", height: "100%" }}>
      <button type="button" className={`menu-btn ${on ? "on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {section.label} <ChevronDown size={14} aria-hidden style={{ opacity: 0.7 }} />
      </button>
      {open && <div className="dropdown" role="menu" style={{ top: "calc(100% + 4px)", insetInlineStart: 0, minWidth: 250 }}><SectionLinks sections={[{ links: section.links }]} current={current} onPick={close} /></div>}
    </div>
  );
}

/** Inside an app, its menus only: a labelled section is a dropdown, the others' links sit on the bar. */
function AppMenus({ app, current }: { app: AppDef; current: string | null }) {
  if (app.key === "mywork") return null;
  return (
    <>
      {app.sections.map((s, i) =>
        s.label ? (
          <SectionMenu key={i} section={s} current={current} />
        ) : (
          s.links.map((l) => <Link key={l.href} href={l.href} className={`menu-btn ${current === l.href ? "on" : ""}`}>{l.label}</Link>)
        ),
      )}
    </>
  );
}

type Note = { id: number; kind: string; title: string; body: string | null; link: string; read: boolean; at: string };

function since(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

function Bell_() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Note[] }>({ unread: 0, items: [] });
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);
  useEffect(() => {
    // the first fetch on mount; its setState runs after the response, not during the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 60_000);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [load]);
  async function mark(body: object) {
    await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="bar-btn" aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`} aria-expanded={open} onClick={() => { setOpen((v) => !v); if (!open) load(); }}>
        <Bell size={18} aria-hidden />
        {data.unread > 0 && <span className="dot-count">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ top: 42, insetInlineEnd: 0, width: 380, maxWidth: "calc(100vw - 20px)", padding: 0 }}>
          <div className="flex items-center justify-between" style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <b>Notifications</b>
            {data.unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => mark({ all: true })}><CheckCheck size={14} aria-hidden /> Mark all read</button>}
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto", padding: 6 }}>
            {!data.items.length && <p className="muted" style={{ textAlign: "center", padding: 24, margin: 0 }}>You are all caught up.</p>}
            {data.items.map((n) => (
              <button key={n.id} type="button" className="dropdown-item" style={{ whiteSpace: "normal", alignItems: "flex-start" }} onClick={() => { if (!n.read) mark({ id: n.id }); setOpen(false); router.push(n.link); }}>
                <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 99, flex: "none", background: n.read ? "transparent" : "var(--brand)" }} aria-hidden />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: n.read ? 400 : 600, fontSize: 13 }}>{n.title}</span>
                  {n.body && <span className="muted" style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{n.body}</span>}
                </span>
                <span className="muted" style={{ fontSize: 11, flex: "none" }}>{since(n.at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Hit = { group: string; label: string; sub: string; href: string };

/** Ctrl+K: records and pages from anywhere. */
function Palette({ apps, onClose }: { apps: AppDef[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const pages: Hit[] = apps.flatMap((a) => a.sections.flatMap((s) => s.links.map((l) => ({ group: "Pages", label: l.label, sub: a.label, href: l.href }))));
  const needle = q.trim().toLowerCase();
  const pageHits = needle ? pages.filter((p) => p.label.toLowerCase().includes(needle) || p.sub.toLowerCase().includes(needle)).slice(0, 6) : pages.slice(0, 8);
  const shownHits = needle.length >= 2 ? hits : [];
  const all = [...shownHits, ...pageHits];

  useEffect(() => {
    if (needle.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(needle)}`, { signal: ctl.signal });
        if (r.ok) { setHits((await r.json()).results); setActive(0); }
      } catch {}
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [needle]);

  const go = (h?: Hit) => { if (!h) return; onClose(); router.push(h.href); };
  let lastGroup = "";
  return (
    <div className="palette-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Search size={18} className="muted" aria-hidden />
          <input
            autoFocus
            value={q}
            placeholder="Search work orders, materials, machines, pages…"
            aria-label="Search"
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(all.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") go(all[active]);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" role="listbox">
          {!all.length && <p className="muted" style={{ textAlign: "center", padding: 20, margin: 0 }}>Nothing matches “{q}”.</p>}
          {all.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <div key={`${h.group}-${h.href}-${i}`}>
                {head && <div className="dropdown-head">{head}</div>}
                <button type="button" role="option" aria-selected={i === active} data-active={i === active ? "" : undefined} className="dropdown-item" onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{h.label}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{h.sub}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd> <kbd>K</kbd> anywhere</span></div>
      </div>
    </div>
  );
}

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
}

/** The breadcrumb: app / place; a record page adds its own name (components/Cpanel.tsx). */
function Crumbs({ apps, pathname, search, company }: { apps: AppDef[]; pathname: string; search: string; company: string }) {
  const here = locate(apps, pathname, search);
  const single = here && here.app.sections.flatMap((s) => s.links).length === 1;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {here && !single ? (
        <>
          <Link href={here.app.home} className="hidden sm:inline" style={{ color: "var(--muted)" }}>{here.app.label}</Link>
          <span className="sep hidden sm:inline">/</span>
          <span id="crumb-trail" className="contents"><h1 data-default-title>{here.link.label}</h1></span>
        </>
      ) : (
        <span id="crumb-trail" className="contents"><h1 data-default-title>{here ? here.link.label : company}</h1></span>
      )}
    </nav>
  );
}

/** The query names the place on a few pages (the reports): read it here, so the rest of the shell does not wait for it. */
function CrumbsWithSearch(p: { apps: AppDef[]; pathname: string; company: string }) {
  return <Crumbs {...p} search={useSearchParams().toString()} />;
}

export function AppShell({ user, apps, company, logo, children }: { user: ShellUser; apps: AppDef[]; company: string; logo?: string; children: ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const here = locate(apps, pathname, "");
  const current = here?.link.href ?? null;
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const closeAccount = useCallback(() => setAccount(false), []);
  const accRef = useOutside(account, closeAccount);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  return (
    <>
      <header className={`appbar no-print ${home ? "appbar-home" : ""}`}>
        {!home && <button type="button" className="bar-btn lg:hidden" onClick={() => setDrawer(true)} aria-label="Open the menu"><Menu size={20} /></button>}
        <Link href="/" className="bar-btn home-btn" aria-label="All apps" title="All apps"><Grid3x3 size={19} aria-hidden /></Link>
        {home || !here ? (
          <Link href="/" className="appbar-brand" aria-label={company}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo ? <img src={logo} alt="" className="brand-mark" style={{ objectFit: "contain", background: "#fff", padding: 2 }} /> : <span className="brand-mark" aria-hidden>LB</span>}
            <span className="brand-word">LOTFY BRONZE</span>
          </Link>
        ) : (
          <Link href={here.app.home} className="appbar-app" title={here.app.desc}>
            <span className="app-chip" aria-hidden><AppIcon app={here.app.key} size={22} /></span>
            <span>{here.app.label}</span>
          </Link>
        )}
        {!home && here && <nav className="appbar-nav no-scrollbar hidden lg:flex" aria-label={`${here.app.label} menu`}><AppMenus app={here.app} current={current} /></nav>}
        <div className="appbar-tools">
          <button type="button" className="bar-search hidden xl:flex" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)">
            <Search size={15} aria-hidden /> Search <kbd>Ctrl K</kbd>
          </button>
          <button type="button" className="bar-btn xl:hidden" onClick={() => setPalette(true)} aria-label="Search (Ctrl+K)"><Search size={18} /></button>
          <Bell_ />
          <button type="button" className="bar-btn" onClick={toggleTheme} title="Light / dark" aria-label="Toggle dark mode">
            <Moon size={18} className="dark:hidden" aria-hidden />
            <Sun size={18} className="hidden dark:block" aria-hidden />
          </button>
          <div ref={accRef} style={{ position: "relative", marginInlineStart: 4 }}>
            <button type="button" className="bar-btn" style={{ width: "auto", padding: "0 4px" }} onClick={() => setAccount((v) => !v)} aria-haspopup="menu" aria-expanded={account} aria-label="Account">
              <span className="avatar">{initials(user.name)}</span>
            </button>
            {account && (
              <div role="menu" className="dropdown" style={{ insetInlineEnd: 0, top: 42, width: 250 }}>
                <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{user.roleLabel}</div>
                  <div className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{user.email}</div>
                </div>
                <form action={signOutAction}>
                  <button type="submit" role="menuitem" className="dropdown-item"><LogOut size={16} className="di-icon" aria-hidden /> Sign out</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {!home && (
        <div className="cpanel no-print">
          <div className="cpanel-row">
            <Suspense fallback={<Crumbs apps={apps} pathname={pathname} search="" company={company} />}>
              <CrumbsWithSearch apps={apps} pathname={pathname} company={company} />
            </Suspense>
            <div id="cpanel-actions" className="flex flex-wrap items-center gap-2" style={{ marginInlineStart: "auto" }} />
          </div>
        </div>
      )}

      {drawer && here && (
        <>
          <div className="drawer-back" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={`${here.app.label} menu`}>
            <div className="flex items-center justify-between" style={{ padding: "10px 12px", background: "var(--bar-bg)", color: "#fff" }}>
              <span className="flex items-center gap-2" style={{ fontWeight: 600 }}><span className="app-chip" aria-hidden><AppIcon app={here.app.key} size={22} /></span>{here.app.label}</span>
              <button type="button" className="bar-btn" onClick={() => setDrawer(false)} aria-label="Close the menu"><X size={20} /></button>
            </div>
            <div style={{ padding: 8 }}>
              <SectionLinks sections={here.app.sections} current={current} onPick={() => setDrawer(false)} />
              <div className="dropdown-sep" />
              <Link href="/" className="dropdown-item" onClick={() => setDrawer(false)}><Grid3x3 size={16} className="di-icon" aria-hidden /> All apps</Link>
            </div>
          </div>
        </>
      )}

      {palette && <Palette apps={apps} onClose={() => setPalette(false)} />}

      {home ? children : <main className="page" id="main">{children}</main>}
    </>
  );
}
