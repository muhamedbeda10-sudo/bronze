import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { isRole, ROLE_LABEL, visibleModules } from "@/lib/domain/access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const settings = await getSettings();
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleLabel: isRole(user.role) ? ROLE_LABEL[user.role] : user.role }}
      visible={visibleModules(user.access)}
      company={settings.companyName}
      logo={settings.companyLogo || undefined}
    >
      {children}
    </AppShell>
  );
}
