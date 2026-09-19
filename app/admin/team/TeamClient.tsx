"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TUTOR_CAN, TUTOR_CANNOT } from "@/lib/permissions";
import { addTutor, removeTutor, setTutorClassrooms } from "./actions";
import { Check, ShieldCheck, ShieldX, Trash2, UserPlus } from "lucide-react";

interface Tutor {
  email: string;
  name: string | null;
  classroomIds: string[];
}
interface Room {
  id: string;
  name: string;
  students: number;
}

function TutorCard({ tutor, classrooms, onRemove }: { tutor: Tutor; classrooms: Room[]; onRemove: () => void }) {
  const [picked, setPicked] = useState<string[]>(tutor.classroomIds);
  const [saved, setSaved] = useState(tutor.classroomIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = [...picked].sort().join() !== [...saved].sort().join();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await setTutorClassrooms(tutor.email, picked);
      if (res.error) setError(res.error);
      else setSaved(picked);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-brand-border bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-navy">{tutor.name || tutor.email}</p>
          {tutor.name && <p className="truncate text-[11px] text-brand-ink/60">{tutor.email}</p>}
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${tutor.email}`} className="rounded p-1.5 text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-brand-navy">Classrooms they look after</p>
        {classrooms.length === 0 ? (
          <p className="text-xs text-brand-ink/60">No classrooms yet. Create them under Classrooms first.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {classrooms.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-brand-border px-2 py-1.5 text-xs hover:bg-brand-page">
                <input
                  type="checkbox"
                  checked={picked.includes(c.id)}
                  onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-brand-ink/50">{c.students}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={busy || !changed} onClick={save} className="h-8 bg-brand-navy text-xs text-white">
          Save classrooms
        </Button>
        {!changed && picked.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><Check className="h-3.5 w-3.5" /> Saved</span>}
        {picked.length === 0 && <span className="text-[11px] text-amber-700">Sees no students until given a classroom.</span>}
        {error && <span className="text-[11px] text-red-700">{error}</span>}
      </div>
    </section>
  );
}

export function TeamClient({ owners, classrooms, initial }: { owners: string[]; classrooms: Room[]; initial: Tutor[] }) {
  const [tutors, setTutors] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await addTutor(email, name);
      if (res.error) setError(res.error);
      else {
        setTutors((t) => [...t, { email: email.trim().toLowerCase(), name: name.trim() || null, classroomIds: [] }]);
        setEmail("");
        setName("");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Tutor) => {
    if (!window.confirm(`Remove ${t.name || t.email} as a tutor? They lose access to marking and doubts at once.`)) return;
    const res = await removeTutor(t.email);
    if (res.error) setError(res.error);
    else setTutors((list) => list.filter((x) => x.email !== t.email));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-brand-navy">Team</h1>
        <p className="mt-0.5 text-xs text-brand-ink/60">
          Add tutors to share the marking and doubts. Each tutor sees only the students in the classrooms you give them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4" /> A tutor can</p>
          <ul className="list-disc space-y-1 pl-4 text-emerald-950/80">
            {TUTOR_CAN.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 text-xs">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-red-900"><ShieldX className="h-4 w-4" /> A tutor cannot</p>
          <ul className="list-disc space-y-1 pl-4 text-red-950/80">
            {TUTOR_CANNOT.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-brand-border bg-white p-4 shadow-card">
        <p className="text-xs font-semibold text-brand-navy">Add a tutor</p>
        <div className="flex flex-wrap gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="tutor@gmail.com" aria-label="Tutor email" className="h-9 w-64 text-xs" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Tutor name" className="h-9 w-48 text-xs" />
          <Button type="button" disabled={busy || !email.trim()} onClick={add} className="h-9 gap-1.5 bg-brand-navy text-xs text-white">
            <UserPlus className="h-4 w-4" /> Add tutor
          </Button>
        </div>
        <p className="text-[11px] text-brand-ink/55">They sign in with Google using this email, and land on their own marking queue.</p>
        {error && <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
      </div>

      {tutors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-brand-border bg-white p-8 text-center text-xs text-brand-ink/60">No tutors yet.</p>
      ) : (
        tutors.map((t) => <TutorCard key={t.email} tutor={t} classrooms={classrooms} onRemove={() => remove(t)} />)
      )}

      <div className="rounded-xl border border-brand-border bg-white p-4 text-xs shadow-card">
        <p className="mb-1 font-semibold text-brand-navy">Owners</p>
        <p className="mb-2 text-brand-ink/60">Set in the ADMIN_EMAILS setting on the server; owners can do everything.</p>
        <ul className="space-y-0.5">
          {owners.map((o) => <li key={o} className="font-mono text-[11px]">{o}</li>)}
        </ul>
      </div>
    </div>
  );
}
