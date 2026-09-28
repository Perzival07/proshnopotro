import { prisma } from "@/lib/prisma";
import { envSuperAdmins, requireSuperAdmin } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { paymentInstructions as defaultInstructions } from "@/lib/site";
import { addSuperAdmin, removeSuperAdmin, saveSettings } from "./actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Card, Field, Flash, buttonClass, inputClass } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const dayFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  const me = await requireSuperAdmin();
  const fixed = envSuperAdmins();
  const [added, saved, settings] = await Promise.all([
    prisma.superAdmin.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.platformSettings.findUnique({ where: { id: 1 } }),
    getSettings(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-900">Settings</h1>
      <Flash {...flash} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Super admins">
          <p className="mb-4 text-sm text-zinc-600">
            Super admins can do everything here: add and delete organisations, their owners, tutors and students, billing and branding.
          </p>
          <ul className="divide-y divide-zinc-100 text-sm">
            {fixed.map((e) => (
              <li key={e} className="flex items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{e}</span>
                <span className="text-xs text-zinc-500">SUPER_ADMIN_EMAILS</span>
              </li>
            ))}
            {added
              .filter((a) => !fixed.includes(a.email))
              .map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-mono text-xs">{a.email}</span>
                    <span className="block text-xs text-zinc-500">
                      Added by {a.addedBy}, {dayFormat.format(a.createdAt)}
                    </span>
                  </span>
                  {a.email !== me && (
                    <form action={removeSuperAdmin.bind(null, a.email)}>
                      <ConfirmButton className="text-xs font-medium text-red-600 hover:underline" message={`Remove ${a.email} as a super admin?`}>
                        Remove
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
          </ul>
          <form action={addSuperAdmin} className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-4">
            <div className="min-w-[220px] flex-1">
              <Field label="Add a super admin">
                <input name="email" type="email" required className={inputClass} placeholder="name@gmail.com" />
              </Field>
            </div>
            <ConfirmButton className={buttonClass} message="Give this person full control of every organisation?">
              Add
            </ConfirmButton>
          </form>
          <p className="mt-2 text-xs text-zinc-500">Those in SUPER_ADMIN_EMAILS are changed in Vercel, not here.</p>
        </Card>

        <Card title="Platform defaults">
          <form action={saveSettings} className="space-y-4">
            <Field label="Default price per student (₹/month)" hint="Filled in when adding an organisation.">
              <input
                name="defaultPricePerStudentInr"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={settings.defaultPricePerStudentInr}
                className={inputClass}
              />
            </Field>
            <Field label="Payment instructions" hint="Shown on every owner's Billing page. Empty uses the standard text shown in the box.">
              <textarea
                name="paymentInstructions"
                rows={5}
                maxLength={2000}
                defaultValue={saved?.paymentInstructions ?? ""}
                placeholder={defaultInstructions}
                className={inputClass}
              />
            </Field>
            <button type="submit" className={buttonClass}>
              Save settings
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
