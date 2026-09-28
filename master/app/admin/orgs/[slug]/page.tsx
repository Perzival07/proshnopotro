import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  billingStatus,
  dateKey,
  formatDay,
  monthOf,
  monthlyAmount,
  rupees,
  suggestPaidUpTo,
  todayIst,
} from "@/lib/billing";
import {
  rebuildNow,
  recordPayment,
  deleteOrg,
  saveBranding,
  saveDeployHook,
  deletePayment,
  rotateSecret,
  setPaidUpTo,
  setSuspended,
  syncNow,
  updateOrg,
} from "../../actions";
import { OrgFields } from "@/components/admin/OrgFields";
import { BrandingForm } from "@/components/admin/BrandingForm";
import { defaultBranding, type Branding } from "@/lib/branding";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import {
  BillingBadge,
  Card,
  Field,
  Flash,
  SuspendedBadge,
  buttonClass,
  dangerButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const timeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** This site's own address, for the portal's MASTER_URL. */
async function masterUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const flash = await searchParams;
  const org = await prisma.organisation.findUnique({
    where: { slug },
    include: { payments: { orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }] } },
  });
  if (!org) notFound();

  const today = todayIst();
  const paidUpTo = org.paidUpTo ? dateKey(org.paidUpTo) : null;
  const status = billingStatus({ paidUpTo, createdOn: dateKey(org.createdAt) }, today);
  const monthly = monthlyAmount(org.studentCount, org.pricePerStudentInr);
  const suspended = org.status === "SUSPENDED";
  const master = await masterUrl();
  const branding = (org.branding as Branding | null) ?? defaultBranding(org.name);
  const logoSrc = org.logoImage ? `data:${org.logoType};base64,${Buffer.from(org.logoImage).toString("base64")}` : null;

  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> Organisations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-brand-900">{org.name}</h1>
            {suspended ? <SuspendedBadge /> : <BillingBadge status={status} />}
          </div>
          <a href={org.portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
            {org.portalUrl} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/orgs/${org.slug}/statement?month=${monthOf(today)}`} className={secondaryButtonClass}>
            <FileText className="h-4 w-4" /> Statement
          </Link>
          <form action={setSuspended.bind(null, org.slug, !suspended)}>
            {suspended ? (
              <button type="submit" className={buttonClass}>
                Reactivate
              </button>
            ) : (
              <ConfirmButton
                className={dangerButtonClass}
                message={`Suspend ${org.name}? Its students and staff will see "temporarily unavailable" until you reactivate it.`}
              >
                Suspend
              </ConfirmButton>
            )}
          </form>
        </div>
      </div>

      <Flash {...flash} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Billing">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-zinc-500">Enrolled students</dt>
            <dd className="text-right font-semibold tabular-nums">
              {org.studentCount.toLocaleString("en-IN")}
              {org.maxStudents !== null && <span className="font-normal text-zinc-400"> of {org.maxStudents}</span>}
            </dd>
            <dt className="text-zinc-500">Price per student</dt>
            <dd className="text-right tabular-nums">{rupees(org.pricePerStudentInr)} / month</dd>
            <dt className="text-zinc-500">Amount per month</dt>
            <dd className="text-right text-lg font-bold tabular-nums text-brand-900">{rupees(monthly)}</dd>
            <dt className="text-zinc-500">Paid up to</dt>
            <dd className="text-right">{paidUpTo ? formatDay(paidUpTo) : "Never paid"}</dd>
          </dl>
          <p className="mt-4 text-xs text-zinc-500">
            {org.lastSyncAt ? `Students counted ${timeFormat.format(org.lastSyncAt)}.` : "Students not counted yet: connect the portal below."}
            {org.maxStudents !== null && org.studentCount > org.maxStudents && (
              <span className="font-semibold text-red-600"> Over the student limit.</span>
            )}
          </p>
          <form action={setPaidUpTo.bind(null, org.slug)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-4">
            <div className="flex-1">
              <Field label="Correct the paid-up-to date">
                <input name="paidUpTo" type="date" defaultValue={paidUpTo ?? ""} className={inputClass} />
              </Field>
            </div>
            <button type="submit" className={secondaryButtonClass}>
              Save date
            </button>
          </form>
        </Card>

        <Card title="Record a payment">
          <form action={recordPayment.bind(null, org.slug)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (₹)">
                <input name="amountInr" type="number" min={1} step={1} required defaultValue={monthly || ""} className={inputClass} />
              </Field>
              <Field label="Received on">
                <input name="receivedOn" type="date" required max={today} defaultValue={today} className={inputClass} />
              </Field>
            </div>
            <Field label="Reference" hint="UTR, cheque number or wire reference.">
              <input name="reference" maxLength={200} className={inputClass} />
            </Field>
            <Field label="Note">
              <input name="note" maxLength={1000} className={inputClass} />
            </Field>
            <Field label="Now paid up to" hint="Suggested: one more month. Clear it to leave the date as it is.">
              <input name="paidUpTo" type="date" defaultValue={suggestPaidUpTo(paidUpTo, today)} className={inputClass} />
            </Field>
            <button type="submit" className={buttonClass}>
              Record payment
            </button>
          </form>
        </Card>
      </div>

      <Card title="Payments received">
        {org.payments.length === 0 ? (
          <p className="text-sm text-zinc-600">None recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Received</th>
                  <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-4 font-semibold">Reference</th>
                  <th className="py-2 pr-4 font-semibold">Note</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {org.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDay(dateKey(p.receivedOn))}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums">{rupees(p.amountInr)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{p.reference || "—"}</td>
                    <td className="py-2 pr-4 text-zinc-600">{p.note || "—"}</td>
                    <td className="py-2 text-right">
                      <form action={deletePayment.bind(null, org.slug, p.id)}>
                        <ConfirmButton
                          className="text-xs font-medium text-red-600 hover:underline"
                          message={`Remove the ${rupees(p.amountInr)} payment of ${formatDay(dateKey(p.receivedOn))}?`}
                        >
                          Remove
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Connect the portal">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          <li>
            In the portal&apos;s Vercel project, set <code className="rounded bg-zinc-100 px-1">ORG={org.slug}</code>,{" "}
            <code className="rounded bg-zinc-100 px-1">MASTER_URL={master}</code> and{" "}
            <code className="rounded bg-zinc-100 px-1">MASTER_SYNC_SECRET</code> to the secret below, then redeploy.
          </li>
          <li>Press &ldquo;Sync now&rdquo;. After that the student count refreshes every night by itself.</li>
        </ol>
        <details className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-brand-900">Show the sync secret</summary>
          <p className="mt-2 break-all font-mono text-xs">{org.syncSecret}</p>
          <p className="mt-2 text-xs text-zinc-500">Anyone with this can read the organisation&apos;s student and staff emails. Keep it in Vercel only.</p>
        </details>
        {org.lastSyncError && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Last sync failed: {org.lastSyncError}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={syncNow.bind(null, org.slug)}>
            <button type="submit" className={buttonClass}>
              <RefreshCw className="h-4 w-4" /> Sync now
            </button>
          </form>
          <form action={rotateSecret.bind(null, org.slug)}>
            <ConfirmButton
              className={secondaryButtonClass}
              message="Make a new secret? The portal stops syncing and checking in until you put the new one in its MASTER_SYNC_SECRET and redeploy."
            >
              New secret
            </ConfirmButton>
          </form>
        </div>
      </Card>

      <Card title="Branding">
        <BrandingForm action={saveBranding.bind(null, org.slug)} branding={branding} logoSrc={logoSrc} saved={org.branding !== null} />
        <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5">
          <p className="text-sm text-zinc-700">
            Saving branding rebuilds the portal through its Vercel deploy hook (Vercel project → Settings → Git → Deploy Hooks,
            branch <code className="rounded bg-zinc-100 px-1">main</code>).
            {org.brandingSavedAt && <span className="text-zinc-500"> Last saved {timeFormat.format(org.brandingSavedAt)}.</span>}
          </p>
          <form action={saveDeployHook.bind(null, org.slug)} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Field label="Deploy hook">
                <input
                  name="deployHookUrl"
                  type="url"
                  defaultValue={org.deployHookUrl ?? ""}
                  placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                  className={`${inputClass} font-mono text-xs`}
                />
              </Field>
            </div>
            <button type="submit" className={secondaryButtonClass}>
              Save hook
            </button>
          </form>
          {org.deployHookUrl && (
            <form action={rebuildNow.bind(null, org.slug)}>
              <button type="submit" className={secondaryButtonClass}>
                <RefreshCw className="h-4 w-4" /> Rebuild portal now
              </button>
            </form>
          )}
        </div>
      </Card>

      <Card title="Details">
        <form action={updateOrg.bind(null, org.slug)} className="space-y-5">
          <OrgFields values={org} slugLocked />
          <button type="submit" className={buttonClass}>
            Save details
          </button>
        </form>
      </Card>

      <Card title="Delete organisation" className="border-red-200">
        <p className="text-sm text-zinc-700">
          For an organisation that has left. This deletes its record here, its payments and its list of student and staff emails, and cannot be
          undone. Its portal&apos;s database, Cloudinary files and Vercel project are separate: delete those yourself, within the 30
          days the terms promise.
        </p>
        <form action={deleteOrg.bind(null, org.slug)} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Field label={`Type ${org.slug} to confirm`}>
              <input name="confirm" autoComplete="off" className={`${inputClass} font-mono`} />
            </Field>
          </div>
          <ConfirmButton className={dangerButtonClass} message={`Delete ${org.name} for good?`}>
            Delete organisation
          </ConfirmButton>
        </form>
      </Card>
    </>
  );
}
