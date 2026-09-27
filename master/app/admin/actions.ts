"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/access";
import { fromDateKey, rupees, todayIst } from "@/lib/billing";
import { parseOrgForm, parsePaymentForm } from "@/lib/org-input";
import { syncRoster } from "@/lib/sync";

/**
 * The super admin's server actions. Each one checks the caller itself -- the
 * layout's check does not cover actions -- and ends by redirecting back with
 * a message in the address, which the page shows.
 */

function back(path: string, message: { ok: string } | { error: string }): never {
  const key = "ok" in message ? "ok" : "error";
  const text = "ok" in message ? message.ok : message.error;
  redirect(`${path}?${key}=${encodeURIComponent(text)}`);
}

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

async function orgBySlug(slug: string) {
  const org = await prisma.organisation.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  return org;
}

export async function createOrg(form: FormData) {
  await requireSuperAdmin();
  const parsed = parseOrgForm(form);
  if ("error" in parsed) back("/admin/orgs/new", parsed);
  try {
    await prisma.organisation.create({ data: { ...parsed.data, syncSecret: newSecret() } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      back("/admin/orgs/new", { error: `An organisation with the slug "${parsed.data.slug}" already exists.` });
    }
    throw err;
  }
  revalidatePath("/admin");
  back(`/admin/orgs/${parsed.data.slug}`, { ok: "Organisation added. Follow the setup steps below to connect its portal." });
}

export async function updateOrg(slug: string, form: FormData) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const parsed = parseOrgForm(form);
  if ("error" in parsed) back(`/admin/orgs/${slug}`, parsed);
  if (parsed.data.slug !== org.slug) {
    back(`/admin/orgs/${slug}`, { error: "The slug cannot change: the portal's ORG variable and orgs/ folder use it." });
  }
  await prisma.organisation.update({ where: { id: org.id }, data: parsed.data });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, { ok: "Saved." });
}

export async function setSuspended(slug: string, suspended: boolean) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  await prisma.organisation.update({ where: { id: org.id }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, {
    ok: suspended
      ? `${org.name} is suspended. Its portal shows "temporarily unavailable" within five minutes.`
      : `${org.name} is active again. Its portal reopens within five minutes.`,
  });
}

export async function recordPayment(slug: string, form: FormData) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const parsed = parsePaymentForm(form, todayIst());
  if ("error" in parsed) back(`/admin/orgs/${slug}`, parsed);
  const { paidUpTo, receivedOn, ...rest } = parsed.data;
  await prisma.$transaction([
    prisma.payment.create({ data: { ...rest, orgId: org.id, receivedOn: fromDateKey(receivedOn) } }),
    ...(paidUpTo ? [prisma.organisation.update({ where: { id: org.id }, data: { paidUpTo: fromDateKey(paidUpTo) } })] : []),
  ]);
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, { ok: `Recorded ${rupees(rest.amountInr)} from ${org.name}.` });
}

export async function deletePayment(slug: string, paymentId: string) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  // Scoped to this organisation, so a stale form cannot remove another's payment.
  const { count } = await prisma.payment.deleteMany({ where: { id: paymentId, orgId: org.id } });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, count ? { ok: "Payment removed. The paid-up-to date is unchanged; correct it below if needed." } : { error: "That payment was already removed." });
}

export async function setPaidUpTo(slug: string, form: FormData) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const raw = String(form.get("paidUpTo") ?? "").trim();
  let paidUpTo: Date | null = null;
  if (raw) {
    try {
      paidUpTo = fromDateKey(raw);
    } catch {
      back(`/admin/orgs/${slug}`, { error: "That is not a valid date." });
    }
  }
  await prisma.organisation.update({ where: { id: org.id }, data: { paidUpTo } });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, { ok: paidUpTo ? "Paid-up-to date changed." : "Paid-up-to date cleared." });
}

export async function rotateSecret(slug: string) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  await prisma.organisation.update({ where: { id: org.id }, data: { syncSecret: newSecret() } });
  back(`/admin/orgs/${slug}`, {
    ok: "New sync secret made. Put it in the portal's MASTER_SYNC_SECRET and redeploy; until then the two cannot talk.",
  });
}

export async function syncNow(slug: string) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const result = await syncRoster(org.id);
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, result.ok ? { ok: `Synced: ${result.count} enrolled students.` } : { error: result.error });
}

/**
 * Removes an organisation that has left, with its payments and its list of
 * student emails. Its portal's own database, files and Vercel project are
 * separate and must be deleted by hand; the page says so.
 */
export async function deleteOrg(slug: string, form: FormData) {
  await requireSuperAdmin();
  const org = await orgBySlug(slug);
  if (String(form.get("confirm") ?? "").trim() !== org.slug) {
    back(`/admin/orgs/${slug}`, { error: `Type ${org.slug} to confirm deleting ${org.name}.` });
  }
  await prisma.organisation.delete({ where: { id: org.id } });
  revalidatePath("/admin");
  back("/admin", { ok: `${org.name} deleted, with its payments and student list. Remember its portal's database, files and Vercel project.` });
}
