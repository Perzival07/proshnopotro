import { COLOR_KEYS, COLOR_LABELS, FEATURE_KEYS, FEATURE_LABELS, type Branding } from "@/lib/branding";
import { Field, buttonClass, inputClass } from "./ui";

/**
 * How the saved branding looks in the portal's header and sign-in card, at a
 * glance. Drawn from the saved values, so it changes after "Save branding".
 */
function Preview({ branding, logoSrc }: { branding: Branding; logoSrc: string | null }) {
  const { colors, logo } = branding;
  const mark = logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoSrc} alt="" className="h-9 w-9 rounded-md bg-white object-contain p-0.5" />
  ) : (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: colors.blue }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors.blue }} />
    </span>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200" style={{ background: colors.page }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: colors.navy }}>
        {mark}
        <div className="leading-tight">
          <span className="text-sm text-white/90">{logo.prefix} </span>
          <span className="text-base font-bold uppercase text-white">{logo.main}</span>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: colors.onDark }}>
            {branding.tagline}
          </p>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm font-semibold" style={{ color: colors.navy }}>
          Student Assessment Portal
        </p>
        <p className="text-xs" style={{ color: colors.ink }}>
          Body text, with a <span style={{ color: colors.blue }}>link</span>.
        </p>
        <span className="inline-block rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: colors.navy }}>
          Start test
        </span>
        <span className="ml-2 inline-block rounded-md border px-3 py-1.5 text-xs" style={{ background: colors.tint, borderColor: colors.border, color: colors.navy }}>
          Tag
        </span>
      </div>
    </div>
  );
}

export function BrandingForm({
  action,
  branding,
  logoSrc,
  saved,
}: {
  action: (form: FormData) => Promise<void>;
  branding: Branding;
  logoSrc: string | null;
  /** False while nothing is saved here and the portal still uses its orgs/ folder. */
  saved: boolean;
}) {
  const phone = branding.support.phoneDisplay || branding.support.phone;
  const whatsappDiffers = branding.support.whatsapp && `+${branding.support.whatsapp}` !== branding.support.phone;
  return (
    <form action={action} encType="multipart/form-data" className="space-y-6">
      {!saved && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nothing saved here yet, so the portal uses its orgs/ folder. These are starting values: saving them replaces the folder&apos;s.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo, first line" hint='Small text before the main word, e.g. "classes by". Can be empty.'>
              <input name="logoPrefix" maxLength={30} defaultValue={branding.logo.prefix} className={inputClass} />
            </Field>
            <Field label="Logo, main word">
              <input name="logoMain" required maxLength={30} defaultValue={branding.logo.main} className={inputClass} />
            </Field>
            <Field label="Short name" hint="The installed app's name under its icon.">
              <input name="shortName" required maxLength={30} defaultValue={branding.shortName} className={inputClass} />
            </Field>
            <Field label="Tagline">
              <input name="tagline" required maxLength={60} defaultValue={branding.tagline} className={inputClass} />
            </Field>
            <Field label="Phone" hint="Shown to students for support. 10 digits, or + and country code.">
              <input name="phone" required defaultValue={phone} className={inputClass} placeholder="+91 91239 24645" />
            </Field>
            <Field label="WhatsApp number" hint="Leave empty to use the phone number.">
              <input name="whatsapp" defaultValue={whatsappDiffers ? `+${branding.support.whatsapp}` : ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Logo image" hint="PNG, JPEG or WebP, square works best, up to 1 MB. Used in the portal and for its app icons. Without one, the atom mark is used.">
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700" />
          </Field>
          {logoSrc && (
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="removeLogo" className="h-4 w-4 rounded border-zinc-300" /> Remove the current logo
            </label>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand-900">Saved look</p>
          <Preview branding={branding} logoSrc={logoSrc} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-brand-900">Colours</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLOR_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-zinc-700">
              <input type="color" name={`color_${key}`} defaultValue={branding.colors[key]} className="h-9 w-12 shrink-0 cursor-pointer rounded border border-zinc-300 bg-white p-0.5" />
              {COLOR_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-brand-900">Features</legend>
        <p className="text-xs text-zinc-500">Off here turns it off in every test of this portal; tests keep their own setting for when it is back on.</p>
        {FEATURE_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" name={`feature_${key}`} defaultChecked={branding.features[key]} className="h-4 w-4 rounded border-zinc-300" />
            {FEATURE_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-brand-900">Privacy notice and terms</legend>
        <p className="text-xs text-zinc-500">Named in its portal&apos;s /privacy and /terms. Set the effective date only after a lawyer has reviewed them.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal name">
            <input name="entityName" maxLength={200} defaultValue={branding.legal.entityName ?? ""} className={inputClass} />
          </Field>
          <Field label="City for the courts clause">
            <input name="city" maxLength={80} defaultValue={branding.legal.city ?? ""} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input name="address" maxLength={300} defaultValue={branding.legal.address ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Grievance officer">
            <input name="grievanceName" maxLength={120} defaultValue={branding.legal.grievanceOfficer.name ?? ""} className={inputClass} />
          </Field>
          <Field label="Grievance officer's email">
            <input name="grievanceEmail" type="email" defaultValue={branding.legal.grievanceOfficer.email ?? ""} className={inputClass} />
          </Field>
          <Field label="In force from" hint="Empty keeps the draft banner.">
            <input name="effectiveDate" type="date" defaultValue={branding.legal.effectiveDate ?? ""} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <button type="submit" className={buttonClass}>
        Save branding
      </button>
    </form>
  );
}
