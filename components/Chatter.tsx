"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, FileText, Paperclip, Send, Trash2 } from "lucide-react";
import { Confirm } from "@/components/Modal";
import { useAction } from "@/components/useAction";
import { fmtInstant } from "@/lib/domain/dates";
import { parts } from "@/lib/domain/mentions";
import { initials } from "@/lib/format";
import { deleteAttachment, postComment, uploadAttachment } from "@/app/(app)/chatter/actions";

export type ChatItem =
  | { kind: "comment"; id: string; at: string; who: string; body: string }
  | { kind: "file"; id: string; at: string; who: string; fileId: number; fileName: string; size: number; mine: boolean }
  | { kind: "log"; id: string; at: string; who: string; text: string };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * The record's conversation, files and history in one timeline (the
 * Odoo / Dynamics chatter). Type @ to mention someone: they are notified.
 */
export function Chatter({ entity, entityId, items, people, canAttach, canDeleteAny }: { entity: string; entityId: number; items: ChatItem[]; people: { id: number; name: string }[]; canAttach: boolean; canDeleteAny: boolean }) {
  const { run, pending } = useAction();
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<{ id: number; name: string }[]>([]);
  const [mention, setMention] = useState<{ q: string; at: number } | null>(null);
  const [del, setDel] = useState<{ id: number; name: string } | null>(null);
  const [show, setShow] = useState<"all" | "messages" | "files">("all");
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => (mention ? people.filter((p) => p.name.toLowerCase().includes(mention.q.toLowerCase())).slice(0, 6) : []), [mention, people]);

  function onType(v: string, caret: number) {
    setBody(v);
    const m = /@([\p{L}\p{N} ]{0,20})$/u.exec(v.slice(0, caret));
    setMention(m && !/\s{2}/.test(m[1]!) ? { q: m[1]!, at: caret - m[0].length } : null);
  }
  function pick(p: { id: number; name: string }) {
    if (!mention) return;
    const caret = box.current?.selectionStart ?? body.length;
    setBody(`${body.slice(0, mention.at)}@${p.name} ${body.slice(caret)}`);
    setPicked((xs) => (xs.some((x) => x.id === p.id) ? xs : [...xs, p]));
    setMention(null);
    box.current?.focus();
  }

  async function send() {
    if (!body.trim()) return;
    // the box reads @Name; each picked name still in it is sent as @[Name](id), so it notifies
    let out = body;
    for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) out = out.split(`@${p.name}`).join(`@[${p.name}](${p.id})`);
    const ok = await run(() => postComment(entity, entityId, out));
    if (ok) { setBody(""); setPicked([]); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    await run(() => uploadAttachment(entity, entityId, fd), {});
    if (file.current) file.current.value = "";
  }

  const list = items.filter((i) => show === "all" || (show === "messages" ? i.kind === "comment" : i.kind === "file"));

  return (
    <aside className="chatter" aria-label="Conversation and history">
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <h2 className="card-title">Activity</h2>
        <div className="seg" role="group" aria-label="Show">
          {(["all", "messages", "files"] as const).map((k) => <button key={k} type="button" className={show === k ? "on" : ""} aria-pressed={show === k} onClick={() => setShow(k)}>{k[0]!.toUpperCase() + k.slice(1)}</button>)}
        </div>
      </div>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <textarea
          ref={box}
          className="textarea"
          rows={3}
          value={body}
          aria-label="Message"
          placeholder="Write a message… type @ to mention someone"
          onChange={(e) => onType(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={(e) => {
            if (mention && matches.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pick(matches[0]!); }
            else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
            else if (e.key === "Escape") setMention(null);
          }}
        />
        {mention && matches.length > 0 && (
          <div className="dropdown" role="listbox" style={{ position: "absolute", insetInlineStart: 14, top: 96, minWidth: 220 }}>
            {matches.map((p) => <button key={p.id} type="button" role="option" aria-selected={false} className="dropdown-item" onMouseDown={(e) => { e.preventDefault(); pick(p); }}><AtSign size={14} className="di-icon" aria-hidden />{p.name}</button>)}
          </div>
        )}
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          {canAttach && (
            <>
              <input ref={file} id={`att-${entityId}`} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.dwg,.dxf,.step,.stp,.igs,.iges,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip" />
              <label htmlFor={`att-${entityId}`} className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }} title="Attach drawings, certificates, photos (10 MB each)"><Paperclip size={15} aria-hidden /> Attach</label>
            </>
          )}
          <span className="muted hidden sm:inline" style={{ fontSize: 11 }}><kbd>Ctrl</kbd> <kbd>Enter</kbd></span>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginInlineStart: "auto" }} disabled={pending || !body.trim()} onClick={send}><Send size={14} aria-hidden /> Send</button>
        </div>
      </div>
      <div className="chatter-list">
        {!list.length && <p className="muted" style={{ textAlign: "center", fontSize: 13, padding: 18 }}>Nothing yet.</p>}
        {list.map((i) => (
          <div key={i.id} className={`msg ${i.kind === "log" ? "log" : ""}`}>
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: i.kind === "log" ? "var(--surface-3)" : undefined, color: i.kind === "log" ? "var(--muted)" : undefined }} aria-hidden>{initials(i.who)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="msg-head"><b>{i.who}</b><span className="muted">{fmtInstant(i.at)}</span></div>
              {i.kind === "comment" && (
                <div className="msg-body">{parts(i.body).map((p, n) => ("mention" in p ? <span key={n} className="mention">@{p.mention}</span> : <span key={n}>{p.text}</span>))}</div>
              )}
              {i.kind === "log" && <div className="msg-body">{i.text}</div>}
              {i.kind === "file" && (
                <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                  <a href={`/api/files/${i.fileId}`} target="_blank" rel="noopener" className="file-chip"><FileText size={16} className="ink" aria-hidden /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.fileName}</span><span className="muted">{kb(i.size)}</span></a>
                  {(i.mine || canDeleteAny) && <button type="button" className="icon-btn" aria-label={`Remove ${i.fileName}`} onClick={() => setDel({ id: i.fileId, name: i.fileName })}><Trash2 size={14} /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {del && <Confirm title="Remove this file?" danger busy={pending} confirmLabel="Remove" message={<><b>{del.name}</b> is removed from the order. The change history keeps that it was there.</>} onClose={() => setDel(null)} onConfirm={() => run(() => deleteAttachment(del.id), { onOk: () => setDel(null) })} />}
    </aside>
  );
}
