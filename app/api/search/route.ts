import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/server/auth";
import { can } from "@/lib/domain/access";
import { statusLabel } from "@/lib/domain/status";

export const dynamic = "force-dynamic";

/** The command palette: records matching a few letters, only of what the account can see. */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const has = { contains: q, mode: "insensitive" as const };
  const a = user.access;
  const [orders, materials, machines, operators, molds] = await Promise.all([
    can(a, "workOrders") ? prisma.workOrder.findMany({ where: { OR: [{ fullName: has }, { woNo: has }] }, take: 8, orderBy: [{ woDate: "desc" }], select: { id: true, fullName: true, status: true } }) : [],
    can(a, "masterData") || can(a, "inventory") ? prisma.material.findMany({ where: { OR: [{ code: has }, { name: has }] }, take: 5 }) : [],
    can(a, "masterData") ? prisma.machine.findMany({ where: { OR: [{ code: has }, { name: has }] }, take: 5, include: { workshop: true } }) : [],
    can(a, "masterData") ? prisma.operator.findMany({ where: { OR: [{ code: has }, { name: has }] }, take: 5 }) : [],
    can(a, "masterData") ? prisma.mold.findMany({ where: { OR: [{ moldNo: has }, { description: has }] }, take: 5 }) : [],
  ]);
  return NextResponse.json({
    results: [
      ...orders.map((o) => ({ group: "Work orders", label: o.fullName, sub: statusLabel(o.status), href: `/work-orders/${o.id}` })),
      ...materials.map((m) => ({ group: "Materials", label: `${m.code} — ${m.name}`, sub: `${m.density} g/cm³`, href: can(a, "inventory") ? `/inventory/raw` : `/master/materials` })),
      ...machines.map((m) => ({ group: "Machines", label: `${m.code} — ${m.name}`, sub: m.workshop.name, href: `/master/machines` })),
      ...operators.map((o) => ({ group: "Operators", label: `${o.code} — ${o.name}`, sub: "", href: `/master/operators` })),
      ...molds.map((m) => ({ group: "Molds", label: m.moldNo, sub: m.description ?? "", href: `/master/molds` })),
    ],
  });
}
