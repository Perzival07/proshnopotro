import { Field, inputClass } from "./ui";

type Values = {
  slug: string;
  name: string;
  portalUrl: string;
  pricePerStudentInr: number;
  maxStudents: number | null;
  notes: string;
};

/** The organisation form's fields, shared by "add" and "edit". */
export function OrgFields({ values, slugLocked }: { values?: Values; slugLocked?: boolean }) {
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
          <input name="pricePerStudentInr" type="number" min={0} step={1} required defaultValue={values?.pricePerStudentInr ?? 0} className={inputClass} />
        </Field>
        <Field label="Student limit" hint="Empty for none. Not enforced yet.">
          <input name="maxStudents" type="number" min={1} step={1} defaultValue={values?.maxStudents ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes" hint="Only you see these.">
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={values?.notes} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
