"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import type { AppDef, AppKey } from "@/lib/nav";

type Badge = { n: number; tone: "bad" | "brand"; title: string };

/**
 * The home screen: the apps as tiles. Typing anywhere searches the apps
 * and their pages (Enter opens the first); Ctrl+K searches the records.
 */
export function AppLauncher({ apps, badges, hello, company }: { apps: AppDef[]; badges: Partial<Record<AppKey, Badge>>; hello: string; company: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.activeElement === box.current) return;
      if (e.key.length === 1 && /\S/.test(e.key) && !(document.activeElement instanceof HTMLInputElement)) box.current?.focus();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const needle = q.trim().toLowerCase();
  const pages = useMemo(
    () => (needle ? apps.flatMap((a) => a.sections.flatMap((s) => s.links.filter((l) => l.label.toLowerCase().includes(needle) || a.label.toLowerCase().includes(needle)).map((l) => ({ app: a, link: l })))).slice(0, 8) : []),
    [apps, needle],
  );
  const shown = needle ? apps.filter((a) => a.label.toLowerCase().includes(needle) || a.desc.toLowerCase().includes(needle) || pages.some((p) => p.app.key === a.key)) : apps;

  return (
    <div className="launcher">
      <div className="launcher-inner">
        <p className="launcher-hello">{hello} · {company}</p>
        <label className="launcher-search">
          <Search size={17} aria-hidden />
          <span className="sr-only">Search apps and pages</span>
          <input
            ref={box}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { const first = pages[0]?.link.href ?? shown[0]?.home; if (first) router.push(first); }
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Search apps and pages…"
          />
        </label>
        {pages.length > 0 && (
          <div className="launcher-pages" role="list">
            {pages.map(({ app, link }) => (
              <Link key={link.href} href={link.href} role="listitem" className="dropdown-item">
                <span className="app-chip" aria-hidden><AppIcon app={app.key} size={20} /></span>
                <span style={{ flex: 1 }}>{link.label}</span>
                <span className="muted" style={{ fontSize: 12 }}>{app.label}</span>
              </Link>
            ))}
          </div>
        )}
        <nav className="launcher-grid" aria-label="Apps">
          {shown.map((a) => {
            const b = badges[a.key];
            return (
              <Link key={a.key} href={a.home} className="app-tile" title={a.desc}>
                <span className="app-tile-icon">
                  <AppIcon app={a.key} size={54} />
                  {b && b.n > 0 && <span className={`app-badge ${b.tone}`} title={b.title} aria-label={b.title}>{b.n > 99 ? "99+" : b.n}</span>}
                </span>
                <span className="app-tile-label">{a.label}</span>
              </Link>
            );
          })}
          {!shown.length && <p className="muted" style={{ gridColumn: "1 / -1", textAlign: "center" }}>No app matches “{q}”.</p>}
        </nav>
      </div>
    </div>
  );
}
