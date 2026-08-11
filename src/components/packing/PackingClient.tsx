"use client";

import { useState, useTransition } from "react";
import { addChecklistItem, assignChecklistItem, importLegacyPackingList, removeChecklistItem, toggleChecklistItem } from "@/app/trips/[tripId]/packing/actions";
import { Icons } from "@/components/shared/Icons";
import { toast } from "@/components/shared/Toast";

type Item = { id: string; label: string; done: boolean; ownerId: string | null; assigneeId: string | null };

export function PackingClient({ tripId, items, members, hasLegacyPacking, readOnly }: { tripId: string; items: Item[]; members: { id: string; name: string }[]; hasLegacyPacking: boolean; readOnly: boolean }) {
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"group" | "personal">("group");
  const [pending, startTransition] = useTransition();
  const group = items.filter((item) => item.ownerId === null);
  const personal = items.filter((item) => item.ownerId !== null);
  const add = () => startTransition(async () => { try { await addChecklistItem({ tripId, label, scope }); setLabel(""); } catch { toast("Couldn't add that item — try again."); } });
  const mutate = (fn: () => Promise<void>) => startTransition(async () => { try { await fn(); } catch { toast("Couldn't save that — try again."); } });
  const list = (title: string, subtitle: string, rows: Item[], shared = false) => <section className="packing-section"><div className="packing-head"><div><h2>{title}</h2><p>{subtitle}</p></div><span>{rows.filter((x) => x.done).length} / {rows.length}</span></div>{rows.length === 0 ? <p className="packing-empty">Nothing here yet.</p> : <ul>{rows.map((item) => <li key={item.id}><button type="button" className={item.done ? "done" : ""} onClick={() => !readOnly && mutate(() => toggleChecklistItem({ tripId, itemId: item.id }))} disabled={readOnly}><span aria-hidden="true">{item.done ? "✓" : ""}</span>{item.label}</button>{shared && <select aria-label={`Assign ${item.label}`} value={item.assigneeId ?? ""} disabled={readOnly} onChange={(e) => mutate(() => assignChecklistItem({ tripId, itemId: item.id, assigneeId: e.target.value || null }))}><option value="">Unclaimed</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}{!readOnly && <button type="button" aria-label={`Remove ${item.label}`} onClick={() => mutate(() => removeChecklistItem({ tripId, itemId: item.id }))}><Icons.close size={14} /></button>}</li>)}</ul>}</section>;
  return <div className="packing-card"><header><span className="notes-pin"><Icons.note size={15} /></span><div><p className="eyebrow">Trip essentials</p><h1>Packing</h1><p>Keep shared gear clear, and your personal reminders private.</p></div></header>{hasLegacyPacking && !readOnly && <button className="btn btn-ghost" onClick={() => mutate(async () => { const count = await importLegacyPackingList(tripId); toast(count ? `${count} items imported.` : "Nothing new to import."); })}>Import existing packing notes</button>}{list("For the group", "One person brings it for everyone.", group, true)}{list("For me", "Only you can see these items.", personal)}{!readOnly && <form onSubmit={(e) => { e.preventDefault(); if (label.trim()) add(); }}><div className="packing-scope"><button type="button" className={scope === "group" ? "active" : ""} onClick={() => setScope("group")}>For the group</button><button type="button" className={scope === "personal" ? "active" : ""} onClick={() => setScope("personal")}>For me</button></div><div className="packing-add"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={scope === "group" ? "e.g. First-aid kit" : "e.g. Passport"} maxLength={160} /><button className="btn btn-primary" disabled={pending}>Add item</button></div></form>}</div>;
}
