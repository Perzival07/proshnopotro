import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw, Search, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CLASS_OPTIONS } from "@/lib/portal-people";
import { syncNow } from "../../../actions";
import { addPerson, changeRole, removePerson } from "./actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Card, Field, Flash, RoleBadge, buttonClass, inputClass, secondaryButtonClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const timeFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const ROLE_ORDER: Record<string, number> = { ADMIN: 0, TUTOR: 1, STUDENT: 2 };

export default async function OrgPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string; q?: string; role?: string }>;
}) {
  const { slug } = await params;
  const { ok, error, q = "", role = "" } = await searchParams;
  const org = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, portalUrl: true, contactEmail: true, lastSyncAt: true, lastSyncError: true, maxStudents: true },
  });
  if (!org) notFound();

  const everyone = await prisma.enrolment.findMany({ where: { orgId: org.id }, select: { email: true, role: true } });
  const counts = { ADMIN: 0, TUTOR: 0, STUDENT: 0 } as Record<string, number>;
  for (const p of everyone) counts[p.role] = (counts[p.role] ?? 0) + 1;
  const needle = q.trim().toLowerCase();
  const shown = everyone
    .filter((p) => (!role || p.role === role) && (!needle || p.email.includes(needle)))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) || a.email.localeCompare(b.email));
  const contactIsOwner = !org.contactEmail || everyone.some((p) => p.email === org.contactEmail && p.role === "ADMIN");

  return (
    <>
      <Link href={`/admin/orgs/${org.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> {org.name}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">People at {org.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {counts.ADMIN} owner{counts.ADMIN === 1 ? "" : "s"} · {counts.TUTOR} tutor{counts.TUTOR === 1 ? "" : "s"} ·{" "}
            {counts.STUDENT.toLocaleString("en-IN")} student{counts.STUDENT === 1 ? "" : "s"}
            {org.maxStudents !== null && <span className="text-zinc-400"> (limit {org.maxStudents})</span>}
          </p>
        </div>
        <form action={syncNow.bind(null, org.slug, "people")}>
          <button type="submit" className={secondaryButtonClass}>
            <RefreshCw className="h-4 w-4" /> Refresh from portal
          </button>
        </form>
      </div>

      <Flash ok={ok} error={error} />

      {!org.lastSyncAt ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This portal has not been connected yet. Set it up under &ldquo;Connect the portal&rdquo; on the organisation&apos;s page first;
          until then changes here cannot reach it.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Copied from the portal {timeFormat.format(org.lastSyncAt)}. Changes made here are saved in the portal straight away.
          {org.lastSyncError && <span className="text-amber-700"> Last refresh failed: {org.lastSyncError}</span>}
        </p>
      )}

      {!contactIsOwner && (
        <form action={addPerson.bind(null, org.slug)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          <input type="hidden" name="role" value="ADMIN" />
          <input type="hidden" name="email" value={org.contactEmail} />
          <span className="text-brand-900">
            The organisation&apos;s email, <strong>{org.contactEmail}</strong>, is not an owner of its portal yet.
          </span>
          <button type="submit" className={buttonClass}>
            Make it an owner
          </button>
        </form>
      )}

      <Card title="Add a person">
        <form action={addPerson.bind(null, org.slug)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Role">
            <select name="role" defaultValue="STUDENT" className={inputClass}>
              <option value="STUDENT">Student</option>
              <option value="TUTOR">Tutor</option>
              <option value="ADMIN">Owner</option>
            </select>
          </Field>
          <Field label="Email">
            <input name="email" type="email" required maxLength={320} className={inputClass} placeholder="name@gmail.com" />
          </Field>
          <Field label="Name" hint="Needed for a student.">
            <input name="name" maxLength={80} className={inputClass} />
          </Field>
          <Field label="Phone" hint="Students only; optional.">
            <input name="phone" type="tel" maxLength={20} className={inputClass} />
          </Field>
          <Field label="Class" hint="Students only; optional.">
            <select name="className" defaultValue="" className={inputClass}>
              <option value="">—</option>
              {CLASS_OPTIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-5">
            <button type="submit" className={buttonClass}>
              <UserPlus className="h-4 w-4" /> Add
            </button>
            <p className="mt-2 text-xs text-zinc-500">
              Owners can do everything in the portal, including adding their own students and tutors. Only you can make someone an owner.
            </p>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <form className="flex flex-wrap items-end gap-2 border-b border-zinc-100 p-4">
          <div className="min-w-[220px] flex-1">
            <Field label="Search by email">
              <input name="q" defaultValue={q} className={inputClass} placeholder="part of an email" />
            </Field>
          </div>
          <Field label="Role">
            <select name="role" defaultValue={role} className={inputClass}>
              <option value="">Everyone</option>
              <option value="ADMIN">Owners</option>
              <option value="TUTOR">Tutors</option>
              <option value="STUDENT">Students</option>
            </select>
          </Field>
          <button type="submit" className={secondaryButtonClass}>
            <Search className="h-4 w-4" /> Filter
          </button>
        </form>

        {shown.length === 0 ? (
          <p className="p-5 text-sm text-zinc-600">{everyone.length === 0 ? "No one yet." : "No one matches."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Change role</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shown.map((p) => (
                  <tr key={p.email}>
                    <td className="px-4 py-2 font-mono text-xs">{p.email}</td>
                    <td className="px-4 py-2">
                      <RoleBadge role={p.role} />
                    </td>
                    <td className="px-4 py-2">
                      <form action={changeRole.bind(null, org.slug, p.email)} className="flex items-center gap-2">
                        <select name="role" defaultValue={p.role} className={`${inputClass} w-auto py-1`} aria-label={`Role of ${p.email}`}>
                          <option value="STUDENT">Student</option>
                          <option value="TUTOR">Tutor</option>
                          <option value="ADMIN">Owner</option>
                        </select>
                        <button type="submit" className="text-xs font-semibold text-brand-700 hover:underline">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={removePerson.bind(null, org.slug, p.email)}>
                        <ConfirmButton
                          className="text-xs font-medium text-red-600 hover:underline"
                          message={`Remove ${p.email} from ${org.name}? Their tests, results, doubts and answer photos are deleted too. This cannot be undone.`}
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
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
          Showing {shown.length.toLocaleString("en-IN")} of {everyone.length.toLocaleString("en-IN")}. Students are billed;
          owners and tutors are not.
        </p>
      </Card>
    </>
  );
}
