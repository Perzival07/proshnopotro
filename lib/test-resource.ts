/**
 * Turning a tutor-pasted Google URL into something the student page can use.
 *
 * Two shapes are supported:
 *   GOOGLE_FORM - answered online, inside the form.
 *   GOOGLE_DOC  - a written paper: read it, answer on paper, send it back.
 *
 * Google serves different URLs for viewing and for embedding, and the viewing
 * URL refuses to render in an iframe. The conversions below are what make an
 * in-page preview possible at all.
 */

export type TestFormat = "GOOGLE_FORM" | "GOOGLE_DOC";

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

export function isValidResourceUrl(url: string, format: TestFormat): boolean {
  return format === "GOOGLE_FORM" ? isGoogleFormUrl(url) : isGoogleDocUrl(url);
}

/**
 * The URL to put in an iframe. Returns null when the link cannot be embedded
 * (a forms.gle shortlink, for instance), so callers can fall back to a button.
 */
export function toEmbedUrl(url: string, format: TestFormat): string | null {
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
};
