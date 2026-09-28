"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { envSuperAdmins, requireSuperAdmin } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { back } from "@/lib/back";
import { parseEmail, parseSettingsForm } from "@/lib/org-input";

const PAGE = "/admin/settings";

export async function addSuperAdmin(form: FormData) {
  const actor = await requireSuperAdmin();
  const email = parseEmail(String(form.get("email") ?? ""));
  if (!email) back(PAGE, { error: "Enter a valid email address." });
  if (envSuperAdmins().includes(email)) back(PAGE, { error: `${email} is already a super admin.` });
  await prisma.superAdmin.upsert({ where: { email }, update: {}, create: { email, addedBy: actor } });
  await logActivity(actor, "Added super admin", { detail: email });
  revalidatePath(PAGE);
  back(PAGE, { ok: `${email} is now a super admin. They sign in here with Google.` });
}

export async function removeSuperAdmin(email: string) {
  const actor = await requireSuperAdmin();
  if (email === actor) back(PAGE, { error: "You cannot remove yourself; ask another super admin." });
  const { count } = await prisma.superAdmin.deleteMany({ where: { email } });
  if (count) await logActivity(actor, "Removed super admin", { detail: email });
  revalidatePath(PAGE);
  back(PAGE, count ? { ok: `${email} is no longer a super admin.` } : { error: `${email} was not on the list.` });
}

export async function saveSettings(form: FormData) {
  const actor = await requireSuperAdmin();
  const parsed = parseSettingsForm(form);
  if ("error" in parsed) back(PAGE, parsed);
  await prisma.platformSettings.upsert({ where: { id: 1 }, update: parsed.data, create: { id: 1, ...parsed.data } });
  await logActivity(actor, "Saved platform settings", { detail: `default price ₹${parsed.data.defaultPricePerStudentInr}` });
  revalidatePath(PAGE);
  back(PAGE, { ok: "Settings saved. Owners' Billing pages show the new instructions within five minutes." });
}
