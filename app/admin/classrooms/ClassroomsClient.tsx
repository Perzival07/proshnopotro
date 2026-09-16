"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AtomMark } from "@/components/brand/AtomMark";
import { SubjectIcon } from "@/components/SubjectIcon";
import type { PickableStudent } from "@/components/admin/StudentPicker";
import { ClassroomModal } from "./ClassroomModal";
import { MembersModal } from "./MembersModal";
import { deleteClassroom, getClassroomFootprint, toggleClassroomActive } from "./actions";
import { memberCountLabel } from "@/lib/classrooms";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Edit2,
  FileText,
  Plus,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

export interface ClassroomRow {
  id: string;
  name: string;
  subject: string | null;
  description: string | null;
  iconName: string;
  active: boolean;
  createdAt: Date;
  memberEmails: string[];
  noteCount: number;
}

interface ClassroomsClientProps {
  classrooms: ClassroomRow[];
  students: PickableStudent[];
}

export function ClassroomsClient({ classrooms, students }: ClassroomsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classroomToEdit, setClassroomToEdit] = useState<ClassroomRow | null>(null);
  const [membersFor, setMembersFor] = useState<ClassroomRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Deleting is two-stage: the footprint is fetched first so the confirmation
  // can state exactly what goes with the classroom.
  const [pendingDelete, setPendingDelete] = useState<ClassroomRow | null>(null);
  const [footprint, setFootprint] = useState<{
    members: number;
    notes: number;
    orphanedNotes: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.subject || "").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        c.memberEmails.some((e) => e.includes(q))
    );
  }, [classrooms, search]);

  const totalStudents = useMemo(
    () => new Set(classrooms.flatMap((c) => c.memberEmails)).size,
    [classrooms]
  );

  const openCreate = () => {
    setClassroomToEdit(null);
    setIsModalOpen(true);
  };

  const toggleArchive = async (classroom: ClassroomRow) => {
    setTogglingId(classroom.id);
    setError(null);
    try {
      const res = await toggleClassroomActive(classroom.id, !classroom.active);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setTogglingId(null);
    }
  };

  const askDelete = async (classroom: ClassroomRow) => {
    setError(null);
    setPendingDelete(classroom);
    setFootprint(null);
    const res = await getClassroomFootprint(classroom.id);
    if ("error" in res) {
      setError(res.error);
      setPendingDelete(null);
      return;
    }
    setFootprint(res);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteClassroom(pendingDelete.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } catch {
      setError("Could not reach the server to remove this classroom.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">Classrooms</h1>
          <p className="text-body mt-1 text-xs text-brand-ink/70">
            Group students into the batches you teach. A classroom gets the same notes and
            the same tests, together.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="flex w-full items-center justify-center gap-2 bg-brand-navy text-white shadow-sm hover:bg-brand-navy/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Classroom</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-ink/40" />
          <Input
            placeholder="Search classrooms by name, subject or student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        <p className="shrink-0 text-xs text-brand-ink/70">
          <strong className="text-brand-navy">{classrooms.length}</strong> classroom
          {classrooms.length === 1 ? "" : "s"} &middot;{" "}
          <strong className="text-brand-navy">{totalStudents}</strong> student
          {totalStudents === 1 ? "" : "s"} enrolled
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center shadow-xs">
          <Users className="mx-auto h-8 w-8 text-brand-blue/60" />
          <h2 className="mt-3 font-heading text-sm font-semibold text-brand-navy">
            {classrooms.length === 0 ? "No classrooms yet" : "No classrooms match your search"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-brand-ink/70">
            {classrooms.length === 0
              ? "Create a classroom for each batch you teach, then add the students in it. Notes and tests can then go to the whole batch at once."
              : "Try a different name, subject or student email."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`flex flex-col rounded-xl border bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover ${
                c.active ? "border-brand-border" : "border-dashed border-brand-border opacity-75"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                  <SubjectIcon name={c.iconName} className="h-5 w-5 text-brand-navy" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-sm font-semibold text-brand-navy">
                    {c.name}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-brand-ink/60">
                    {c.subject || "All subjects"}
                    {!c.active && (
                      <span className="ml-2 rounded bg-status-gray-bg px-1.5 py-0.5 font-medium text-status-gray-text">
                        Archived
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {c.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-brand-ink/70">
                  {c.description}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-tint px-2.5 py-1 font-medium text-brand-navy">
                  <Users className="h-3 w-3 text-brand-blue" />
                  {memberCountLabel(c.memberEmails.length)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
                  <FileText className="h-3 w-3" />
                  {c.noteCount} note{c.noteCount === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-brand-border/60 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMembersFor(c)}
                  className="h-9 gap-1.5 border-brand-border text-xs text-brand-navy"
                >
                  <Users className="h-3.5 w-3.5 text-brand-blue" />
                  Manage students
                </Button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setClassroomToEdit(c);
                      setIsModalOpen(true);
                    }}
                    title="Edit classroom"
                    aria-label={`Edit ${c.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-ink/80 transition-colors hover:bg-brand-tint hover:text-brand-navy"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleArchive(c)}
                    disabled={togglingId === c.id}
                    title={c.active ? "Archive classroom" : "Restore classroom"}
                    aria-label={`${c.active ? "Archive" : "Restore"} ${c.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-ink/80 transition-colors hover:bg-brand-tint hover:text-brand-navy disabled:opacity-50"
                  >
                    {c.active ? (
                      <Archive className="h-4 w-4" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => askDelete(c)}
                    title="Delete classroom"
                    aria-label={`Delete ${c.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClassroomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        classroomToEdit={classroomToEdit}
        onSaved={() => router.refresh()}
      />

      <MembersModal
        classroom={membersFor}
        students={students}
        onClose={() => setMembersFor(null)}
        onSaved={() => router.refresh()}
      />

      {/* Delete confirmation: names the cost before it is paid. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Delete this classroom?
            </DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            {footprint === null ? (
              <p className="text-brand-ink/60">Checking what this affects…</p>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                <p className="font-semibold">This also removes:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>
                    {footprint.members} student{footprint.members === 1 ? "" : "s"} from this
                    batch
                  </li>
                  <li>
                    the sharing of {footprint.notes} set{footprint.notes === 1 ? "" : "s"} of
                    notes with it
                  </li>
                </ul>
                <p className="mt-2 text-[11px] text-red-700/90">
                  {footprint.orphanedNotes > 0 ? (
                    <>
                      {footprint.orphanedNotes} set
                      {footprint.orphanedNotes === 1 ? "" : "s"} of notes
                      {footprint.orphanedNotes === 1 ? " is" : " are"} shared only with this
                      classroom, so {footprint.orphanedNotes === 1 ? "it" : "they"} will no
                      longer reach any student. The notes themselves are kept, and can be
                      shared again.
                    </>
                  ) : (
                    <>
                      The notes themselves are kept — only their sharing with this classroom
                      goes. Students&apos; tests and results are untouched.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting || footprint === null}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#FCA5A5" animate />
                  <span>Deleting…</span>
                </div>
              ) : (
                "Delete Classroom"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
