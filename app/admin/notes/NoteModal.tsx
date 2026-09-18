"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AtomMark } from "@/components/brand/AtomMark";
import { SubjectIcon, SUBJECT_ICONS } from "@/components/SubjectIcon";
import { StudentPicker, type PickableStudent } from "@/components/admin/StudentPicker";
import { shrinkImage } from "@/lib/shrink-image";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import {
  ACCEPTED_FILE_TYPES,
  formatBytes,
  MAX_NOTE_DESCRIPTION,
  MAX_NOTE_FILE_BYTES,
  MAX_NOTE_FILES,
  MAX_NOTE_TITLE,
  isAllowedNoteFormat,
} from "@/lib/notes";
import { toDateTimeLocalValue } from "@/lib/utils";
import {
  createNote,
  deleteNoteFile,
  getNoteUploadSignature,
  listNoteFiles,
  saveNoteFiles,
  setNoteAudience,
  updateNote,
  type NoteFileView,
  type UploadedNoteFile,
} from "./actions";
import type { ClassroomOption, NoteRow } from "./NotesClient";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ImagePlus,
  Link2,
  Trash2,
  Users,
} from "lucide-react";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: NoteRow | null;
  classrooms: ClassroomOption[];
  students: PickableStudent[];
  onSaved: () => void;
}

/**
 * The tutor's editor for one set of notes.
 *
 * Files live in a Cloudinary folder named after the note, so a brand-new note
 * is saved as a draft first and the rest of the editor opens once it has an
 * id. A draft is invisible to every student, so nothing escapes early.
 */
export function NoteModal({
  isOpen,
  onClose,
  noteToEdit,
  classrooms,
  students,
  onSaved,
}: NoteModalProps) {
  const [noteId, setNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [iconName, setIconName] = useState("FileText");
  const [linkUrl, setLinkUrl] = useState("");

  const [files, setFiles] = useState<NoteFileView[]>([]);
  const [classroomIds, setClassroomIds] = useState<string[]>([]);
  const [studentEmails, setStudentEmails] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [removingFileId, setRemovingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSavedAt(null);
    setUploading(null);

    if (noteToEdit) {
      setNoteId(noteToEdit.id);
      setTitle(noteToEdit.title);
      setSubject(noteToEdit.subject);
      setDescription(noteToEdit.description || "");
      setIconName(noteToEdit.iconName || "FileText");
      setLinkUrl(noteToEdit.linkUrl || "");
      setClassroomIds(noteToEdit.classroomIds);
      setStudentEmails(noteToEdit.studentEmails);
      setFiles([]);
    } else {
      setNoteId(null);
      setTitle("");
      setSubject("");
      setDescription("");
      setIconName("FileText");
      setLinkUrl("");
      setClassroomIds([]);
      setStudentEmails([]);
      setFiles([]);
    }
  }, [noteToEdit, isOpen]);

  const refreshFiles = useCallback(async (id: string) => {
    const res = await listNoteFiles(id);
    if (res.error) setError(res.error);
    else setFiles(res.files ?? []);
  }, []);

  // Signed links are minted per request, so they are fetched when the editor
  // opens rather than carried in the page's props.
  useEffect(() => {
    if (!isOpen || !noteToEdit) return;
    void refreshFiles(noteToEdit.id);
  }, [isOpen, noteToEdit, refreshFiles]);

  /** Saves the details, creating the note on first save. Returns its id. */
  const saveDetails = async (): Promise<string | null> => {
    const payload = { title, subject, description, iconName, linkUrl };

    if (noteId) {
      const res = await updateNote(noteId, payload);
      if (res.error) {
        setError(res.error);
        return null;
      }
      return noteId;
    }

    const res = await createNote(payload);
    if (res.error || !res.noteId) {
      setError(res.error || "Failed to create these notes.");
      return null;
    }
    setNoteId(res.noteId);
    return res.noteId;
  };

  const handleSave = async (closeAfter: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const id = await saveDetails();
      if (!id) return;

      const audience = await setNoteAudience(id, classroomIds, studentEmails);
      if (audience.error) {
        setError(audience.error);
        return;
      }

      setSavedAt(Date.now());
      onSaved();
      if (closeAfter) onClose();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    // Uploads go into a folder named after the note, so an unsaved note is
    // saved first rather than refusing the drop.
    let id = noteId;
    if (!id) {
      setSaving(true);
      id = await saveDetails();
      setSaving(false);
      if (!id) return;
      onSaved();
    }

    const chosen = Array.from(fileList);
    const room = MAX_NOTE_FILES - files.length;
    if (room <= 0) {
      setError(`A set of notes can hold at most ${MAX_NOTE_FILES} files.`);
      return;
    }
    const accepted = chosen.slice(0, room);
    if (accepted.length < chosen.length) {
      setError(`Only ${MAX_NOTE_FILES} files fit in one set; the extra ones were left out.`);
    }

    setUploading({ done: 0, total: accepted.length });

    try {
      const signed = await getNoteUploadSignature(id);
      if (signed.error || !signed.upload) {
        setError(signed.error || "Could not start the upload.");
        return;
      }
      const sig = signed.upload;

      // Each file stands on its own. One that is refused or fails to send is
      // reported and skipped, and the rest are still recorded -- otherwise a
      // failure on file 3 of 5 would leave files 1 and 2 stored in Cloudinary
      // but missing from the note.
      const uploaded: UploadedNoteFile[] = [];
      const problems: string[] = [];
      for (let i = 0; i < accepted.length; i++) {
        const original = accepted[i];
        try {
          const extension = (original.name.split(".").pop() || "").toLowerCase();

          if (original.type === "application/pdf" || extension === "pdf") {
            problems.push(
              `${original.name} is a PDF. PDFs are not uploaded: put it on Google Drive and paste its link in the link field above.`
            );
            continue;
          }
          if (!original.type.startsWith("image/")) {
            problems.push(`${original.name} is not a photo, so it was skipped.`);
            continue;
          }
          if (extension && !isAllowedNoteFormat(extension)) {
            problems.push(`${original.name} is not a picture format the portal can store.`);
            continue;
          }
          if (original.size > MAX_NOTE_FILE_BYTES) {
            problems.push(
              `${original.name} is ${formatBytes(original.size)}; files must be under ${formatBytes(
                MAX_NOTE_FILE_BYTES
              )}.`
            );
            continue;
          }

          // Shrunk in the browser before it is sent: a 12-megapixel snap of a
          // blackboard becomes a few hundred KB and stays readable.
          const blob = await shrinkImage(original);
          const format = "jpg";

          const body = await uploadToCloudinary(sig, blob, `${original.name}.jpg`);

          uploaded.push({
            publicId: body.public_id,
            version: body.version,
            format,
            originalName: original.name,
            bytes: body.bytes ?? original.size,
            width: body.width,
            height: body.height,
          });
        } catch (err) {
          console.error(err);
          const reason = err instanceof Error ? err.message : "";
          problems.push(
            !reason
              ? `${original.name} did not upload. Please try it again.`
              : reason.includes(original.name)
                ? reason
                : `${original.name} did not upload: ${reason}`
          );
        } finally {
          setUploading({ done: i + 1, total: accepted.length });
        }
      }

      if (uploaded.length > 0) {
        const saved = await saveNoteFiles(id, uploaded);
        if (saved.error) {
          problems.unshift(saved.error);
        } else {
          setFiles(saved.files ?? []);
          onSaved();
        }
      }

      if (problems.length > 0) setError(problems.join(" "));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "The upload stopped part way. Please try again."
      );
    } finally {
      setUploading(null);
    }
  };

  const removeFile = async (fileId: string) => {
    setRemovingFileId(fileId);
    setError(null);
    try {
      const res = await deleteNoteFile(fileId);
      if (res.error) setError(res.error);
      else {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        onSaved();
      }
    } catch {
      setError("Could not remove that file.");
    } finally {
      setRemovingFileId(null);
    }
  };

  const toggleClassroom = (id: string) => {
    setClassroomIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const busy = saving || uploading !== null;
  const audienceCount = classroomIds.length + studentEmails.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[94dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{noteToEdit ? "Edit notes" : "New notes"}</DialogTitle>
          <DialogDescription>
            Upload photos of pages, link a PDF from Google Drive, choose who gets them,
            then publish. Nothing reaches a student until you do.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-0.5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. What the notes are */}
          <section className="space-y-4">
            <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-navy/70">
              1. About these notes
            </h3>

            <div>
              <Label htmlFor="note-title" className="text-xs font-semibold text-brand-navy">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_NOTE_TITLE}
                placeholder="e.g. Rotational Motion — Chapter 7 summary"
                className="mt-1.5 h-10 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="note-subject" className="text-xs font-semibold text-brand-navy">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="note-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  className="mt-1.5 h-10 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="note-icon" className="text-xs font-semibold text-brand-navy">
                  Icon
                </Label>
                <Select value={iconName} onValueChange={setIconName}>
                  <SelectTrigger id="note-icon" className="mt-1.5 h-10">
                    <SelectValue>
                      <span className="flex items-center gap-2 text-sm">
                        <SubjectIcon name={iconName} className="h-4 w-4 text-brand-blue" />
                        <span>{iconName}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(SUBJECT_ICONS).map((key) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <SubjectIcon name={key} className="h-4 w-4 text-brand-blue" />
                          <span>{key}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label
                htmlFor="note-description"
                className="text-xs font-semibold text-brand-navy"
              >
                What is in them
              </Label>
              <textarea
                id="note-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={MAX_NOTE_DESCRIPTION}
                placeholder="A line or two the students see under the title."
                className="mt-1.5 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/40 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
              />
            </div>

            <div>
              <Label htmlFor="note-link" className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
                <Link2 className="h-3.5 w-3.5 text-brand-blue" />
                PDF or companion link (optional)
              </Label>
              <Input
                id="note-link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/… or a lecture recording"
                className="mt-1.5 h-10 text-sm"
              />
              <p className="mt-1 text-[11px] text-brand-ink/55">
                PDFs are shared as a link, never uploaded. Put the PDF on Google Drive,
                share it as &ldquo;Anyone with the link &rarr; Viewer&rdquo;, and paste the link here.
              </p>
            </div>
          </section>

          {/* 2. Files */}
          <section className="space-y-3 border-t border-brand-border pt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-navy/70">
                2. Files ({files.length}/{MAX_NOTE_FILES})
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || files.length >= MAX_NOTE_FILES}
                className="h-9 gap-1.5 border-brand-border text-xs text-brand-navy"
              >
                <ImagePlus className="h-3.5 w-3.5 text-brand-blue" />
                Add photos
              </Button>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-page p-3 text-xs text-brand-ink/75">
                <AtomMark size={16} strokeColor="#0A4B8C" dotColor="#2E9CD8" animate />
                <span>
                  Uploading file {Math.min(uploading.done + 1, uploading.total)} of{" "}
                  {uploading.total}…
                </span>
              </div>
            )}

            {files.length === 0 && !uploading ? (
              <p className="rounded-lg border border-dashed border-brand-border bg-brand-page p-4 text-center text-xs text-brand-ink/60">
                No photos yet. Photos are compressed before they are uploaded, and must be
                under {formatBytes(MAX_NOTE_FILE_BYTES)} each. For a PDF, use the link above.
              </p>
            ) : (
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border border-brand-border bg-white p-2.5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-border bg-brand-page">
                      {file.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.thumbUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-brand-navy/70" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-brand-navy">
                        {file.originalName}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase text-brand-ink/55">
                        {file.format}
                        {file.bytes ? ` · ${formatBytes(file.bytes)}` : ""}
                      </p>
                    </div>
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[11px] font-medium text-brand-blue hover:underline"
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      disabled={removingFileId === file.id}
                      aria-label={`Remove ${file.originalName}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Audience */}
          <section className="space-y-3 border-t border-brand-border pt-5">
            <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-brand-navy/70">
              3. Who gets them ({audienceCount} selected)
            </h3>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
                <Users className="h-3.5 w-3.5 text-brand-blue" />
                Classrooms
              </p>
              {classrooms.length === 0 ? (
                <p className="rounded-lg border border-dashed border-brand-border bg-brand-page p-3 text-xs text-brand-ink/60">
                  No classrooms yet. Create one under Classrooms to share notes with a whole
                  batch at once.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {classrooms.map((c) => {
                    const checked = classroomIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        role="group"
                        onClick={() => toggleClassroom(c.id)}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                          checked
                            ? "border-brand-blue bg-brand-tint/60"
                            : "border-brand-border bg-white hover:bg-brand-page"
                        }`}
                      >
                        <span className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleClassroom(c.id)}
                            aria-label={`Share with ${c.name}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-brand-navy">
                            {c.name}
                            {!c.active && (
                              <span className="ml-1.5 text-[10px] font-normal text-brand-ink/50">
                                (archived)
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-brand-ink/60">
                            {c.memberCount} student{c.memberCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-brand-navy">
                Individual students (on top of the classrooms above)
              </p>
              <StudentPicker
                students={students}
                selected={studentEmails}
                onChange={setStudentEmails}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="border-t border-brand-border pt-4">
          {savedAt && !error && (
            <span className="mr-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved as a draft. Publish it from the list when you are ready.
            </span>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={busy}
            className="bg-brand-navy text-white hover:bg-brand-navy/90"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <AtomMark size={16} strokeColor="#FFFFFF" dotColor="#87CEEB" animate />
                <span>Saving…</span>
              </span>
            ) : noteToEdit ? (
              "Save changes"
            ) : (
              "Save notes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The publish time the scheduler starts from: the next full hour. */
export function defaultScheduleValue(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toDateTimeLocalValue(d);
}
