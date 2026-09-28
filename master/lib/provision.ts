/**
 * The pure parts of scripts/add-org.ts: reading its arguments, and the
 * environment variables a new organisation's Vercel project gets.
 */
import { normalisePhone } from "./branding";
import { normalisePortalUrl } from "./org-input";

export type AddOrgOptions = {
  slug: string;
  name: string;
  phone: string;
  /** The owner(s) of the new portal: its ADMIN_EMAILS. */
  admins: string[];
  /** Pooled (Supabase port 6543) and direct (5432) addresses of its new database. */
  databaseUrl: string;
  directUrl: string;
  /** cloudinary://<key>:<secret>@<cloud>; its own account, or a shared one. */
  cloudinaryUrl: string;
  /** A custom domain for the portal; else <slug>.vercel.app is used. */
  domain: string | null;
  pricePerStudentInr: number;
  dryRun: boolean;
};

const USAGE = `Usage: npm run add-org -- --slug <slug> --name "<name>" --phone <phone> --admins <email,...>
  --database-url <pooled url> --direct-url <direct url> [--cloudinary-url cloudinary://...]
  [--domain <portal domain>] [--price <rupees per student>] [--dry-run]`;

export function parseAddOrgArgs(argv: string[], env: Record<string, string | undefined>): AddOrgOptions | { error: string } {
  const values: Record<string, string> = {};
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!m) return { error: `Unexpected argument: ${arg}\n${USAGE}` };
    const value = m[2] ?? argv[++i];
    if (value === undefined || value.startsWith("--")) return { error: `--${m[1]} needs a value\n${USAGE}` };
    values[m[1]] = value.trim();
  }
  const known = ["slug", "name", "phone", "admins", "database-url", "direct-url", "cloudinary-url", "domain", "price"];
  const unknown = Object.keys(values).filter((k) => !known.includes(k));
  if (unknown.length) return { error: `Unknown option: --${unknown[0]}\n${USAGE}` };

  const slug = values.slug?.toLowerCase() ?? "";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 40) return { error: `--slug: lower-case letters, digits and hyphens\n${USAGE}` };
  if (!values.name) return { error: `--name is needed\n${USAGE}` };
  if (!values.phone || !normalisePhone(values.phone)) return { error: "--phone: 10 digits, or + and the country code" };
  const admins = (values.admins ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.length === 0 || admins.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
    return { error: "--admins: the owner's email(s), comma-separated" };
  }
  for (const key of ["database-url", "direct-url"]) {
    if (!/^postgres(ql)?:\/\//.test(values[key] ?? "")) return { error: `--${key}: a postgresql:// address` };
  }
  const cloudinaryUrl = values["cloudinary-url"] || env.SHARED_CLOUDINARY_URL || "";
  if (!/^cloudinary:\/\/[^:]+:[^@]+@[\w-]+$/.test(cloudinaryUrl)) {
    return { error: "--cloudinary-url cloudinary://<key>:<secret>@<cloud> (or set SHARED_CLOUDINARY_URL)" };
  }
  const domain = values.domain ? values.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
  if (domain && !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) return { error: "--domain: a host name like koustav.proshnopotro.in" };
  const price = values.price ? Number(values.price) : 0;
  if (!Number.isInteger(price) || price < 0) return { error: "--price: whole rupees" };

  return {
    slug,
    name: values.name,
    phone: values.phone,
    admins,
    databaseUrl: values["database-url"],
    directUrl: values["direct-url"],
    cloudinaryUrl,
    domain,
    pricePerStudentInr: price,
    dryRun,
  };
}

/** Where the new portal will answer. */
export function portalUrlFor(options: Pick<AddOrgOptions, "slug" | "domain">): string {
  return normalisePortalUrl(`https://${options.domain ?? `${options.slug}.vercel.app`}`)!;
}

export type EnvVar = { key: string; value: string; secret: boolean };

/** Every variable the portal's Vercel project needs (see portal/.env.example). */
export function portalEnv(
  options: AddOrgOptions,
  shared: { masterUrl: string; syncSecret: string; authSecret: string; googleId: string; googleSecret: string }
): EnvVar[] {
  return [
    { key: "ORG", value: options.slug, secret: false },
    { key: "DATABASE_URL", value: options.databaseUrl, secret: true },
    { key: "DIRECT_URL", value: options.directUrl, secret: true },
    { key: "AUTH_SECRET", value: shared.authSecret, secret: true },
    { key: "AUTH_URL", value: portalUrlFor(options), secret: false },
    { key: "AUTH_GOOGLE_ID", value: shared.googleId, secret: false },
    { key: "AUTH_GOOGLE_SECRET", value: shared.googleSecret, secret: true },
    { key: "ADMIN_EMAILS", value: options.admins.join(","), secret: false },
    { key: "CLOUDINARY_URL", value: options.cloudinaryUrl, secret: true },
    { key: "MASTER_URL", value: shared.masterUrl, secret: false },
    { key: "MASTER_SYNC_SECRET", value: shared.syncSecret, secret: true },
  ];
}

/** A database address for the log, without its user name or password. */
export function describeHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(unreadable address)";
  }
}
