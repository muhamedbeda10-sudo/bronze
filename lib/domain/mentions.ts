// Mentions in a comment are written @[Name](userId): the name shows, the id notifies.

const RE = /@\[([^\]\n]{1,80})\]\((\d{1,9})\)/g;

export function mentionedIds(body: string): number[] {
  return [...new Set([...body.matchAll(RE)].map((m) => Number(m[2])))];
}

export type Part = { text: string } | { mention: string; id: number };

/** The body as text and mentions, for drawing without HTML. */
export function parts(body: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of body.matchAll(RE)) {
    if (m.index! > last) out.push({ text: body.slice(last, m.index) });
    out.push({ mention: m[1]!, id: Number(m[2]) });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}

/** The body as plain text (a notification's preview). */
export const plain = (body: string) => body.replace(RE, "@$1");

/** Files people may attach: drawings, documents, photos — never something a browser would run. */
export const ALLOWED_FILE = /\.(pdf|png|jpe?g|webp|gif|dwg|dxf|step|stp|igs|iges|xlsx?|csv|docx?|txt|zip)$/i;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Shown in the browser; everything else is downloaded. */
export const INLINE_MIME = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/;
