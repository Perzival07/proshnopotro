import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SubjectIcon } from "@/components/SubjectIcon";
import { getVisibleNote } from "@/lib/note-access";
import { signedNoteUrl } from "@/lib/cloudinary";
import { toEmbedUrl } from "@/lib/test-resource";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  ImageOff,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentNotePage({
  params,
}: {
  params: { noteId: string };
}) {
  const user = await requireCompleteStudent();

  // A note that is still a draft, still scheduled, or shared with somebody
  // else is simply not found: the reply is the same either way, so nothing
  // here tells a student what exists but is not theirs.
  const note = await getVisibleNote(user.email, params.noteId);
  if (!note) notFound();

  // Photo links are minted per request and only for a student the note is
  // shared with, so nothing openable is ever baked into the page for anyone
  // else.
  const images = note.files.map((file) => ({
    id: file.id,
    name: file.originalName,
    url: signedNoteUrl(file),
    thumbUrl: signedNoteUrl(file, { width: 600 }),
  }));

  // A PDF is shared as a Google Drive link rather than uploaded; Drive's own
  // viewer shows it here, on phones too, so the student need not leave.
  const pdfPreviewUrl = note.linkUrl ? toEmbedUrl(note.linkUrl, "PDF") : null;

  return (
    <div className="flex min-h-screen flex-col justify-between bg-brand-page">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink/70 transition-colors hover:text-brand-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All notes
        </Link>

        <header className="mt-4 border-b border-brand-border pb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
              <SubjectIcon name={note.iconName} className="h-6 w-6 text-brand-navy" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold text-brand-navy sm:text-2xl">
                {note.title}
              </h1>
              <p className="mt-1 text-xs text-brand-ink/60">
                {note.subject}
                {note.publishedAt && <> &middot; shared {formatDate(note.publishedAt)}</>}
              </p>
              {note.classrooms.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {note.classrooms.map((link) => (
                    <span
                      key={link.classroom.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-tint px-2.5 py-1 text-[11px] font-medium text-brand-navy"
                    >
                      <Users className="h-3 w-3 text-brand-blue" />
                      {link.classroom.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {note.description && (
            <p className="text-body mt-4 whitespace-pre-line text-sm leading-relaxed text-brand-ink/80">
              {note.description}
            </p>
          )}

          {note.linkUrl && (
            <a
              href={note.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white px-4 py-2.5 text-xs font-semibold text-brand-navy shadow-xs transition-colors hover:bg-brand-tint"
            >
              <ExternalLink className="h-4 w-4 text-brand-blue" />
              {pdfPreviewUrl ? "Open the PDF in Google Drive" : "Open the linked material"}
            </a>
          )}
        </header>

        {pdfPreviewUrl && (
          <section className="mt-8">
            <h2 className="mb-3 font-heading text-sm font-semibold text-brand-navy">PDF</h2>
            <iframe
              src={pdfPreviewUrl}
              title={`${note.title} (PDF)`}
              className="h-[70dvh] w-full rounded-xl border border-brand-border bg-white"
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="autoplay"
            />
          </section>
        )}

        {images.length === 0 && !note.linkUrl && (
          <div className="mt-8 rounded-xl border border-dashed border-brand-border bg-white p-10 text-center">
            <ImageOff className="mx-auto h-8 w-8 text-brand-ink/40" />
            <p className="mt-3 text-xs text-brand-ink/70">
              There are no files in these notes yet.
            </p>
          </div>
        )}

        {images.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-heading text-sm font-semibold text-brand-navy">
              Pages ({images.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((file, index) => (
                <a
                  key={file.id}
                  href={file.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-[3/4] overflow-hidden rounded-xl border border-brand-border bg-white shadow-xs transition-shadow hover:shadow-card-hover"
                >
                  {file.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.thumbUrl}
                      alt={file.name || `Page ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-brand-ink/50">
                      Page {index + 1}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-brand-navy/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-brand-ink/55">
              Tap a page to see it full size.
            </p>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
