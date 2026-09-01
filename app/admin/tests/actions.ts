"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isValidResourceUrl, toEmbedUrl, type TestFormat } from "@/lib/test-resource";

export interface TestInput {
  title: string;
  subject: string;
  description?: string;
  iconName: string;
  format: TestFormat;
  formUrl: string;
  active?: boolean;
}

/** Shared validation for create and update. Returns an error string or null. */
function validateTestInput(data: TestInput): string | null {
  if (!data.title.trim() || !data.subject.trim() || !data.formUrl.trim()) {
    return "Title, Subject, and the question paper URL are required.";
  }
  if (data.format !== "GOOGLE_FORM" && data.format !== "GOOGLE_DOC") {
    return "Choose whether this is a Google Form or a Google Doc.";
  }
  if (!isValidResourceUrl(data.formUrl, data.format)) {
    return data.format === "GOOGLE_FORM"
      ? "That does not look like a Google Form link (expected docs.google.com/forms/... or forms.gle/...)."
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
    await prisma.test.update({
      where: { id },
      data: {
        title: data.title.trim(),
        subject: data.subject.trim(),
        description: data.description?.trim() || null,
        iconName: data.iconName || "BookOpen",
        format: data.format,
        formUrl: data.formUrl.trim(),
        active: data.active ?? true,
      },
    });

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
