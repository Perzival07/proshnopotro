import { NextResponse, type NextRequest } from "next/server";
import { getVerifiedSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getVisibleNote } from "@/lib/note-access";
import { signedNoteUrl } from "@/lib/cloudinary";
import { pdfResponse } from "@/lib/pdf-response";

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

  return pdfResponse(file, file.originalName, {
    download: request.nextUrl.searchParams.get("download") === "1",
  });
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
