import Link from "next/link";

/** The views of one place, as links: the open one underlined in bronze. */
export function TabLinks({ items, active, label }: { items: { href: string; label: string; count?: number; key: string }[]; active: string; label: string }) {
  return (
    <nav className="tab-strip no-scrollbar no-print" aria-label={label}>
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`tab ${t.key === active ? "tab-active" : ""}`} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
          {!!t.count && <span className="tab-count">{t.count > 99 ? "99+" : t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
