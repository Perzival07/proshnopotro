import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getVisibleNote } from "@/lib/note-access";
import { fetchNoteFile, signedNoteUrl } from "@/lib/cloudinary";
import { contentDisposition } from "@/lib/notes";

export const dynamic = "force-dynamic";

/**
 * Opens or downloads one file from a set of notes.
 *
 * PDFs cannot be linked to on Cloudinary's CDN while the account blocks PDF
 * delivery, so they are read through the API on the server and passed
 * straight on. The same visibility rule as the note's page applies: a tutor
 * may open any file, a student only one from a published note shared with
 * them, and anyone else gets the same "not found" whether the file exists or
 * not.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { noteId: string; fileId: string } }
) {
  const user = await getVerifiedSession();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const file = await findFileFor(user, params.noteId, params.fileId);
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Photos are delivered by the CDN without trouble; only PDFs need the detour.
  if (file.resourceType !== "raw") {
    const url = signedNoteUrl(file);
    return url
      ? NextResponse.redirect(url)
      : new NextResponse("File storage is not set up.", { status: 503 });
  }

  let upstream: Response | null;
  try {
    upstream = await fetchNoteFile(file);
  } catch (error) {
    console.error("Could not reach Cloudinary for a note file:", error);
    return new NextResponse("This file could not be loaded. Please try again.", {
      status: 502,
    });
  }
  if (!upstream) {
    return new NextResponse("File storage is not set up.", { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    console.error(
      `Cloudinary refused note file ${file.id}: ${upstream.status} ${
        upstream.headers.get("x-cld-error") ?? ""
      }`
    );
    return new NextResponse("This file could not be loaded. Please try again.", {
      status: 502,
    });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": contentDisposition(file.originalName, download),
    // Only ever for the person who asked: a shared cache must not hand one
    // student's notes to the next visitor.
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  // Streamed rather than buffered, so a 10 MB PDF is never held in memory.
  // No Content-Length on purpose: Vercel caps a function's response at 4.5 MB
  // unless it is streamed, and a fixed length would forfeit the exemption.
  return new NextResponse(upstream.body, { status: 200, headers });
}

async function findFileFor(
  user: { email: string; role: string; profileComplete: boolean },
  noteId: string,
  fileId: string
) {
  if (user.role === "ADMIN") {
    return prisma.noteFile.findFirst({ where: { id: fileId, noteId } });
  }
  if (!user.profileComplete) return null;

  const note = await getVisibleNote(user.email, noteId);
  return note?.files.find((f) => f.id === fileId) ?? null;
}
