import { driveFileId } from "./test-resource";

/**
 * A video explanation's link, made embeddable: YouTube (watch, youtu.be,
 * shorts, embed links) through its privacy-enhanced player, and Google Drive
 * files through Drive's own preview. Any other https link is shown as a plain
 * link; null when it is not a link at all.
 */
export function videoEmbed(url: string): { embed: string | null; href: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");

  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/);
      id = m?.[1] ?? null;
    }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) {
    const start = Number((u.searchParams.get("t") ?? "").replace(/s$/, ""));
    return {
      embed: `https://www.youtube-nocookie.com/embed/${id}${start > 0 ? `?start=${Math.floor(start)}` : ""}`,
      href: u.toString(),
    };
  }

  const drive = driveFileId(u.toString());
  if (drive) return { embed: `https://drive.google.com/file/d/${drive}/preview`, href: u.toString() };

  return { embed: null, href: u.toString() };
}
