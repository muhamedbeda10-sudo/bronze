import type { Metadata } from "next";
import { ExecutionBoard } from "@/components/ExecutionBoard";
import { pageUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/woQueries";
import { loadLists } from "@/lib/server/refs";
import { can } from "@/lib/domain/access";
import { addDays, today } from "@/lib/domain/dates";
import { availableActions } from "@/lib/domain/routing";
import type { WoStatus } from "@/lib/domain/status";

export const metadata: Metadata = { title: "Work Order Execution" };

export default async function Execution() {
  const user = await pageUser("planning");
  // open orders, and those completed in the last two weeks
  const [rows, lists] = await Promise.all([
    listOrders({ OR: [{ status: { notIn: ["COMPLETED", "CANCELLED"] } }, { status: "COMPLETED", completedAt: { gte: addDays(today(), -14) } }] }),
    loadLists(),
  ]);
  const exec = rows
    .map((r) => ({ ...r, actions: availableActions({ status: r.status as WoStatus, stageIndex: r.stageIndex, stageState: r.stageState as "WAITING" | "IN_PROGRESS" | null, heldFrom: null }, r.stages.map((s) => ({ name: s.name, qcRequired: s.qc }))) }))
    .sort((a, b) => b.priority - a.priority || (a.dueDate || "9").localeCompare(b.dueDate || "9"));
  return (
    <>
      <ExecutionBoard rows={exec} workshops={lists.workshops.map((w) => ({ id: w.id, name: w.name }))} canAct={can(user.access, "planning", "F")} />
    </>
  );
}
