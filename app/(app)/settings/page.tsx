import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { UsersView } from "@/components/SettingsViews";
import { Notice } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { prisma } from "@/lib/db";
import { can, parseAccess } from "@/lib/domain/access";
import { SETTINGS_TABS } from "@/lib/settingsTabs";

export const metadata: Metadata = { title: "User Management" };

export default async function UsersPage() {
  const me = await pageUser("settings");
  if (!can(me.access, "settings", "F")) {
    return (<><TabLinks items={SETTINGS_TABS} active="users" label="Settings" /><Notice tone="info">Only an admin with full Settings access manages users.</Notice></>);
  }
  const [users, workshops, lastLogins] = await Promise.all([
    prisma.user.findMany({ include: { workshop: true }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.workshop.findMany({ orderBy: { code: "asc" } }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { action: "login" }, _max: { at: true } }),
  ]);
  const seen = new Map(lastLogins.map((l) => [l.userId, l._max.at?.toISOString() ?? null]));
  return (
    <>
      <TabLinks items={SETTINGS_TABS} active="users" label="Settings" />
      <UsersView
        myId={me.id}
        workshops={workshops.map((w) => ({ id: w.id, name: w.name }))}
        rows={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, access: parseAccess(u.access), workshopId: u.workshopId, workshop: u.workshop?.name ?? null, position: u.position, department: u.department, active: u.active, lastSeen: seen.get(u.id) ?? null }))}
      />
    </>
  );
}
