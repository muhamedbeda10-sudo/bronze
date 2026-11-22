import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { readSettings, type AppSettings } from "@/lib/domain/settings";

export const getSettings = cache(async (): Promise<AppSettings> => readSettings(await prisma.setting.findMany()));
