/**
 * Turning a tutor-pasted Google URL into something the student page can use.
 *
 * Three shapes are supported:
 *   GOOGLE_FORM - answered online, inside the form.
 *   GOOGLE_DOC  - a written paper: read it, answer on paper, send it back.
 *   PDF         - a written paper shared as a PDF on Google Drive. PDFs are
 *                 linked, never uploaded: the portal stores no copy.
 *
 * Google serves different URLs for viewing and for embedding, and the viewing
 * URL refuses to render in an iframe. The conversions below are what make an
 * in-page preview possible at all.
 */

export type TestFormat = "GOOGLE_FORM" | "GOOGLE_DOC" | "PDF";

export const TEST_FORMATS: readonly TestFormat[] = ["GOOGLE_FORM", "GOOGLE_DOC", "PDF"];

/** A paper the student reads and answers on paper, rather than online. */
export function isWrittenPaper(format: TestFormat): boolean {
  return format !== "GOOGLE_FORM";
}

/** Accepts the URL shapes Google actually hands out for forms. */
export function isGoogleFormUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    if (u.hostname === "forms.gle") return u.pathname.length > 1;
    return (
      (u.hostname === "docs.google.com" || u.hostname === "www.docs.google.com") &&
      u.pathname.startsWith("/forms/")
    );
  } catch {
    return false;
  }
}

/** Accepts Google Docs URLs (and the short docs.app.goo.gl form). */
export function isGoogleDocUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    return (
      (u.hostname === "docs.google.com" || u.hostname === "www.docs.google.com") &&
      (u.pathname.startsWith("/document/") ||
        u.pathname.startsWith("/presentation/") ||
        u.pathname.startsWith("/spreadsheets/"))
    );
  } catch {
    return false;
  }
}

/**
 * The file id in a Google Drive file link, or null. Drive hands out
 * drive.google.com/file/d/<id>/view links from "Share", and older
 * open?id=<id> / uc?id=<id> ones still circulate.
 */
export function driveFileId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" || u.hostname !== "drive.google.com") return null;
    const fromPath = u.pathname.match(/^\/file\/d\/([\w-]{10,})(?:\/|$)/);
    const id = fromPath?.[1] ?? (/^\/(open|uc)\/?$/.test(u.pathname) ? u.searchParams.get("id") : null);
    return id && /^[\w-]{10,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Accepts a Google Drive file link, which is how a PDF paper is shared. */
export function isDriveFileUrl(url: string): boolean {
  return driveFileId(url) !== null;
}

/**
 * What kind of paper a pasted link is, or null when it is none of the three.
 * The tutor pastes one link and never picks a type: the link itself says
 * which it is, so the two can never disagree.
 */
export function detectTestFormat(url: string): TestFormat | null {
  if (isGoogleFormUrl(url)) return "GOOGLE_FORM";
  if (isGoogleDocUrl(url)) return "GOOGLE_DOC";
  if (isDriveFileUrl(url)) return "PDF";
  return null;
}

export function isValidResourceUrl(url: string, format: TestFormat): boolean {
  if (format === "PDF") return isDriveFileUrl(url);
  return format === "GOOGLE_FORM" ? isGoogleFormUrl(url) : isGoogleDocUrl(url);
}

/**
 * The URL to put in an iframe. Returns null when the link cannot be embedded
 * (a forms.gle shortlink, for instance), so callers can fall back to a button.
 */
export function toEmbedUrl(url: string, format: TestFormat): string | null {
  if (format === "PDF") {
    // Drive's own viewer, which renders the PDF on phones too.
    const id = driveFileId(url);
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }

  if (format === "GOOGLE_FORM") {
    // Shortlinks redirect, and the redirect target is what refuses to frame.
    if (u.hostname === "forms.gle") return null;
    if (!isGoogleFormUrl(url)) return null;
    u.searchParams.set("embedded", "true");
    return u.toString();
  }

  if (!isGoogleDocUrl(url)) return null;
  // /edit and /viewform send X-Frame-Options; /preview is the embeddable one.
  u.pathname = u.pathname.replace(/\/(edit|view|preview)\/?$/, "/preview");
  if (!u.pathname.endsWith("/preview")) {
    u.pathname = u.pathname.replace(/\/?$/, "/preview");
  }
  u.search = "";
  u.hash = "";
  return u.toString();
}

export const FORMAT_LABELS: Record<TestFormat, string> = {
  GOOGLE_FORM: "Google Form (answered online)",
  GOOGLE_DOC: "Google Doc (written paper)",
  PDF: "PDF link (written paper)",
};
