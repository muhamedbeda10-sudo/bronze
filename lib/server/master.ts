import "server-only";
import { prisma, type Tx } from "@/lib/db";
import type { MasterEntity, ParsedRow } from "@/lib/domain/master";

/** The Prisma model behind each Master Data tab. */
export const MODEL: Record<MasterEntity, string> = {
  materials: "material",
  products: "product",
  workshops: "workshop",
  processes: "process",
  routing: "routeStage",
  machines: "machine",
  molds: "mold",
  operators: "operator",
  "rejection-reasons": "rejectionReason",
};

export const ENTITY_NAME: Record<MasterEntity, string> = {
  materials: "Material",
  products: "Product",
  workshops: "Workshop",
  processes: "Process",
  routing: "RouteStage",
  machines: "Machine",
  molds: "Mold",
  operators: "Operator",
  "rejection-reasons": "RejectionReason",
};

const ORDER: Record<MasterEntity, unknown> = {
  materials: { code: "asc" },
  products: { name: "asc" },
  workshops: { code: "asc" },
  processes: { code: "asc" },
  routing: [{ routeCode: "asc" }, { stageNo: "asc" }],
  machines: { code: "asc" },
  molds: { moldNo: "asc" },
  operators: { code: "asc" },
  "rejection-reasons": { code: "asc" },
};

/** The handful of calls the generic screens make on any of the models. */
interface Delegate {
  findMany(a?: unknown): Promise<Record<string, unknown>[]>;
  findUnique(a: unknown): Promise<Record<string, unknown> | null>;
  findFirst(a: unknown): Promise<Record<string, unknown> | null>;
  create(a: unknown): Promise<Record<string, unknown>>;
  update(a: unknown): Promise<Record<string, unknown>>;
  delete(a: unknown): Promise<Record<string, unknown>>;
}

export function delegate(tab: MasterEntity, tx: Tx | typeof prisma = prisma): Delegate {
  return (tx as unknown as Record<string, Delegate>)[MODEL[tab]];
}

export async function listMaster(tab: MasterEntity): Promise<Record<string, unknown>[]> {
  return delegate(tab).findMany({ orderBy: ORDER[tab] });
}

/** Find the row an imported line means: same key fields. */
export function keyWhere(tab: MasterEntity, keyFields: string[], data: ParsedRow): Record<string, unknown> {
  return Object.fromEntries(keyFields.map((k) => [k, data[k]]));
}
