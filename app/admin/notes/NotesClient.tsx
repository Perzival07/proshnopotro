"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { NoteModal, defaultScheduleValue } from "./NoteModal";
import { deleteNote, publishNote, unpublishNote } from "./actions";
import { formatDate } from "@/lib/utils";
import { noteState, publishBlocker, type NoteState } from "@/lib/notes";
import {
  AlertTriangle,
  CalendarClock,
  Edit2,
  EyeOff,
  FileText,
  Link2,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

export interface ClassroomOption {
  id: string;
  name: string;
  active: boolean;
  memberCount: number;
}

export interface NoteRow {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  iconName: string;
  linkUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  fileCount: number;
  classroomIds: string[];
  classroomNames: string[];
  studentEmails: string[];
  /** Distinct students who can see this once it is published. */
  recipientCount: number;
}

interface NotesClientProps {
  notes: NoteRow[];
  classrooms: ClassroomOption[];
  students: PickableStudent[];
}

const STATE_STYLES: Record<NoteState, string> = {
  DRAFT: "border-status-gray-border bg-status-gray-bg text-status-gray-text",
  SCHEDULED: "border-status-amber-border bg-status-amber-bg text-status-amber-text",
  PUBLISHED: "border-status-green-border bg-status-green-bg text-status-green-text",
};

export function NotesClient({ notes, classrooms, students }: NotesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<"ALL" | NoteState>("ALL");
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<NoteRow | null>(null);

  const [publishTarget, setPublishTarget] = useState<NoteRow | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<NoteRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(
    () => notes.map((n) => ({ note: n, state: noteState(n) })),
    [notes]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(({ note, state }) => {
      const matchesState = stateFilter === "ALL" || state === stateFilter;
      if (!matchesState) return false;
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.subject.toLowerCase().includes(q) ||
        (note.description || "").toLowerCase().includes(q) ||
        note.classroomNames.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [rows, search, stateFilter]);

  const counts = useMemo(() => {
    const tally = { DRAFT: 0, SCHEDULED: 0, PUBLISHED: 0 };
    rows.forEach(({ state }) => (tally[state] += 1));
    return tally;
  }, [rows]);

  const openPublish = (note: NoteRow) => {
    setError(null);
    const blocker = publishBlocker({
      fileCount: note.fileCount,
      linkUrl: note.linkUrl,
      classroomCount: note.classroomIds.length,
      studentCount: note.studentEmails.length,
    });
    if (blocker) {
      setError(blocker);
      return;
    }
    setScheduleAt(defaultScheduleValue());
    setPublishTarget(note);
  };

  const runPublish = async (whenIso: string | null) => {
    if (!publishTarget) return;
    setScheduling(true);
    setError(null);
    try {
      const res = await publishNote(publishTarget.id, whenIso);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPublishTarget(null);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setScheduling(false);
    }
  };

  const hide = async (note: NoteRow) => {
    setBusyId(note.id);
    setError(null);
    try {
      const res = await unpublishNote(note.id);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteNote(pendingDelete.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPendingDelete(null);
      router.refresh();
    } catch {
      setError("Could not reach the server to delete these notes.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-navy">Notes</h1>
          <p className="text-body mt-1 text-xs text-brand-ink/70">
            Share study material with a whole classroom, or with named students. Publish
            now, or set a time so everyone gets it together.
          </p>
        </div>

        <Button
          onClick={() => {
            setNoteToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 bg-brand-navy text-white shadow-sm hover:bg-brand-navy/90 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Notes</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <XCircle className="mt-px h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-brand-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-ink/40" />
          <Input
            placeholder="Search notes by title, subject or classroom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-page p-1">
          {(["ALL", "PUBLISHED", "SCHEDULED", "DRAFT"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStateFilter(key)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors ${
                stateFilter === key
                  ? "border border-brand-border bg-white font-semibold text-brand-navy shadow-xs"
                  : "text-brand-ink/70 hover:text-brand-navy"
              }`}
            >
              {key === "ALL" ? `All (${rows.length})` : `${key.toLowerCase()} (${counts[key]})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border bg-white p-10 text-center shadow-xs">
          <FileText className="mx-auto h-8 w-8 text-brand-blue/60" />
          <h2 className="mt-3 font-heading text-sm font-semibold text-brand-navy">
            {notes.length === 0 ? "No notes yet" : "Nothing matches that filter"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-brand-ink/70">
            {notes.length === 0
              ? "Upload a scanned worksheet, a photo of the board or a PDF, choose a classroom, and publish it."
              : "Try another search, or a different state."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ note, state }) => (
            <div
              key={note.id}
              className="rounded-xl border border-brand-border bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                    <SubjectIcon name={note.iconName} className="h-5 w-5 text-brand-navy" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-sm font-semibold text-brand-navy">
                        {note.title}
                      </h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_STYLES[state]}`}
                      >
                        {state === "SCHEDULED" && note.publishedAt
                          ? `Goes out ${formatDate(note.publishedAt)}`
                          : state.toLowerCase()}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-brand-ink/60">
                      {note.subject}
                      {state === "PUBLISHED" && note.publishedAt && (
                        <> &middot; published {formatDate(note.publishedAt)}</>
                      )}
                    </p>

                    {note.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-brand-ink/75">
                        {note.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
                        <FileText className="h-3 w-3" />
                        {note.fileCount} file{note.fileCount === 1 ? "" : "s"}
                      </span>
                      {note.linkUrl && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
                          <Link2 className="h-3 w-3" />
                          Link
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-tint px-2.5 py-1 font-medium text-brand-navy">
                        <Users className="h-3 w-3 text-brand-blue" />
                        {note.recipientCount} student
                        {note.recipientCount === 1 ? "" : "s"}
                      </span>
                      {note.classroomNames.map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-brand-border bg-white px-2.5 py-1 font-medium text-brand-ink/70"
                        >
                          {name}
                        </span>
                      ))}
                      {note.studentEmails.length > 0 && (
                        <span className="rounded-full border border-brand-border bg-white px-2.5 py-1 font-medium text-brand-ink/70">
                          +{note.studentEmails.length} individually
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:flex-col sm:items-end">
                  {state === "PUBLISHED" || state === "SCHEDULED" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => hide(note)}
                      disabled={busyId === note.id}
                      className="h-9 gap-1.5 border-brand-border text-xs text-brand-navy"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      {state === "SCHEDULED" ? "Cancel schedule" : "Unpublish"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => openPublish(note)}
                      className="h-9 gap-1.5 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Publish
                    </Button>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setNoteToEdit(note);
                        setIsModalOpen(true);
                      }}
                      title="Edit notes"
                      aria-label={`Edit ${note.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-ink/80 transition-colors hover:bg-brand-tint hover:text-brand-navy"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(note)}
                      title="Delete notes"
                      aria-label={`Delete ${note.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        noteToEdit={noteToEdit}
        classrooms={classrooms}
        students={students}
        onSaved={() => router.refresh()}
      />

      {/* Publish now, or at a chosen time. */}
      <Dialog
        open={publishTarget !== null}
        onOpenChange={(open) => !open && !scheduling && setPublishTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish &ldquo;{publishTarget?.title}&rdquo;</DialogTitle>
            <DialogDescription>
              {publishTarget?.recipientCount} student
              {publishTarget?.recipientCount === 1 ? "" : "s"} will see these notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Button
              type="button"
              onClick={() => runPublish(null)}
              disabled={scheduling}
              className="w-full gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              <Send className="h-4 w-4" />
              Publish now
            </Button>

            <div className="rounded-lg border border-brand-border bg-brand-page p-3">
              <Label
                htmlFor="schedule-at"
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy"
              >
                <CalendarClock className="h-3.5 w-3.5 text-brand-blue" />
                Or set a time
              </Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="mt-1.5 h-10 text-xs"
              />
              <p className="mt-1.5 text-[11px] text-brand-ink/60">
                Everyone in the batch sees the notes at this moment — nobody gets a head
                start.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={scheduling || !scheduleAt}
                onClick={() => {
                  const when = new Date(scheduleAt);
                  if (isNaN(when.getTime())) {
                    setError("That is not a valid date and time.");
                    return;
                  }
                  void runPublish(when.toISOString());
                }}
                className="mt-3 w-full border-brand-border text-xs text-brand-navy"
              >
                {scheduling ? (
                  <span className="flex items-center gap-2">
                    <AtomMark size={16} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
                    <span>Scheduling…</span>
                  </span>
                ) : (
                  "Schedule"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation. */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Delete these notes?
            </DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; and its {pendingDelete?.fileCount} file
              {pendingDelete?.fileCount === 1 ? "" : "s"} will be removed for everyone. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <div className="flex items-center gap-2">
                  <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#FCA5A5" animate />
                  <span>Deleting…</span>
                </div>
              ) : (
                "Delete Notes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
