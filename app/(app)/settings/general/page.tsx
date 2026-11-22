import type { Metadata } from "next";
import { GeneralForm } from "@/components/SettingsViews";
import { Notice } from "@/components/ui";
import { pageUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { can } from "@/lib/domain/access";

export const metadata: Metadata = { title: "General Setting" };

export default async function General() {
  const me = await pageUser("settings");
  const s = await getSettings();
  return (
    <>
      {can(me.access, "settings", "F") ? <GeneralForm s={s} /> : <Notice tone="info">Only an admin with full Settings access changes these.</Notice>}
    </>
  );
}
