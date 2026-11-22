import "server-only";
import { prisma } from "@/lib/db";

const TABS = [
  { key: "exec", href: "/planning", label: "Work Order Execution" },
  { key: "workshop", href: "/planning/workshop", label: "Open Order – Workshop" },
  { key: "weekly", href: "/planning/weekly", label: "Weekly Production Plan" },
  { key: "capacity", href: "/planning/capacity", label: "Capacity" },
  { key: "notifications", href: "/planning/notifications", label: "Planning Notification" },
];

/** The planning tabs, the notifications one counting the overtime waiting for a decision. */
export async function planningTabs() {
  const pending = await prisma.overtimeRequest.count({ where: { status: "PENDING" } });
  return TABS.map((t) => (t.key === "notifications" ? { ...t, count: pending } : t));
}
