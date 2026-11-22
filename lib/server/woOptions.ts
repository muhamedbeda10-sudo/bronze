import "server-only";
import { prisma } from "@/lib/db";
import { getSettings } from "./settings";
import type { WoOptions } from "@/components/WoForm";

/** What the order form picks from, as plain data. */
export async function woOptions(): Promise<WoOptions> {
  const [products, materials, processes, molds, stages, raw, settings] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.material.findMany({ where: { status: "Active" }, orderBy: { code: "asc" } }),
    prisma.process.findMany({ orderBy: { code: "asc" } }),
    prisma.mold.findMany({ orderBy: { moldNo: "asc" } }),
    prisma.routeStage.findMany({ orderBy: [{ routeCode: "asc" }, { stageNo: "asc" }] }),
    prisma.stockRow.groupBy({ by: ["materialId"], where: { kind: "RAW" }, _sum: { totalQty: true, reservedQty: true } }),
    getSettings(),
  ]);
  const avail = new Map(raw.map((r) => [r.materialId, (r._sum.totalQty ?? 0) - (r._sum.reservedQty ?? 0)]));
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, format: p.dimensionFormat })),
    materials: materials.map((m) => ({ id: m.id, code: m.code, name: m.name, density: m.density, availableKg: avail.has(m.id) ? Math.round(avail.get(m.id)! * 10) / 10 : null })),
    processes: processes.map((p) => ({ id: p.id, code: p.code, name: p.name, stages: stages.filter((s) => s.routeCode === p.routeCode).map((s) => s.name) })),
    molds: molds.map((m) => ({ id: m.id, moldNo: m.moldNo, productId: m.productId, processId: m.processId, approxWeightKg: m.approxWeightKg, available: m.available })),
    allowancePct: settings.rawAllowancePct,
    defaultDensity: settings.defaultDensity,
  };
}
