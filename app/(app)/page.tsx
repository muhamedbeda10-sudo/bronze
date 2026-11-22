import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppLauncher } from "@/components/AppLauncher";
import { getUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { prisma } from "@/lib/db";
import { can, visibleModules } from "@/lib/domain/access";
import { PLANT_TZ, today } from "@/lib/domain/dates";
import { appsFor, type AppKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Apps" };

/** The home screen, as Odoo's: every app the account can open, with what waits in it. */
export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!visibleModules(user.access).length) redirect("/no-access");
  const a = user.access;
  const t = today();
  const [unread, late, inspections, issues, overtime, toRelease, settings] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    can(a, "workOrders") || can(a, "planning") ? prisma.workOrder.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueDate: { lt: t } } }) : 0,
    can(a, "quality", "F") ? prisma.workOrder.count({ where: { status: "UNDER_INSPECTION" } }) : 0,
    can(a, "inventory", "F") ? prisma.issueRequest.count({ where: { status: "PENDING" } }) : 0,
    can(a, "overtime", "F") || can(a, "planning", "F") ? prisma.overtimeRequest.count({ where: { status: "PENDING", requestedById: { not: user.id } } }) : 0,
    can(a, "planning", "F") ? prisma.workOrder.count({ where: { status: "PLANNED", OR: [{ startDate: null }, { startDate: { lte: t } }] } }) : 0,
    getSettings(),
  ]);
  const badges: Partial<Record<AppKey, { n: number; tone: "bad" | "brand"; title: string }>> = {
    mywork: { n: unread, tone: "brand", title: `${unread} unread notifications` },
    manufacturing: { n: late, tone: "bad", title: `${late} late orders` },
    planning: { n: toRelease, tone: "brand", title: `${toRelease} orders ready to release` },
    quality: { n: inspections, tone: "brand", title: `${inspections} waiting for inspection` },
    inventory: { n: issues, tone: "brand", title: `${issues} issue requests to process` },
    overtime: { n: overtime, tone: "brand", title: `${overtime} overtime requests to decide` },
  };
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: PLANT_TZ, hour: "numeric", hour12: false }).format(new Date()));
  const hello = `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${user.name.split(" ")[0]}`;
  return <AppLauncher apps={appsFor(a)} badges={badges} hello={hello} company={settings.companyName} />;
}
