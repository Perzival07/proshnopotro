import React from "react";
import { listChapters } from "./actions";
import { SyllabusClient } from "./SyllabusClient";
import { BOARDS, CLASS_LEVELS, ncertPreset } from "@/lib/syllabus";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function SyllabusPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ board?: string; class?: string; subject?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  // Owner only: the layout lets tutors in, so every page says who may see it.
  await requireAdmin();
  const board = (BOARDS as readonly string[]).includes(searchParams.board ?? "") ? searchParams.board! : "CBSE";
  const classLevel = (CLASS_LEVELS as readonly string[]).includes(searchParams.class ?? "") ? searchParams.class! : "12";
  const subject = searchParams.subject?.trim() || "Physics";
  const chapters = await listChapters(board, classLevel, subject);
  return (
    <SyllabusClient
      key={`${board}|${classLevel}|${subject}`}
      board={board}
      classLevel={classLevel}
      subject={subject}
      initial={chapters}
      hasPreset={ncertPreset(classLevel, subject) !== null}
    />
  );
}
