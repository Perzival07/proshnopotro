import { NextResponse } from "next/server";
import { fetchNoteFile, type StoredNoteFile } from "@/lib/cloudinary";
import { contentDisposition } from "@/lib/notes";

/**
 * Hands a stored PDF to the browser through the portal.
 *
 * Cloudinary refuses CDN links to PDFs while the account blocks PDF delivery
 * (the default on free plans), so a PDF is read through the API on the server
 * and passed straight on. Callers decide who may see the file first; this
 * only fetches and streams it.
 */
export async function pdfResponse(
  file: StoredNoteFile,
  name: string,
  options: { download?: boolean } = {}
): Promise<NextResponse> {
  let upstream: Response | null;
  try {
    upstream = await fetchNoteFile(file);
  } catch (error) {
    console.error("Could not reach Cloudinary for a PDF:", error);
    return new NextResponse("This file could not be loaded. Please try again.", {
      status: 502,
    });
  }
  if (!upstream) {
    return new NextResponse("File storage is not set up.", { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    console.error(
      `Cloudinary refused PDF ${file.publicId}: ${upstream.status} ${
        upstream.headers.get("x-cld-error") ?? ""
      }`
    );
    return new NextResponse("This file could not be loaded. Please try again.", {
      status: 502,
    });
  }

  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition(name, Boolean(options.download)),
    // Only ever for the person who asked: a shared cache must not hand one
    // student's file to the next visitor.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  // Streamed rather than buffered, so a 10 MB PDF is never held in memory.
  // No Content-Length on purpose: Vercel caps a function's response at 4.5 MB
  // unless it is streamed, and a fixed length would forfeit the exemption.
  return new NextResponse(upstream.body, { status: 200, headers });
}
