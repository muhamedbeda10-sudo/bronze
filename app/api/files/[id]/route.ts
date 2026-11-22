import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/server/auth";
import { can } from "@/lib/domain/access";
import { INLINE_MIME } from "@/lib/domain/mentions";

export const dynamic = "force-dynamic";

const MODULE: Record<string, "workOrders"> = { WorkOrder: "workOrders" };

/** A record's file, to whoever can open the record. PDFs and pictures show; the rest downloads. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  const id = Number((await params).id);
  const a = Number.isInteger(id) ? await prisma.attachment.findUnique({ where: { id } }) : null;
  if (!a || !MODULE[a.entity] || !can(user.access, MODULE[a.entity]!, "V")) return new NextResponse("Not found.", { status: 404 });
  const inline = INLINE_MIME.test(a.mime);
  return new NextResponse(new Uint8Array(a.data), {
    headers: {
      "Content-Type": inline ? a.mime : "application/octet-stream",
      "Content-Length": String(a.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
