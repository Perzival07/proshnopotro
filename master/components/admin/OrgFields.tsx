import { Field, inputClass } from "./ui";

type Values = {
  slug: string;
  name: string;
  portalUrl: string;
  pricePerStudentInr: number;
  maxStudents: number | null;
  notes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

/** The organisation form's fields, shared by "add" and "edit". */
export function OrgFields({ values, slugLocked, defaultPrice = 0 }: { values?: Values; slugLocked?: boolean; defaultPrice?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required maxLength={120} defaultValue={values?.name} className={inputClass} placeholder="Classes by Koustav" />
      </Field>
      <Field label="Slug" hint="The folder name in orgs/ and the portal's ORG variable. Cannot change later.">
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={values?.slug}
          readOnly={slugLocked}
          className={`${inputClass} font-mono ${slugLocked ? "bg-zinc-100 text-zinc-500" : ""}`}
          placeholder="classes-by-koustav"
        />
      </Field>
      <Field label="Portal address" hint="Where its students sign in.">
        <input name="portalUrl" type="url" required defaultValue={values?.portalUrl} className={inputClass} placeholder="https://koustav.proshnopotro.in" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Price per student (₹/month)">
          <input name="pricePerStudentInr" type="number" min={0} step={1} required defaultValue={values?.pricePerStudentInr ?? defaultPrice} className={inputClass} />
        </Field>
        <Field label="Student limit" hint="Empty for none. Not enforced yet.">
          <input name="maxStudents" type="number" min={1} step={1} defaultValue={values?.maxStudents ?? ""} className={inputClass} />
        </Field>
      </div>
      <p className="border-t border-zinc-100 pt-4 text-sm font-semibold text-brand-900 sm:col-span-2">Contact at the organisation</p>
      <Field label="Contact person">
        <input name="contactName" maxLength={120} defaultValue={values?.contactName} className={inputClass} placeholder="Koustav Das" />
      </Field>
      <Field label="Organisation email" hint="Where Proshnopotro writes to them. Make it an owner from People.">
        <input name="contactEmail" type="email" maxLength={320} defaultValue={values?.contactEmail} className={inputClass} placeholder="office@example.in" />
      </Field>
      <Field label="Phone">
        <input name="contactPhone" type="tel" maxLength={30} defaultValue={values?.contactPhone} className={inputClass} />
      </Field>
      <Field label="Address">
        <input name="address" maxLength={500} defaultValue={values?.address} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" hint="Only you see these.">
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={values?.notes} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
