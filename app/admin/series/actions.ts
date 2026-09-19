"use server";

import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

type Result = { success?: true; error?: string };

// No revalidatePath: like the marking screen, the page updates its own state
// so the admin loading boundary does not remount it.

export async function createSeries(name: string, description: string): Promise<Result & { id?: string }> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 80) return { error: "Give the series a name, like \"Weekly tests 2026\"." };
  const clash = await prisma.testSeries.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } });
  if (clash) return { error: "A series with that name already exists." };
  const s = await prisma.testSeries.create({
    data: { name: clean, description: description.trim().slice(0, 500) || null },
    select: { id: true },
  });
  return { success: true, id: s.id };
}

export async function renameSeries(id: string, name: string): Promise<Result> {
  await requireAdmin();
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 80) return { error: "Give the series a name." };
  const clash = await prisma.testSeries.findFirst({ where: { name: { equals: clean, mode: "insensitive" }, NOT: { id } } });
  if (clash) return { error: "A series with that name already exists." };
  await prisma.testSeries.update({ where: { id }, data: { name: clean } });
  return { success: true };
}

/** Deleting a series only unlinks its tests; every test and result stays. */
export async function deleteSeries(id: string): Promise<Result> {
  await requireAdmin();
  await prisma.testSeries.delete({ where: { id } }).catch(() => null);
  return { success: true };
}

export async function setTestSeries(testId: string, seriesId: string | null): Promise<Result> {
  await requireAdmin();
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { bank: true } });
  if (!test) return { error: "That test no longer exists." };
  if (test.bank) return { error: "Past papers in the question bank cannot join a series." };
  if (seriesId && !(await prisma.testSeries.findUnique({ where: { id: seriesId }, select: { id: true } }))) {
    return { error: "That series no longer exists." };
  }
  await prisma.test.update({ where: { id: testId }, data: { seriesId } });
  return { success: true };
}
