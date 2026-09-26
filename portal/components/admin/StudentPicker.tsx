"use client";

import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus, X } from "lucide-react";
import { parseMemberEmails } from "@/lib/classrooms";
import { cn } from "@/lib/utils";

export interface PickableStudent {
  id: string;
  name: string | null;
  email: string;
  className?: string | null;
}

interface StudentPickerProps {
  students: PickableStudent[];
  /** Lower-cased emails currently chosen. */
  selected: string[];
  onChange: (emails: string[]) => void;
  /**
   * Also accept typed addresses for people who have not signed up yet. Both
   * classroom membership and note sharing are held by email, so a student can
   * be added before their first login, exactly as with test assignments.
   */
  allowUnregistered?: boolean;
  className?: string;
}

/**
 * The roster picker shared by the classroom member editor and the note
 * audience editor. One list, one set of keyboard and touch behaviours, and one
 * place where "selected" means a lower-cased email.
 */
export function StudentPicker({
  students,
  selected,
  onChange,
  allowUnregistered = true,
  className,
}: StudentPickerProps) {
  const [search, setSearch] = useState("");
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);

  const selectedSet = useMemo(
    () => new Set(selected.map((e) => e.toLowerCase())),
    [selected]
  );

  const registeredEmails = useMemo(
    () => new Set(students.map((s) => s.email.toLowerCase())),
    [students]
  );

  /** Chosen addresses with no roster row -- shown separately so they are not
      invisible just because the student has never signed in. */
  const unregistered = useMemo(
    () => selected.filter((e) => !registeredEmails.has(e.toLowerCase())),
    [selected, registeredEmails]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q)
    );
  }, [students, search]);

  const toggle = (email: string) => {
    const lower = email.toLowerCase();
    onChange(
      selectedSet.has(lower)
        ? selected.filter((e) => e.toLowerCase() !== lower)
        : [...selected, lower]
    );
  };

  const selectAllFiltered = (checked: boolean) => {
    const emails = filtered.map((s) => s.email.toLowerCase());
    if (checked) {
      onChange(Array.from(new Set([...selected, ...emails])));
    } else {
      const drop = new Set(emails);
      onChange(selected.filter((e) => !drop.has(e.toLowerCase())));
    }
  };

  const addTyped = () => {
    const parsed = parseMemberEmails(typed.split(/[\s,;]+/));
    if (parsed.invalid.length > 0) {
      setTypedError(`Not a valid email address: ${parsed.invalid[0]}`);
      return;
    }
    if (parsed.valid.length === 0) return;
    setTypedError(null);
    setTyped("");
    onChange(Array.from(new Set([...selected, ...parsed.valid])));
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedSet.has(s.email.toLowerCase()));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-brand-ink/40" />
          <Input
            placeholder="Search name, email or class…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          {filtered.length > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5 text-brand-ink/70">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={(c) => selectAllFiltered(Boolean(c))}
                aria-label="Select everyone shown"
              />
              <span>Select all shown</span>
            </label>
          )}
          <span className="font-semibold text-brand-navy">{selected.length} selected</span>
        </div>
      </div>

      <div className="max-h-[300px] space-y-1.5 overflow-y-auto rounded-lg border border-brand-border bg-white p-2">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-brand-ink/60">
            {students.length === 0
              ? "No students on the roster yet."
              : "No students match your search."}
          </p>
        ) : (
          filtered.map((student) => {
            const isSelected = selectedSet.has(student.email.toLowerCase());
            return (
              // A div, not a button: Radix's Checkbox renders its own <button>,
              // and a button inside a button fails hydration.
              <div
                key={student.id}
                role="group"
                onClick={() => toggle(student.email)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors",
                  isSelected
                    ? "border-brand-blue bg-brand-tint/60"
                    : "border-transparent hover:bg-brand-page"
                )}
              >
                <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(student.email)}
                    aria-label={`Select ${student.name || student.email}`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-brand-navy">
                    {student.name || "Student"}
                  </span>
                  <span className="mt-0.5 block break-all font-mono text-[11px] text-brand-ink/70">
                    {student.email}
                  </span>
                </span>
                {student.className && (
                  <span className="shrink-0 rounded bg-brand-tint px-2 py-0.5 text-[10px] font-medium text-brand-navy">
                    {student.className}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {unregistered.length > 0 && (
        <div className="rounded-lg border border-brand-border bg-brand-page p-3">
          <p className="text-[11px] font-semibold text-brand-navy">
            Added by email (not signed in yet)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unregistered.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-white px-2 py-0.5 font-mono text-[11px] text-brand-ink/80"
              >
                {email}
                <button
                  type="button"
                  onClick={() => toggle(email)}
                  aria-label={`Remove ${email}`}
                  className="text-brand-ink/50 transition-colors hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {allowUnregistered && (
        <div>
          <div className="flex gap-2">
            <Input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setTypedError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTyped();
                }
              }}
              placeholder="Add someone by email…"
              className="h-9 text-xs"
            />
            <button
              type="button"
              onClick={addTyped}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-brand-border bg-white px-3 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-tint"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          {typedError ? (
            <p className="mt-1 text-[11px] text-red-600">{typedError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-brand-ink/50">
              Students who have not signed in yet can be added now; they will see this the
              first time they log in.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
