import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { refMap, type RefMaps } from "@/lib/domain/master";

/** The lists every form picks from — loaded once per request. */
export const loadLists = cache(async () => {
  const [materials, products, processes, workshops, operators, machines, reasons, molds] = await Promise.all([
    prisma.material.findMany({ orderBy: { code: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.process.findMany({ orderBy: { code: "asc" } }),
    prisma.workshop.findMany({ orderBy: { code: "asc" } }),
    prisma.operator.findMany({ orderBy: { name: "asc" } }),
    prisma.machine.findMany({ orderBy: { code: "asc" } }),
    prisma.rejectionReason.findMany({ orderBy: { code: "asc" } }),
    prisma.mold.findMany({ orderBy: { moldNo: "asc" } }),
  ]);
  return { materials, products, processes, workshops, operators, machines, reasons, molds };
});

/** id ↔ code of every reference a master-data row can point at. */
export async function loadRefMaps(): Promise<RefMaps> {
  const l = await loadLists();
  return {
    material: refMap(l.materials.map((m) => ({ id: m.id, code: m.code }))),
    product: refMap(l.products.map((p) => ({ id: p.id, code: p.name }))),
    process: refMap(l.processes.map((p) => ({ id: p.id, code: p.code }))),
    workshop: refMap(l.workshops.map((w) => ({ id: w.id, code: w.code }))),
    operator: refMap(l.operators.map((o) => ({ id: o.id, code: o.code }))),
  };
}

/** Options for a select, as plain data a client component can take. */
export type Option = { value: string; label: string };
export async function refOptions(): Promise<Record<string, Option[]>> {
  const l = await loadLists();
  return {
    material: l.materials.map((m) => ({ value: String(m.id), label: `${m.code} — ${m.name}` })),
    product: l.products.map((p) => ({ value: String(p.id), label: p.name })),
    process: l.processes.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` })),
    workshop: l.workshops.map((w) => ({ value: String(w.id), label: `${w.code} — ${w.name}` })),
    operator: l.operators.map((o) => ({ value: String(o.id), label: `${o.code} — ${o.name}` })),
  };
}
