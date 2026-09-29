"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/access";
import { fromDateKey, rupees, todayIst } from "@/lib/billing";
import { parseOrgForm, parsePaymentForm } from "@/lib/org-input";
import { MAX_LOGO_BYTES, isDeployHook, logoType, parseBrandingForm } from "@/lib/branding";
import { syncRoster } from "@/lib/sync";
import { logActivity } from "@/lib/activity";
import { back } from "@/lib/back";
import { DEMO_SLUG, resetDemoPortal } from "@/lib/demo";

/**
 * The super admin's server actions. Each one checks the caller itself -- the
 * layout's check does not cover actions -- and ends by redirecting back with
 * a message in the address, which the page shows.
 */

function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

async function orgBySlug(slug: string) {
  const org = await prisma.organisation.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  return org;
}

export async function createOrg(form: FormData) {
  const actor = await requireSuperAdmin();
  const parsed = parseOrgForm(form);
  if ("error" in parsed) back("/admin/orgs/new", parsed);
  try {
    const created = await prisma.organisation.create({ data: { ...parsed.data, syncSecret: newSecret() } });
    await logActivity(actor, "Added organisation", { org: created, detail: created.portalUrl });
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
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const parsed = parseOrgForm(form);
  if ("error" in parsed) back(`/admin/orgs/${slug}`, parsed);
  if (parsed.data.slug !== org.slug) {
    back(`/admin/orgs/${slug}`, { error: "The slug cannot change: the portal's ORG variable and orgs/ folder use it." });
  }
  const saved = await prisma.organisation.update({ where: { id: org.id }, data: parsed.data });
  await logActivity(actor, "Edited details", { org: saved });
  revalidatePath("/admin");
  // The name is part of what the portal shows, so a new one needs a rebuild.
  if (parsed.data.name !== org.name && saved.branding) {
    const rebuilt = await rebuildPortal(saved.deployHookUrl);
    back(`/admin/orgs/${slug}`, { ok: `Saved. ${REBUILD_MESSAGE[rebuilt]}` });
  }
  back(`/admin/orgs/${slug}`, { ok: "Saved." });
}

export async function setSuspended(slug: string, suspended: boolean) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  await prisma.organisation.update({ where: { id: org.id }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
  await logActivity(actor, suspended ? "Suspended" : "Reactivated", { org });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, {
    ok: suspended
      ? `${org.name} is suspended. Its portal shows "temporarily unavailable" within five minutes.`
      : `${org.name} is active again. Its portal reopens within five minutes.`,
  });
}

export async function recordPayment(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const parsed = parsePaymentForm(form, todayIst());
  if ("error" in parsed) back(`/admin/orgs/${slug}`, parsed);
  const { paidUpTo, receivedOn, ...rest } = parsed.data;
  await prisma.$transaction([
    prisma.payment.create({ data: { ...rest, orgId: org.id, receivedOn: fromDateKey(receivedOn) } }),
    ...(paidUpTo ? [prisma.organisation.update({ where: { id: org.id }, data: { paidUpTo: fromDateKey(paidUpTo) } })] : []),
  ]);
  await logActivity(actor, "Recorded payment", {
    org,
    detail: `${rupees(rest.amountInr)} received ${receivedOn}${rest.reference ? `, ref ${rest.reference}` : ""}${paidUpTo ? `; paid up to ${paidUpTo}` : ""}`,
  });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, { ok: `Recorded ${rupees(rest.amountInr)} from ${org.name}.` });
}

export async function deletePayment(slug: string, paymentId: string) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  // Scoped to this organisation, so a stale form cannot remove another's payment.
  const { count } = await prisma.payment.deleteMany({ where: { id: paymentId, orgId: org.id } });
  if (count) await logActivity(actor, "Removed payment", { org });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, count ? { ok: "Payment removed. The paid-up-to date is unchanged; correct it below if needed." } : { error: "That payment was already removed." });
}

export async function setPaidUpTo(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
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
  await logActivity(actor, "Changed paid-up-to date", { org, detail: raw || "cleared" });
  revalidatePath("/admin");
  back(`/admin/orgs/${slug}`, { ok: paidUpTo ? "Paid-up-to date changed." : "Paid-up-to date cleared." });
}

export async function rotateSecret(slug: string) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  await prisma.organisation.update({ where: { id: org.id }, data: { syncSecret: newSecret() } });
  await logActivity(actor, "Made a new sync secret", { org });
  back(`/admin/orgs/${slug}`, {
    ok: "New sync secret made. Put it in the portal's MASTER_SYNC_SECRET and redeploy; until then the two cannot talk.",
  });
}

/** `to` is "people" when pressed on the People page, which it then returns to; otherwise the bound form's data. */
export async function syncNow(slug: string, to?: unknown) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const result = await syncRoster(org.id);
  await logActivity(actor, "Synced roster", { org, detail: result.ok ? `${result.count} students` : result.error });
  revalidatePath("/admin");
  const page = to === "people" ? `/admin/orgs/${slug}/people` : `/admin/orgs/${slug}`;
  back(page, result.ok ? { ok: `Synced: ${result.count} enrolled students.` } : { error: result.error });
}

/**
 * Removes an organisation that has left, with its payments and its list of
 * student emails. Its portal's own database, files and Vercel project are
 * separate and must be deleted by hand; the page says so.
 */
export async function deleteOrg(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  if (String(form.get("confirm") ?? "").trim() !== org.slug) {
    back(`/admin/orgs/${slug}`, { error: `Type ${org.slug} to confirm deleting ${org.name}.` });
  }
  await prisma.organisation.delete({ where: { id: org.id } });
  await logActivity(actor, "Deleted organisation", { detail: `${org.name} (${org.slug})` });
  revalidatePath("/admin");
  back("/admin", { ok: `${org.name} deleted, with its payments and student list. Remember its portal's database, files and Vercel project.` });
}

/** Asks Vercel to rebuild the portal, if its deploy hook is saved. */
async function rebuildPortal(hook: string | null): Promise<"started" | "no-hook" | "failed"> {
  if (!hook || !isDeployHook(hook)) return "no-hook";
  try {
    const res = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(10_000) });
    return res.ok ? "started" : "failed";
  } catch {
    return "failed";
  }
}

const REBUILD_MESSAGE = {
  started: "Its portal is rebuilding and shows the change in about three minutes.",
  "no-hook": "Add its deploy hook below so saving rebuilds the portal; until then it shows on its next deploy.",
  failed: "Rebuilding the portal did not start: check its deploy hook, or redeploy it in Vercel.",
};

export async function saveBranding(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await prisma.organisation.findUnique({ where: { slug }, select: { id: true, name: true, deployHookUrl: true } });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  const parsed = parseBrandingForm(form);
  if ("error" in parsed) back(`/admin/orgs/${slug}`, parsed);

  const logo: { logoImage?: Uint8Array<ArrayBuffer> | null; logoType?: string | null } = {};
  const file = form.get("logo");
  if (form.get("removeLogo") === "on") {
    logo.logoImage = null;
    logo.logoType = null;
  } else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) back(`/admin/orgs/${slug}`, { error: "The logo must be 1 MB or smaller." });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = logoType(bytes);
    if (!type) back(`/admin/orgs/${slug}`, { error: "The logo must be a PNG, JPEG or WebP image." });
    logo.logoImage = bytes;
    logo.logoType = type;
  }

  await prisma.organisation.update({
    where: { id: org.id },
    data: { branding: parsed.data, brandingSavedAt: new Date(), ...logo },
  });
  await logActivity(actor, "Saved branding", { org });
  const rebuilt = await rebuildPortal(org.deployHookUrl);
  back(`/admin/orgs/${slug}`, { ok: `Branding saved. ${REBUILD_MESSAGE[rebuilt]}` });
}

export async function saveDeployHook(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const hook = String(form.get("deployHookUrl") ?? "").trim();
  if (hook && !isDeployHook(hook)) {
    back(`/admin/orgs/${slug}`, { error: "That is not a Vercel deploy hook (https://api.vercel.com/v1/integrations/deploy/...)." });
  }
  await prisma.organisation.update({ where: { id: org.id }, data: { deployHookUrl: hook || null } });
  await logActivity(actor, hook ? "Saved deploy hook" : "Removed deploy hook", { org });
  back(`/admin/orgs/${slug}`, { ok: hook ? "Deploy hook saved." : "Deploy hook removed." });
}

export async function rebuildNow(slug: string) {
  const actor = await requireSuperAdmin();
  const org = await prisma.organisation.findUnique({ where: { slug }, select: { id: true, name: true, deployHookUrl: true } });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  const rebuilt = await rebuildPortal(org.deployHookUrl);
  await logActivity(actor, "Rebuilt portal", { org, detail: rebuilt });
  back(`/admin/orgs/${slug}`, rebuilt === "started" ? { ok: REBUILD_MESSAGE.started } : { error: REBUILD_MESSAGE[rebuilt] });
}

/** Whether the organisation is listed on the website's "joined us" section, and the logo shown there. */
export async function saveWebsiteListing(slug: string, form: FormData) {
  const actor = await requireSuperAdmin();
  const org = await orgBySlug(slug);
  const data: {
    showOnWebsite: boolean;
    websiteLogo?: Uint8Array<ArrayBuffer> | null;
    websiteLogoType?: string | null;
    websiteLogoSavedAt?: Date | null;
  } = { showOnWebsite: form.get("showOnWebsite") === "on" };
  const file = form.get("websiteLogo");
  if (form.get("removeWebsiteLogo") === "on") {
    Object.assign(data, { websiteLogo: null, websiteLogoType: null, websiteLogoSavedAt: null });
  } else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_LOGO_BYTES) back(`/admin/orgs/${slug}`, { error: "The logo must be 1 MB or smaller." });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = logoType(bytes);
    if (!type) back(`/admin/orgs/${slug}`, { error: "The logo must be a PNG, JPEG or WebP image." });
    Object.assign(data, { websiteLogo: bytes, websiteLogoType: type, websiteLogoSavedAt: new Date() });
  }
  await prisma.organisation.update({ where: { id: org.id }, data });
  await logActivity(actor, "Saved website listing", { org, detail: data.showOnWebsite ? "shown" : "hidden" });
  revalidatePath("/");
  back(`/admin/orgs/${slug}`, { ok: data.showOnWebsite ? "Saved. The website shows it within five minutes." : "Saved. It is no longer on the website." });
}

/** The demo organisation only: its portal deletes every test, attempt, class and note and writes the sample content again. */
export async function resetDemo(slug: string) {
  const actor = await requireSuperAdmin();
  if (slug !== DEMO_SLUG) back(`/admin/orgs/${slug}`, { error: "Only the demo organisation can be reset." });
  const org = await prisma.organisation.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, portalUrl: true, syncSecret: true } });
  if (!org) back("/admin", { error: "That organisation no longer exists." });
  const result = await resetDemoPortal(org.portalUrl, org.syncSecret);
  await logActivity(actor, "Reset demo data", { org, detail: result.ok ? "done" : result.error });
  back(
    `/admin/orgs/${slug}`,
    result.ok
      ? { ok: `Demo reset: the sample class, paper and note are back, given to ${result.students} students and ${result.tutors} tutors.` }
      : { error: result.error }
  );
}
