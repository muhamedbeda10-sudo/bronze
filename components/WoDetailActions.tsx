"use client";

import { useState } from "react";
import { Ban, Pencil } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Field } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { WoEditDialog, type LineDraft, type WoOptions } from "@/components/WoForm";
import { cancelWorkOrderAction } from "@/app/(app)/work-orders/actions";

export function WoDetailActions({ id, version, woNo, lineNo, lineCount, initial, o, lockProcess, canEdit, canCancel }: {
  id: number; version: number; woNo: string; lineNo: number; lineCount: number; initial: LineDraft; o: WoOptions | null; lockProcess: boolean; canEdit: boolean; canCancel: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  return (
    <>
      {canEdit && o && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEdit(true)}><Pencil size={14} aria-hidden /> Edit</button>}
      {canCancel && <button type="button" className="btn btn-danger btn-sm" onClick={() => setCancel(true)}><Ban size={14} aria-hidden /> Cancel order</button>}
      {edit && o && <WoEditDialog id={id} version={version} woNo={woNo} lineNo={lineNo} lineCount={lineCount} initial={initial} o={o} lockProcess={lockProcess} onClose={() => setEdit(false)} />}
      {cancel && (
        <Modal title={`Cancel ${woNo}-${lineNo}?`} size="sm" onClose={() => setCancel(false)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setCancel(false)}>Keep it</button>
          <button type="button" className="btn btn-danger" disabled={pending || !note.trim()} onClick={() => run(() => cancelWorkOrderAction(id, version, note), { onOk: () => setCancel(false) })}>Cancel order</button>
        </>}>
          <p style={{ marginTop: 0 }}>The order leaves the floor and the open lists. Its history stays.</p>
          <Field label="Reason" required><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </Modal>
      )}
    </>
  );
}
