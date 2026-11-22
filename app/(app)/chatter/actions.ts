"use server";

import { prisma } from "@/lib/db";
import { actionUser } from "@/lib/server/auth";
import { audit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notify";
import { dbError, fail, type ActionResult } from "@/lib/server/result";
import { ALLOWED_FILE, MAX_FILE_BYTES, mentionedIds, plain } from "@/lib/domain/mentions";
import { can, parseAccess } from "@/lib/domain/access";

/** The records that carry a chatter, the module that guards each, and where it opens. */
const ENTITIES = {
  WorkOrder: { module: "workOrders" as const, link: (id: number) => `/work-orders/${id}`, name: async (id: number) => { const w = await prisma.workOrder.findUnique({ where: { id } }); return w ? `${w.woNo}-${w.lineNo}` : null; } },
};
type Entity = keyof typeof ENTITIES;
const isEntity = (e: string): e is Entity => e in ENTITIES;

export async function postComment(entity: string, entityId: number, body: string): Promise<ActionResult> {
  if (!isEntity(entity)) return fail("Unknown record.");
  const e = ENTITIES[entity];
  const user = await actionUser(e.module, "V");
  if (typeof user === "string") return fail(user);
  const text = body.trim();
  if (!text) return fail("Write something first.");
  if (text.length > 4000) return fail("The message is too long (4000 characters at most).");
  const name = await e.name(entityId);
  if (!name) return fail("The record no longer exists.");
  // a mention reaches only someone who can open the record
  const ids = mentionedIds(text);
  const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, access: true } }) : [];
  const reach = people.filter((p) => can(parseAccess(p.access), e.module, "V")).map((p) => p.id);
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({ data: { entity, entityId, userId: user.id, userName: user.name, body: text } });
      await notify(tx, reach, { kind: "mention", title: `${user.name} mentioned you on ${name}`, body: plain(text).slice(0, 200), link: e.link(entityId) }, user.id);
      await audit(tx, user, "comment", entity, entityId, `Comment on ${name}`, null, { id: c.id });
    });
  } catch (err) {
    return dbError(err, "post the message");
  }
  return { ok: true };
}

export async function uploadAttachment(entity: string, entityId: number, form: FormData): Promise<ActionResult> {
  if (!isEntity(entity)) return fail("Unknown record.");
  const e = ENTITIES[entity];
  const user = await actionUser(e.module, "E");
  if (typeof user === "string") return fail(user);
  const files = form.getAll("file").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (!files.length) return fail("Choose a file.");
  for (const f of files) {
    if (!ALLOWED_FILE.test(f.name)) return fail(`${f.name}: this type of file cannot be attached (drawings, PDFs, images, Office files, ZIP).`);
    if (f.size > MAX_FILE_BYTES) return fail(`${f.name} is larger than 10 MB.`);
    if (!f.size) return fail(`${f.name} is empty.`);
  }
  const name = await e.name(entityId);
  if (!name) return fail("The record no longer exists.");
  try {
    await prisma.$transaction(async (tx) => {
      for (const f of files) {
        const a = await tx.attachment.create({ data: { entity, entityId, fileName: f.name.slice(0, 200), mime: (f.type || "application/octet-stream").slice(0, 100), size: f.size, data: Buffer.from(await f.arrayBuffer()), uploadedById: user.id, uploadedBy: user.name } });
        await audit(tx, user, "attach", entity, entityId, `Attached ${f.name} to ${name}`, null, { attachmentId: a.id, size: f.size });
      }
    });
  } catch (err) {
    return dbError(err, "save the file");
  }
  return { ok: true, message: files.length > 1 ? `${files.length} files attached.` : "File attached." };
}

export async function deleteAttachment(id: number): Promise<ActionResult> {
  const a = await prisma.attachment.findUnique({ where: { id }, select: { id: true, entity: true, entityId: true, fileName: true, uploadedById: true } });
  if (!a || !isEntity(a.entity)) return fail("The file no longer exists.");
  const e = ENTITIES[a.entity];
  const user = await actionUser(e.module, "E");
  if (typeof user === "string") return fail(user);
  if (a.uploadedById !== user.id && !can(user.access, e.module, "F")) return fail("Only the person who attached it, or full access, can remove a file.");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await audit(tx, user, "delete", a.entity, a.entityId, `Removed the file ${a.fileName}`, { fileName: a.fileName }, null);
    });
  } catch (err) {
    return dbError(err, "remove the file");
  }
  return { ok: true, message: "File removed." };
}
