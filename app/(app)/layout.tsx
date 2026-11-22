import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { isRole, ROLE_LABEL } from "@/lib/domain/access";
import { menusFor } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const settings = await getSettings();
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleLabel: isRole(user.role) ? ROLE_LABEL[user.role] : user.role }}
      menus={menusFor(user.access)}
      company={settings.companyName}
      logo={settings.companyLogo || undefined}
    >
      {children}
    </AppShell>
  );
}
