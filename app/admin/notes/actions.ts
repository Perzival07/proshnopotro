"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  cleanFileName,
  isAllowedNoteFormat,
  isInNoteFolder,
  MAX_NOTE_FILES,
  noteFileHref,
  noteFolder,
  publishBlocker,
  resourceTypeFor,
  validateNote,
  type NoteInput,
} from "@/lib/notes";
import { parseMemberEmails } from "@/lib/classrooms";
import { destroyNoteFile, signedNoteUrl, signNoteUpload, type UploadSignature } from "@/lib/cloudinary";

/** Every surface a note change can be seen on. */
function revalidateNoteViews(noteId?: string) {
  revalidatePath("/admin/notes");
  revalidatePath("/admin/classrooms");
  revalidatePath("/notes");
  if (noteId) revalidatePath(`/notes/${noteId}`);
  revalidatePath("/");
}

// ─────────────────────────────────────────────────────────────
// THE NOTE ITSELF
// ─────────────────────────────────────────────────────────────

/**
 * Creates the note as a draft.
 *
 * Files are uploaded into a folder named after the note, so the note has to
 * exist before anything can be attached to it. Nothing is visible to a student
 * until it is published, so a draft costs nothing.
 */
export async function createNote(data: NoteInput) {
  await requireAdmin();

  const parsed = validateNote(data);
  if (!parsed.ok) return { error: parsed.error };

  try {
    const note = await prisma.note.create({ data: parsed.value });
    revalidateNoteViews();
    return { success: true, noteId: note.id };
  } catch (error) {
    console.error("Error creating note:", error);
    return { error: "Failed to create these notes." };
  }
}

export async function updateNote(id: string, data: NoteInput) {
  await requireAdmin();

  const parsed = validateNote(data);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await prisma.note.update({ where: { id }, data: parsed.value });
    revalidateNoteViews(id);
    return { success: true };
  } catch (error) {
    console.error("Error updating note:", error);
    return { error: "Failed to save the changes." };
  }
}

/**
 * Publishes a note, now or at a chosen time.
 *
 * A future time is the point of scheduling: every student in the batch gets
 * the notes at the same instant, rather than whenever the tutor finished
 * preparing them.
 */
export async function publishNote(id: string, whenIso?: string | null) {
  await requireAdmin();

  const note = await prisma.note.findUnique({
    where: { id },
    select: {
      id: true,
      linkUrl: true,
      _count: { select: { files: true, classrooms: true, students: true } },
    },
  });
  if (!note) return { error: "Those notes no longer exist." };

  const blocker = publishBlocker({
    fileCount: note._count.files,
    linkUrl: note.linkUrl,
    classroomCount: note._count.classrooms,
    studentCount: note._count.students,
  });
  if (blocker) return { error: blocker };

  let publishedAt = new Date();
  if (whenIso) {
    const when = new Date(whenIso);
    if (isNaN(when.getTime())) return { error: "That is not a valid date and time." };
    publishedAt = when;
  }

  try {
    await prisma.note.update({ where: { id }, data: { publishedAt } });
    revalidateNoteViews(id);
    return { success: true, publishedAt: publishedAt.toISOString() };
  } catch (error) {
    console.error("Error publishing note:", error);
    return { error: "Failed to publish these notes." };
  }
}

/** Takes a note back off the students' dashboards, keeping everything in it. */
export async function unpublishNote(id: string) {
  await requireAdmin();

  try {
    await prisma.note.update({ where: { id }, data: { publishedAt: null } });
    revalidateNoteViews(id);
    return { success: true };
  } catch (error) {
    console.error("Error unpublishing note:", error);
    return { error: "Failed to hide these notes." };
  }
}

export async function deleteNote(id: string) {
  await requireAdmin();

  const note = await prisma.note.findUnique({
    where: { id },
    include: { files: true },
  });
  if (!note) return { error: "Those notes no longer exist." };

  try {
    // The rows go first: they are what decides whether a student can reach
    // anything. Removing the stored files afterwards is best effort, so a
    // Cloudinary outage cannot leave a deleted note still on a dashboard.
    await prisma.note.delete({ where: { id } });
    await Promise.all(note.files.map((f) => destroyNoteFile(f)));

    revalidateNoteViews(id);
    return { success: true };
  } catch (error) {
    console.error("Error deleting note:", error);
    return { error: "Failed to delete these notes." };
  }
}

// ─────────────────────────────────────────────────────────────
// WHO GETS THEM
// ─────────────────────────────────────────────────────────────

/**
 * Replaces the audience: the classrooms these notes go to, and any individual
 * students on top of them.
 *
 * Sharing is held by email for individuals, exactly as classroom membership
 * and test assignment are, so a student can be given notes before they have
 * ever signed in.
 */
export async function setNoteAudience(
  id: string,
  classroomIds: string[],
  studentEmails: string[]
) {
  await requireAdmin();

  const note = await prisma.note.findUnique({ where: { id }, select: { id: true } });
  if (!note) return { error: "Those notes no longer exist." };

  const parsed = parseMemberEmails(studentEmails);
  if (parsed.invalid.length > 0) {
    return { error: `Not a valid email address: ${parsed.invalid[0]}` };
  }

  // A classroom deleted while this modal was open would fail the write with a
  // foreign-key error the tutor cannot act on; the ids are narrowed to the
  // ones that still exist instead.
  const existingClassrooms = await prisma.classroom.findMany({
    where: { id: { in: Array.from(new Set(classroomIds)) } },
    select: { id: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.noteClassroom.deleteMany({ where: { noteId: id } });
      await tx.noteStudent.deleteMany({ where: { noteId: id } });

      if (existingClassrooms.length > 0) {
        await tx.noteClassroom.createMany({
          data: existingClassrooms.map((c) => ({ noteId: id, classroomId: c.id })),
          skipDuplicates: true,
        });
      }
      if (parsed.valid.length > 0) {
        await tx.noteStudent.createMany({
          data: parsed.valid.map((studentEmail) => ({ noteId: id, studentEmail })),
          skipDuplicates: true,
        });
      }
    });

    revalidateNoteViews(id);
    return {
      success: true,
      classrooms: existingClassrooms.length,
      students: parsed.valid.length,
    };
  } catch (error) {
    console.error("Error saving note audience:", error);
    return { error: "Failed to save who these notes go to." };
  }
}

// ─────────────────────────────────────────────────────────────
// FILES
// ─────────────────────────────────────────────────────────────

export interface SignatureResult {
  upload?: UploadSignature;
  error?: string;
}

/** A short-lived permission to upload straight into this note's folder. */
export async function getNoteUploadSignature(noteId: string): Promise<SignatureResult> {
  await requireAdmin();

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { _count: { select: { files: true } } },
  });
  if (!note) return { error: "Those notes no longer exist." };
  if (note._count.files >= MAX_NOTE_FILES) {
    return { error: `A set of notes can hold at most ${MAX_NOTE_FILES} files.` };
  }

  const upload = signNoteUpload(noteFolder(noteId));
  if (!upload) {
    console.error(
      "Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
    return { error: "File uploads are not set up yet. Check the Cloudinary keys." };
  }
  return { upload };
}

export interface UploadedNoteFile {
  publicId: string;
  version: number;
  format: string;
  originalName: string;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface NoteFileView {
  id: string;
  originalName: string;
  format: string;
  resourceType: string;
  bytes: number | null;
  position: number;
  /** Link to the file itself: signed for photos, the portal's file route for PDFs. */
  url: string | null;
  /** Signed link to a small preview, for images only. */
  thumbUrl: string | null;
}

function toFileView(file: {
  id: string;
  noteId: string;
  originalName: string;
  format: string;
  resourceType: string;
  bytes: number | null;
  position: number;
  publicId: string;
  version: number;
}): NoteFileView {
  const isRaw = file.resourceType === "raw";
  return {
    id: file.id,
    originalName: file.originalName,
    format: file.format,
    resourceType: file.resourceType,
    bytes: file.bytes,
    position: file.position,
    url: isRaw ? noteFileHref(file.noteId, file.id) : signedNoteUrl(file),
    thumbUrl: isRaw ? null : signedNoteUrl(file, { width: 400 }),
  };
}

/** The files on a note, with freshly signed links. */
export async function listNoteFiles(
  noteId: string
): Promise<{ files?: NoteFileView[]; error?: string }> {
  await requireAdmin();

  const files = await prisma.noteFile.findMany({
    where: { noteId },
    orderBy: { position: "asc" },
  });
  return { files: files.map(toFileView) };
}

/**
 * Records files the browser has just sent to Cloudinary.
 *
 * Unlike the student answer upload this is not a one-time step -- the tutor
 * adds pages to a set of notes over several sittings -- so new files are
 * appended after the ones already there rather than replacing them.
 */
export async function saveNoteFiles(
  noteId: string,
  uploads: UploadedNoteFile[]
): Promise<{ files?: NoteFileView[]; error?: string }> {
  await requireAdmin();

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, _count: { select: { files: true } } },
  });
  if (!note) return { error: "Those notes no longer exist." };

  if (!Array.isArray(uploads) || uploads.length === 0) {
    return { error: "No files were uploaded." };
  }
  if (note._count.files + uploads.length > MAX_NOTE_FILES) {
    return { error: `A set of notes can hold at most ${MAX_NOTE_FILES} files.` };
  }

  for (const upload of uploads) {
    if (
      typeof upload?.publicId !== "string" ||
      !isInNoteFolder(upload.publicId, noteId) ||
      !Number.isInteger(upload.version) ||
      typeof upload.format !== "string" ||
      !isAllowedNoteFormat(upload.format)
    ) {
      return { error: "One of the files could not be verified. Please try again." };
    }
  }

  const toInt = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;

  try {
    // Positions continue from the highest one already stored, so a second
    // batch lands after the first rather than interleaving with it.
    const last = await prisma.noteFile.findFirst({
      where: { noteId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const start = (last?.position ?? -1) + 1;

    await prisma.noteFile.createMany({
      data: uploads.map((upload, index) => ({
        noteId,
        publicId: upload.publicId,
        version: upload.version,
        format: upload.format.toLowerCase().replace(/^\./, ""),
        resourceType: resourceTypeFor(upload.format),
        originalName: cleanFileName(upload.originalName),
        bytes: toInt(upload.bytes),
        width: toInt(upload.width),
        height: toInt(upload.height),
        position: start + index,
      })),
    });
  } catch (error) {
    console.error("Error saving note files:", error);
    return { error: "The files were sent but could not be saved. Please try again." };
  }

  revalidateNoteViews(noteId);
  return listNoteFiles(noteId);
}

export async function deleteNoteFile(fileId: string) {
  await requireAdmin();

  const file = await prisma.noteFile.findUnique({ where: { id: fileId } });
  if (!file) return { error: "That file has already been removed." };

  try {
    await prisma.noteFile.delete({ where: { id: fileId } });
    await destroyNoteFile(file);
    revalidateNoteViews(file.noteId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting note file:", error);
    return { error: "Failed to remove that file." };
  }
}
