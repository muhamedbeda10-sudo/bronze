import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** The bell: the latest 30 notifications and how many are unread. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return NextResponse.json({ unread, items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, at: n.createdAt.toISOString() })) });
}

/** Mark read: one ({ id }) or all ({ all: true }) — only the person's own. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; all?: unknown };
  const where = body.all === true ? { userId: user.id, readAt: null } : { userId: user.id, id: Number(body.id) || -1 };
  await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
