/**
 * Notes: study material the tutor shares with a classroom.
 *
 * A note is a title, an optional description, any number of uploaded pages
 * (photographed board work, a scanned worksheet, a PDF) and an optional link.
 * It is shared with whole classrooms, and with named students on top of those.
 *
 * Nothing reaches a student until the note is published. Publishing carries a
 * time, so a note written on Sunday evening can be set to appear on Monday
 * morning -- and then every student in the batch gets it at the same instant
 * rather than whenever the tutor happened to finish typing.
 *
 * Every rule here is a pure function of the note and `now`, so the server
 * (which enforces them) and the pages (which only display them) agree.
 */

/** Files accepted in one note. */
export const MAX_NOTE_FILES = 25;

/**
 * Largest single file, in bytes. Cloudinary's free plan rejects anything over
 * 10 MB, so a larger file would fail at the upload rather than here, where the
 * tutor can be told why.
 */
export const MAX_NOTE_FILE_BYTES = 10 * 1024 * 1024;

export const MAX_NOTE_TITLE = 120;
export const MAX_NOTE_DESCRIPTION = 2000;

/** What the tutor may attach. Images are re-encoded to JPEG before upload. */
export const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.pdf";

const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"];

/** Normalizes ".PDF", "pdf " and "JPG" to a bare lowercase extension. */
function cleanFormat(format: string): string {
  return (format || "").trim().toLowerCase().replace(/^\./, "");
}

/** True for a file extension this portal will store as a note page. */
export function isAllowedNoteFormat(format: string): boolean {
  const f = cleanFormat(format);
  return f === "pdf" || IMAGE_FORMATS.includes(f);
}

/**
 * Which Cloudinary resource type a file is stored under.
 *
 * PDFs go up as `raw`, not as `image`. Cloudinary can rasterize a PDF, which
 * would give a nice first-page thumbnail, but delivery of PDFs through the
 * image pipeline is switched off by default on new accounts -- so that path
 * would leave students looking at a note they cannot open, for a reason
 * nothing in this app could explain. `raw` is delivered whatever the account
 * settings say, and the browser opens it in its own PDF viewer.
 */
export function resourceTypeFor(format: string): "image" | "raw" {
  return cleanFormat(format) === "pdf" ? "raw" : "image";
}

export function isPdf(format: string): boolean {
  return resourceTypeFor(format) === "raw";
}

/** The Cloudinary folder one note's files live in. */
export function noteFolder(noteId: string): string {
  return `proshnopotro/notes/${noteId}`;
}

/**
 * Whether a public id the browser reports really sits in this note's folder.
 * The upload signature pins the folder, but the save call is a separate
 * request, so it is checked again rather than trusted.
 */
export function isInNoteFolder(publicId: string, noteId: string): boolean {
  const prefix = `${noteFolder(noteId)}/`;
  return (
    publicId.startsWith(prefix) &&
    publicId.length > prefix.length &&
    !publicId.slice(prefix.length).includes("..")
  );
}

export type NoteState = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export interface PublishableNote {
  publishedAt?: Date | string | null;
}

export function noteState(note: PublishableNote, now: Date = new Date()): NoteState {
  if (!note.publishedAt) return "DRAFT";
  return new Date(note.publishedAt).getTime() <= now.getTime() ? "PUBLISHED" : "SCHEDULED";
}

/** Whether a student may see this note at all. */
export function isNoteVisible(note: PublishableNote, now: Date = new Date()): boolean {
  return noteState(note, now) === "PUBLISHED";
}

export const NOTE_STATE_LABELS: Record<NoteState, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

/**
 * A link the tutor may attach to a note.
 *
 * Only https, and only an address with a host: a note link is opened by
 * students on their phones, so `javascript:` and friends have no business
 * being stored here at all.
 */
export function isValidNoteLink(url: string): boolean {
  try {
    const u = new URL((url || "").trim());
    return u.protocol === "https:" && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export interface NoteInput {
  title: string;
  subject: string;
  description?: string | null;
  iconName?: string | null;
  linkUrl?: string | null;
}

export interface NormalizedNote {
  title: string;
  subject: string;
  description: string | null;
  iconName: string;
  linkUrl: string | null;
}

export type NoteValidation =
  | { ok: true; value: NormalizedNote }
  | { ok: false; error: string };

export function validateNote(input: NoteInput): NoteValidation {
  const title = (input.title || "").trim();
  const subject = (input.subject || "").trim();
  const description = (input.description || "").trim();
  const linkUrl = (input.linkUrl || "").trim();

  if (!title) return { ok: false, error: "Give these notes a title." };
  if (title.length > MAX_NOTE_TITLE) {
    return { ok: false, error: `The title must be ${MAX_NOTE_TITLE} characters or fewer.` };
  }
  if (!subject) return { ok: false, error: "Say which subject these notes are for." };
  if (description.length > MAX_NOTE_DESCRIPTION) {
    return {
      ok: false,
      error: `The description must be ${MAX_NOTE_DESCRIPTION} characters or fewer.`,
    };
  }
  if (linkUrl && !isValidNoteLink(linkUrl)) {
    return {
      ok: false,
      error: "The link must be a full https:// address, for example https://drive.google.com/...",
    };
  }

  return {
    ok: true,
    value: {
      title,
      subject,
      description: description || null,
      iconName: (input.iconName || "").trim() || "FileText",
      linkUrl: linkUrl || null,
    },
  };
}

export interface PublishableContents {
  fileCount: number;
  linkUrl?: string | null;
  classroomCount: number;
  studentCount: number;
}

/**
 * Why a note cannot go out yet, or null when it can.
 *
 * Publishing an empty note, or one nobody is subscribed to, is always a
 * mistake rather than an intention -- it puts a card on no dashboard at all,
 * or an empty card on several.
 */
export function publishBlocker(contents: PublishableContents): string | null {
  if (contents.fileCount === 0 && !contents.linkUrl) {
    return "Add at least one file or a link before publishing.";
  }
  if (contents.classroomCount === 0 && contents.studentCount === 0) {
    return "Share these notes with at least one classroom or student before publishing.";
  }
  return null;
}

/** "2.1 MB", "812 KB" -- for the file rows. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A file name safe to store and to show back to a student: no path
 * separators, no control characters, and short enough for a table cell.
 */
export function cleanFileName(name: string): string {
  const base = (name || "").split(/[\\/]/).pop() || "";
  // eslint-disable-next-line no-control-regex
  const stripped = base.replace(/[\x00-\x1F\x7F"]/g, "").trim();
  return (stripped || "file").slice(0, 120);
}
