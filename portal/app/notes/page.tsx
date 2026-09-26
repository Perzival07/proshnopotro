import React from "react";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/student/NoteCard";
import { SubjectIcon } from "@/components/SubjectIcon";
import { getStudentClassrooms, getVisibleNotes } from "@/lib/note-access";
import { BookOpen, FileText, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentNotesPage() {
  const user = await requireCompleteStudent();

  const [notes, classrooms] = await Promise.all([
    getVisibleNotes(user.email),
    getStudentClassrooms(user.email),
  ]);

  const cards: NoteCardData[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    subject: note.subject,
    description: note.description,
    iconName: note.iconName,
    linkUrl: note.linkUrl,
    publishedAt: note.publishedAt,
    fileCount: note.files.length,
    classroomNames: note.classrooms.map((link) => link.classroom.name),
  }));

  return (
    <div className="flex min-h-screen flex-col justify-between bg-brand-page">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-brand-border pb-6">
          <h1 className="font-heading text-2xl font-semibold text-brand-navy sm:text-3xl">
            Notes
          </h1>
          <p className="text-body mt-1 text-sm text-brand-ink/70">
            Everything your tutor has shared with you and your class.
          </p>
        </div>

        {/* The batches this student is in. Their notes and tests arrive
            together, so it is worth saying which groups they belong to. */}
        {classrooms.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-semibold text-brand-navy">
              <Users className="h-4 w-4 text-brand-blue" />
              <span>Your classrooms</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classrooms.map((classroom) => (
                <div
                  key={classroom.id}
                  className="flex items-start gap-3 rounded-xl border border-brand-border bg-white p-4 shadow-xs"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                    <SubjectIcon name={classroom.iconName} className="h-4 w-4 text-brand-navy" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-xs font-semibold text-brand-navy">
                      {classroom.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-brand-ink/65">
                      {classroom.description || classroom.subject || "Your batch"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {cards.length === 0 ? (
          <div className="mx-auto my-12 flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-brand-border bg-white p-12 text-center shadow-xs">
            <div className="mb-4 rounded-full bg-brand-tint/60 p-4">
              <FileText className="h-10 w-10 text-brand-navy/70" />
            </div>
            <h2 className="mb-2 font-heading text-lg font-semibold text-brand-navy">
              No notes yet
            </h2>
            <p className="text-body max-w-md text-sm leading-relaxed text-brand-ink/70">
              When your tutor shares notes with your class, they appear here — everyone in
              the batch gets them at the same time.
            </p>
          </div>
        ) : (
          <section className="space-y-6">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-brand-navy">
              <BookOpen className="h-5 w-5 text-brand-blue" />
              <span>Shared with you ({cards.length})</span>
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
