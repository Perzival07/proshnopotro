"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { detectTestFormat, toEmbedUrl, type TestFormat } from "@/lib/test-resource";
import { SCHEME_PRESETS, type SchemePreset } from "@/lib/marking";
import { parseDurationMinutes } from "@/lib/exam-timer";
import { destroyNoteFile } from "@/lib/cloudinary";
import { NO_PAPER, paperFile } from "@/lib/question-paper";

export interface TestInput {
  title: string;
  subject: string;
  description?: string;
  iconName: string;
  /** A paper behind a link, or questions written in the portal. */
  mode?: "LINK" | "QUESTIONS";
  /** LINK only: the question paper link. Its type is worked out from the link itself. */
  formUrl: string;
  /** QUESTIONS only: the marking scheme to start from when the test is created. */
  schemePreset?: SchemePreset;
  /** QUESTIONS only. */
  resultRelease?: "INSTANT" | "ON_RELEASE";
  /** Whether students upload photos of answer sheets after the paper. */
  answerSheets?: boolean;
  /** Minutes the student gets once they open the paper. Blank/null = untimed. */
  durationMinutes?: number | string | null;
  proctored?: boolean;
  active?: boolean;
}

/**
 * Shared validation for create and update. Returns an error, or the paper's
 * type as read from its link -- the server decides the type, never the form.
 */
function validateTestInput(data: TestInput): { error: string } | { format: TestFormat } {
  if (!data.title.trim() || !data.subject.trim()) {
    return { error: "Title and Subject are required." };
  }
  const duration = parseDurationMinutes(data.durationMinutes);
  if (duration.error) return { error: duration.error };

  // A paper written in the portal has no link to check.
  if (data.mode === "QUESTIONS") return { format: "QUESTIONS" };

  if (!data.formUrl.trim()) {
    return { error: "The question paper link is required." };
  }
  const format = detectTestFormat(data.formUrl);
  if (!format) {
    return {
      error:
        "That link is not a Google Form, a Google Doc or a Google Drive file. Paste a docs.google.com/forms/..., docs.google.com/document/... or drive.google.com/file/d/... link.",
    };
  }
  // The paper is shown inside the portal and nowhere else, so a link that
  // cannot be embedded would leave the student with nothing to open.
  if (!toEmbedUrl(data.formUrl, format)) {
    return {
      error:
        format === "GOOGLE_FORM"
          ? "A forms.gle short link cannot be displayed inside the portal. Open the form, choose Send \u2192 link, and paste the full docs.google.com/forms/... address."
          : "That Google Doc link cannot be displayed inside the portal. Paste the standard docs.google.com/document/... address.",
    };
  }
  return { format };
}

/**
 * The settings that only mean something for questions written in the portal.
 * The marking scheme is only seeded on create; after that it is edited on the
 * paper's own page, where changing it re-marks attempts.
 */
function questionSettings(data: TestInput, format: TestFormat, creating: boolean) {
  if (format !== "QUESTIONS") return { answerSheets: data.answerSheets ?? true };
  const preset = data.schemePreset && SCHEME_PRESETS[data.schemePreset] ? data.schemePreset : "JEE_MAIN";
  return {
    resultRelease: data.resultRelease === "INSTANT" ? ("INSTANT" as const) : ("ON_RELEASE" as const),
    answerSheets: data.answerSheets ?? false,
    ...(creating ? { markingScheme: JSON.parse(JSON.stringify(SCHEME_PRESETS[preset].scheme)) } : {}),
  };
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

  const checked = validateTestInput(data);
  if ("error" in checked) return { error: checked.error };

  try {
    const test = await prisma.test.create({
      data: {
        title: data.title.trim(),
        subject: data.subject.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName || "BookOpen",
        format: checked.format,
        formUrl: checked.format === "QUESTIONS" ? "" : data.formUrl.trim(),
        durationMinutes: parseDurationMinutes(data.durationMinutes).minutes,
        proctored: data.proctored ?? true,
        active: data.active ?? true,
        ...questionSettings(data, checked.format, true),
      },
    });

    revalidatePath("/admin/tests");
    revalidatePath("/admin/assign");
    revalidatePath("/");
    return { success: true, testId: test.id, format: checked.format };
  } catch (error) {
    console.error("Error creating test:", error);
    return { error: "Failed to create test in database." };
  }
}

export async function updateTest(id: string, data: TestInput) {
  await requireAdmin();

  const checked = validateTestInput(data);
  if ("error" in checked) return { error: checked.error };

  try {
    const previous = await prisma.test.findUnique({
      where: { id },
      select: { paperPublicId: true, paperVersion: true, format: true },
    });
    if (!previous) return { error: "Test not found." };

    // Switching between a link and portal questions would strand either the
    // students' saved answers or the link; a test keeps the kind it began as.
    if ((previous.format === "QUESTIONS") !== (checked.format === "QUESTIONS")) {
      return {
        error:
          previous.format === "QUESTIONS"
            ? "This test's questions are written in the portal. Create a new test to use a link instead."
            : "This test uses a link. Create a new test to write questions in the portal.",
      };
    }

    await prisma.test.update({
      where: { id },
      data: {
        title: data.title.trim(),
        subject: data.subject.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName || "BookOpen",
        format: checked.format,
        formUrl: checked.format === "QUESTIONS" ? "" : data.formUrl.trim(),
        // Papers are links now; an older uploaded file is dropped.
        ...NO_PAPER,
        durationMinutes: parseDurationMinutes(data.durationMinutes).minutes,
        proctored: data.proctored ?? true,
        active: data.active ?? true,
        ...questionSettings(data, checked.format, false),
      },
    });

    if (previous.paperPublicId) await discardPaper(previous);

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
