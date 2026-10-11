"use client";

// Control phonebook: the contacts behind name autocomplete and phone auto-fill on the board.
// Stored in Supabase (contacts) with a copy kept in this browser as a fallback.

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BookUser, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { useDialog, useToast } from "@/components/uiFeedback";
import { filterContacts, findContact, type Contact } from "@/lib/duty/model";
import { addContact, deleteContact, usePhonebook } from "@/lib/duty/store";

const blank: Contact = { name: "", role: "", phone: "", notes: "" };

export default function Phonebook() {
  const book = usePhonebook();
  const toast = useToast();
  const dialog = useDialog();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [form, setForm] = useState<Contact>(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function add() {
    const c = { name: form.name.trim(), role: form.role.trim(), phone: form.phone.trim(), notes: form.notes.trim() };
    if (!c.name || !c.phone) return toast.error("Name and phone number are required");
    if (findContact(book, c.name)) {
      const ok = await dialog.confirm({ title: `${c.name} is already in the phonebook`, body: "Saving replaces their details with these.", confirmLabel: "Replace" });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await addContact(c);
      toast.success(`${c.name} added`);
      setForm(blank);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Contact) {
    const ok = await dialog.confirm({ title: `Delete ${c.name}?`, body: "They are removed from the shared phonebook.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await deleteContact(c);
      toast.success(`${c.name} deleted`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const shown = [...filterContacts(book, q)].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader eyebrow="Booking On Board" title="Control phonebook" subtitle="Contacts used for name autocomplete and phone auto-fill on the duty board. Use the same name here as on the board." />

      <Card title="Add contact" className="mb-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Field label="Name" required>
            <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Derby MOM 1" />
          </Field>
          <Field label="Role / team">
            <input className="input" value={form.role} onChange={set("role")} placeholder="MOM, S&T, OLE" />
          </Field>
          <Field label="Phone" required>
            <input className="input font-mono" inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="07…, desk line" />
          </Field>
          <Field label="Notes">
            <input className="input" value={form.notes} onChange={set("notes")} placeholder="Coverage / base / quirks" />
          </Field>
          <button className="btn btn-primary" disabled={busy || !form.name.trim() || !form.phone.trim()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add contact
          </button>
        </form>
      </Card>

      <div className="relative mb-3 max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input !pl-9" placeholder="Filter by name, role, phone or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
      </div>

      <Card padded={false} title={`${shown.length} contact${shown.length === 1 ? "" : "s"}`}>
        {shown.length === 0 ? (
          <EmptyState icon={BookUser} title={q ? "No contacts match this search" : "No contacts yet"} />
        ) : (
          <>
            <table className="tbl hidden md:table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role / team</th>
                  <th>Phone</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.name}>
                    <td className="font-semibold">{c.name}</td>
                    <td className="text-dim">{c.role}</td>
                    <td>
                      <a className="link font-mono" href={`tel:${c.phone.replace(/\s+/g, "")}`}>
                        {c.phone}
                      </a>
                    </td>
                    <td className="text-dim">{c.notes}</td>
                    <td className="text-right">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-[var(--border)] md:hidden">
              {shown.map((c) => (
                <li key={c.name} className="flex items-start gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <a className="link block font-mono text-sm" href={`tel:${c.phone.replace(/\s+/g, "")}`}>
                      {c.phone}
                    </a>
                    {(c.role || c.notes) && <span className="block text-xs text-dim">{[c.role, c.notes].filter(Boolean).join(" · ")}</span>}
                  </span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
