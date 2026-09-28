"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { back } from "@/lib/back";
import { parseEmail, parsePersonForm, parseRole } from "@/lib/org-input";
import { ROLE_LABEL, sendPeopleCommand, type PeopleCommand } from "@/lib/portal-people";
import { syncRoster } from "@/lib/sync";

/**
 * The super admin changing an organisation's people in its portal. The
 * portal carries each change out and is then synced, so the list here shows
 * what the portal now holds.
 */

async function orgForPeople(slug: string) {
  const org = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, portalUrl: true, syncSecret: true },
  });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  return org;
}

async function run(
  actor: string,
  org: Awaited<ReturnType<typeof orgForPeople>>,
  command: PeopleCommand,
  done: { action: string; detail: string; ok: string }
): Promise<never> {
  const page = `/admin/orgs/${org.slug}/people`;
  const sent = await sendPeopleCommand(org.portalUrl, org.syncSecret, command);
  if (!sent.ok) back(page, { error: sent.error });
  await logActivity(actor, done.action, { org, detail: done.detail });
  const synced = await syncRoster(org.id);
  revalidatePath("/admin");
  revalidatePath(page);
  back(page, synced.ok ? { ok: done.ok } : { ok: `${done.ok} The list below could not refresh: ${synced.error}` });
}

export async function addPerson(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgForPeople(slug);
  const parsed = parsePersonForm(form);
  if ("error" in parsed) back(`/admin/orgs/${slug}/people`, parsed);
  const { email, role } = parsed.data;
  const label = ROLE_LABEL[role].toLowerCase();
  await run(actor, org, parsed.data, {
    action: `Added ${label}`,
    detail: email,
    ok:
      role === "STUDENT"
        ? `${email} added as a student. They sign in to the portal with Google using this email.`
        : `${email} is now ${role === "ADMIN" ? "an owner" : "a tutor"} of ${org.name}.`,
  });
}

export async function removePerson(slug: string, rawEmail: string) {
  const actor = await requireSuperAdmin();
  const org = await orgForPeople(slug);
  const email = parseEmail(rawEmail);
  if (!email) back(`/admin/orgs/${slug}/people`, { error: "That is not an email address." });
  await run(actor, org, { action: "remove", email }, {
    action: "Removed person",
    detail: email,
    ok: `${email} removed from ${org.name}, with their tests, results and answer photos.`,
  });
}

export async function changeRole(slug: string, rawEmail: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgForPeople(slug);
  const email = parseEmail(rawEmail);
  const role = parseRole(String(form.get("role") ?? ""));
  if (!email || !role) back(`/admin/orgs/${slug}/people`, { error: "Choose student, tutor or owner." });
  await run(actor, org, { action: "setRole", email, role }, {
    action: "Changed role",
    detail: `${email} → ${ROLE_LABEL[role]}`,
    ok: `${email} is now: ${ROLE_LABEL[role]}.`,
  });
}
