// Shop-floor confirmation at the kiosk: who may start and finish a stage.
//   Planning (full) or Workshop Execution (full): any stage.
//   Workshop Execution (enter & edit): the stages of their own workshop only.
// A quality stage is never finished from the floor — Quality passes it.

import { can, type Access } from "./access";

export function canConfirmStage(access: Access, ownWorkshopId: number | null, stageWorkshopId: number | null, stageIsQc: boolean): boolean {
  if (stageIsQc) return false;
  if (can(access, "planning", "F") || can(access, "workshop", "F")) return true;
  return can(access, "workshop", "E") && ownWorkshopId !== null && ownWorkshopId === stageWorkshopId;
}

/** "14444-1", "14444 1", "WO 14444-1" or a kiosk QR address → what to look up. */
export function parseScan(raw: string): { id: number } | { woNo: string; lineNo: number } | null {
  const s = raw.trim();
  const url = /\/floor\/wo\/(\d{1,9})(?:[/?#]|$)/.exec(s);
  if (url) return { id: Number(url[1]) };
  const code = /^(?:wo\s*)?([A-Za-z0-9][A-Za-z0-9_/.-]*?)[-\s](\d{1,3})$/i.exec(s);
  if (code) return { woNo: code[1]!, lineNo: Number(code[2]) };
  const bare = /^(?:wo\s*)?([A-Za-z0-9][A-Za-z0-9_/.-]*)$/i.exec(s);
  return bare ? { woNo: bare[1]!, lineNo: 1 } : null;
}
