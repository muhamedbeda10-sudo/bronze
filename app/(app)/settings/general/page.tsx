import type { Metadata } from "next";
import { TabLinks } from "@/components/TabLinks";
import { GeneralForm } from "@/components/SettingsViews";
import { Notice } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { can } from "@/lib/domain/access";
import { SETTINGS_TABS } from "@/lib/settingsTabs";

export const metadata: Metadata = { title: "General Setting" };

export default async function General() {
  const me = await pageUser("settings");
  const s = await getSettings();
  return (
    <>
      <TabLinks items={SETTINGS_TABS} active="general" label="Settings" />
      {can(me.access, "settings", "F") ? <GeneralForm s={s} /> : <Notice tone="info">Only an admin with full Settings access changes these.</Notice>}
    </>
  );
}
