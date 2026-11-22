"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Notice } from "@/components/ui";

type ToastItem = { id: number; tone: "ok" | "bad" | "warn" | "info"; text: string };
type Api = { ok: (t: string) => void; err: (t: string) => void; warn: (t: string) => void; info: (t: string) => void };

const Ctx = createContext<Api | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastItem["tone"], text: string) => {
    const id = ++seq;
    setItems((xs) => [...xs.slice(-3), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "bad" ? 7000 : 3500);
  }, []);
  const api = useMemo<Api>(() => ({ ok: (t) => push("ok", t), err: (t) => push("bad", t), warn: (t) => push("warn", t), info: (t) => push("info", t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast"><Notice tone={t.tone}>{t.text}</Notice></div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast outside ToastProvider");
  return v;
}
