import React from "react";
import Link from "next/link";
import { SubjectIcon } from "@/components/SubjectIcon";
import { formatDate } from "@/lib/utils";
import { FileText, Images, Link2, Users } from "lucide-react";

export interface NoteCardData {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  iconName: string;
  linkUrl: string | null;
  publishedAt: Date | string | null;
  fileCount: number;
  imageCount: number;
  /** The classrooms this reached the student through, if any. */
  classroomNames: string[];
}

export function NoteCard({ note }: { note: NoteCardData }) {
  const pdfCount = note.fileCount - note.imageCount;

  return (
    <Link
      href={`/notes/${note.id}`}
      className="group flex flex-col rounded-xl border border-brand-border bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover focus-ring"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
          <SubjectIcon name={note.iconName} className="h-5 w-5 text-brand-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-semibold text-brand-navy group-hover:text-brand-blue">
            {note.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-ink/60">
            {note.subject}
            {note.publishedAt && <> &middot; {formatDate(note.publishedAt)}</>}
          </p>
        </div>
      </div>

      {note.description && (
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-brand-ink/75">
          {note.description}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        {note.imageCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
            <Images className="h-3 w-3" />
            {note.imageCount} page{note.imageCount === 1 ? "" : "s"}
          </span>
        )}
        {pdfCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
            <FileText className="h-3 w-3" />
            {pdfCount} PDF{pdfCount === 1 ? "" : "s"}
          </span>
        )}
        {note.linkUrl && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-page px-2.5 py-1 font-medium text-brand-ink/75">
            <Link2 className="h-3 w-3" />
            Link
          </span>
        )}
        {note.classroomNames.slice(0, 2).map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-tint px-2.5 py-1 font-medium text-brand-navy"
          >
            <Users className="h-3 w-3 text-brand-blue" />
            {name}
          </span>
        ))}
      </div>
    </Link>
  );
}
