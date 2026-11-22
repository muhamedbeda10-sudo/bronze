import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/FilterBar";
import { IssueRequests, StockLedger, StockView, type StockOptions } from "@/components/StockViews";
import { PrintHead } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { loadLists } from "@/lib/server/refs";
import { periodOf } from "@/lib/server/period";
import { prisma } from "@/lib/db";
import { can } from "@/lib/domain/access";
import { addDays, dayKey, fmtDay } from "@/lib/domain/dates";
import { STOCK_FIELDS, STOCK_SLUG } from "@/lib/domain/stock";
import { STOCK_KIND_LABEL } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Inventory" };

const TABS = [
  { key: "raw", href: "/inventory/raw", label: "Raw Materials" },
  { key: "fg", href: "/inventory/fg", label: "FG Products" },
  { key: "wip", href: "/inventory/wip", label: "WIP Product" },
  { key: "wip-raw", href: "/inventory/wip-raw", label: "WIP Raw Material" },
  { key: "issues", href: "/inventory/issues", label: "Issue Request" },
  { key: "ledger", href: "/inventory/ledger", label: "Stock Ledger" },
];

export default async function InventoryTab({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tab } = await params;
  if (!TABS.some((t) => t.key === tab)) notFound();
  const user = await pageUser("inventory");
  const lists = await loadLists();
  const openOrders = await prisma.workOrder.findMany({ where: { status: { notIn: ["CANCELLED"] } }, select: { id: true, woNo: true, lineNo: true, status: true }, orderBy: [{ woNo: "desc" }, { lineNo: "asc" }] });
  const options: StockOptions = {
    material: lists.materials.map((m) => ({ value: String(m.id), label: `${m.code} — ${m.name}` })),
    product: lists.products.map((p) => ({ value: String(p.id), label: p.name })),
    workshop: lists.workshops.map((w) => ({ value: String(w.id), label: w.name })),
    order: openOrders.map((o) => ({ value: String(o.id), label: `${o.woNo}-${o.lineNo}` })),
  };

  if (tab === "issues") {
    const [rows, raw] = await Promise.all([
      prisma.issueRequest.findMany({ include: { material: true, workshop: true, workOrder: true }, orderBy: [{ status: "desc" }, { date: "desc" }, { id: "desc" }], take: 1000 }),
      prisma.stockRow.groupBy({ by: ["materialId"], where: { kind: "RAW" }, _sum: { totalQty: true } }),
    ]);
    const onHand = new Map(raw.map((r) => [r.materialId, r._sum.totalQty ?? 0]));
    return (
      <>
        <PrintHead title="Issue Requests" />
        <IssueRequests
          options={options}
          canRequest={can(user.access, "inventory", "E")}
          canProcess={can(user.access, "inventory", "F")}
          ownWorkshop={can(user.access, "inventory", "F") ? null : user.workshopId}
          rows={rows.sort((a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING")).map((r) => ({
            id: r.id, reqNo: r.reqNo, date: dayKey(r.date), material: `${r.material.code} — ${r.material.name}`, qtyKg: r.qtyKg, workshop: r.workshop.name,
            wo: r.workOrder ? `${r.workOrder.woNo}-${r.workOrder.lineNo}` : null, woId: r.workOrderId, status: r.status, requestedBy: r.requestedBy,
            processedBy: r.processedBy, processedAt: r.processedAt?.toISOString() ?? null, note: r.note, availableKg: onHand.get(r.materialId) ?? 0,
          }))}
        />
      </>
    );
  }

  if (tab === "ledger") {
    const sp = await searchParams;
    const p = periodOf(sp, 30);
    const moves = await prisma.stockMove.findMany({ where: { at: { gte: p.from, lt: addDays(p.to, 1) } }, include: { stockRow: { include: { material: true, product: true, workshop: true } } }, orderBy: { at: "desc" }, take: 3000 });
    return (
      <>
        <PrintHead title="Stock Ledger" sub={`${fmtDay(p.from)} – ${fmtDay(p.to)}`} />
        <FilterBar defaults={p.defaults} filters={[{ key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }]} />
        <StockLedger rows={moves.map((m) => ({
          id: m.id, at: m.at.toISOString(), kind: m.stockRow.kind, unit: m.stockRow.unit, delta: m.delta, reason: m.reason, ref: m.ref, userName: m.userName,
          item: m.stockRow.description ?? [m.stockRow.material?.name, m.stockRow.product?.name, m.stockRow.workshop?.name].filter(Boolean).join(" · "),
        }))} />
      </>
    );
  }

  const kind = STOCK_SLUG[tab]!;
  const rows = await prisma.stockRow.findMany({ where: { kind }, include: { material: true, product: true, workshop: true, workOrder: true }, orderBy: [{ updatedAt: "desc" }] });
  return (
    <>
      <PrintHead title={STOCK_KIND_LABEL[kind]} />
      {kind === "RAW" && <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>Before releasing an order, check that Available covers its Raw Material Req (+allowance).</p>}
      <StockView
        kind={kind}
        canEdit={can(user.access, "inventory", "F")}
        options={options}
        rows={rows.map((r) => ({
          id: r.id,
          version: r.version,
          totalQty: r.totalQty,
          reservedQty: r.reservedQty,
          unit: r.unit,
          values: Object.fromEntries(STOCK_FIELDS[kind].map((f) => [f.key, (r as unknown as Record<string, string | number | null>)[f.key] ?? null])),
          labels: {
            materialId: r.material ? `${r.material.code} — ${r.material.name}` : "",
            productId: r.product?.name ?? "",
            workshopId: r.workshop?.name ?? "",
            workOrderId: r.workOrder ? `${r.workOrder.woNo}-${r.workOrder.lineNo}` : "",
          },
        }))}
      />
    </>
  );
}
