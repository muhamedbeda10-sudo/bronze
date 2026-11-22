"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { ActionResult } from "@/lib/server/result";

/** Runs a server action: shows its answer, refreshes the page's data when it worked. */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onOk?: (r: { data?: T; message?: string }) => void; onError?: (e: string) => void } = {}) =>
      new Promise<boolean>((resolve) => {
        start(async () => {
          try {
            const r = await fn();
            if (r.ok) {
              const msg = r.message ?? opts.success;
              if (msg) toast.ok(msg);
              opts.onOk?.(r);
              router.refresh();
              resolve(true);
            } else {
              toast.err(r.error);
              opts.onError?.(r.error);
              if (r.error.includes("refreshed")) router.refresh();
              resolve(false);
            }
          } catch (e) {
            console.error(e);
            toast.err("Something went wrong — check your connection and try again.");
            resolve(false);
          }
        });
      }),
    [router, toast],
  );
  return { run, pending };
}
