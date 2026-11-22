"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** The shell's slot of that id, once the page is in the browser. */
function useSlot(id: string): HTMLElement | null {
  return useSyncExternalStore(noop, () => document.getElementById(id), () => null);
}

/** Put a page's buttons in the control panel under the app bar. */
export function CpanelActions({ children }: { children: ReactNode }) {
  const el = useSlot("cpanel-actions");
  return el ? createPortal(children, el) : null;
}

/**
 * Lengthen the breadcrumb: the list becomes a link and the record's name is
 * the page's title (Work Orders / 14444-1). The shell's own title hides
 * itself while this is there (`.crumb-custom` in globals.css).
 */
export function Crumb({ parent, title }: { parent?: { href: string; label: string }; title: string }) {
  const el = useSlot("crumb-trail");
  if (!el) return null;
  return createPortal(
    <span className="crumb-custom contents">
      {parent && <><Link href={parent.href}>{parent.label}</Link><span className="sep">/</span></>}
      <h1>{title}</h1>
    </span>,
    el,
  );
}
