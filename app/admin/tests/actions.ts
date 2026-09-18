"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  TEST_FORMATS,
  isValidResourceUrl,
  toEmbedUrl,
  type TestFormat,
} from "@/lib/test-resource";
import { parseDurationMinutes } from "@/lib/exam-timer";
import { destroyNoteFile } from "@/lib/cloudinary";
import { NO_PAPER, paperFile } from "@/lib/question-paper";

export interface TestInput {
  title: string;
  subject: string;
  description?: string;
  iconName: string;
  format: TestFormat;
  formUrl: string;
  /** Minutes the student gets once they open the paper. Blank/null = untimed. */
  durationMinutes?: number | string | null;
  proctored?: boolean;
  active?: boolean;
}

/** Shared validation for create and update. Returns an error string or null. */
function validateTestInput(data: TestInput): string | null {
  if (!TEST_FORMATS.includes(data.format)) {
    return "Choose whether this is a Google Form, a Google Doc or a PDF.";
  }
  if (!data.title.trim() || !data.subject.trim()) {
    return "Title and Subject are required.";
  }
  const duration = parseDurationMinutes(data.durationMinutes);
  if (duration.error) return duration.error;

  if (!data.formUrl.trim()) {
    return "The question paper URL is required.";
  }
  if (!isValidResourceUrl(data.formUrl, data.format)) {
    return data.format === "GOOGLE_FORM"
      ? "That does not look like a Google Form link (expected docs.google.com/forms/... or forms.gle/...)."
      : data.format === "PDF"
        ? "That does not look like a Google Drive file link (expected drive.google.com/file/d/...). Upload the PDF to Drive and paste its share link."
        : "That does not look like a Google Doc link (expected docs.google.com/document/...).";
  }
  // The paper is shown inside the portal and nowhere else, so a link that
  // cannot be embedded would leave the student with nothing to open.
  if (!toEmbedUrl(data.formUrl, data.format)) {
    return data.format === "GOOGLE_FORM"
      ? "A forms.gle short link cannot be displayed inside the portal. Open the form, choose Send \u2192 link, and paste the full docs.google.com/forms/... address."
      : "That Google Doc link cannot be displayed inside the portal. Paste the standard docs.google.com/document/... address.";
  }
  return null;
}

/**
 * Removes a PDF that was uploaded to a test before papers became links-only.
 * Best effort, like note files: a leftover file nobody has a link to must not
 * block saving the test.
 */
async function discardPaper(paper: { paperPublicId: string | null; paperVersion: number | null }) {
  const file = paperFile(paper);
  if (file) await destroyNoteFile(file);
}

export async function createTest(data: TestInput) {
  await requireAdmin();

  const invalid = validateTestInput(data);
  if (invalid) return { error: invalid };

  try {
    const test = await prisma.test.create({
      data: {
        title: data.title.trim(),
        subject: data.subject.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName || "BookOpen",
        format: data.format,
        formUrl: data.formUrl.trim(),
        durationMinutes: parseDurationMinutes(data.durationMinutes).minutes,
        proctored: data.proctored ?? true,
        active: data.active ?? true,
      },
    });

    revalidatePath("/admin/tests");
    revalidatePath("/admin/assign");
    revalidatePath("/");
    return { success: true, testId: test.id };
  } catch (error) {
    console.error("Error creating test:", error);
    return { error: "Failed to create test in database." };
  }
}

export async function updateTest(id: string, data: TestInput) {
  await requireAdmin();

  const invalid = validateTestInput(data);
  if (invalid) return { error: invalid };

  try {
    const previous = await prisma.test.findUnique({
      where: { id },
      select: { paperPublicId: true, paperVersion: true },
    });

    await prisma.test.update({
      where: { id },
      data: {
        title: data.title.trim(),
        subject: data.subject.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName || "BookOpen",
        format: data.format,
        formUrl: data.formUrl.trim(),
        // Papers are links now; an older uploaded file is dropped.
        ...NO_PAPER,
        durationMinutes: parseDurationMinutes(data.durationMinutes).minutes,
        proctored: data.proctored ?? true,
        active: data.active ?? true,
      },
    });

    if (previous?.paperPublicId) await discardPaper(previous);

    revalidatePath("/admin/tests");
    revalidatePath("/admin/assign");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating test:", error);
    return { error: "Failed to update test." };
  }
}

export async function toggleTestActive(id: string, active: boolean) {
  await requireAdmin();

  try {
    await prisma.test.update({
      where: { id },
      data: { active },
    });

    revalidatePath("/admin/tests");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: "Failed to update test status." };
  }
}
