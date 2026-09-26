/**
 * Reads the organisation this deployment serves from ../orgs/<ORG>/org.json.
 *
 * Runs in Node at build time only (next.config.mjs, tailwind.config.ts,
 * vitest.config.ts). The app itself never touches the file system for this:
 * next.config.mjs hands the public branding to the code as ORG_BRANDING.
 * Billing and limits stay here, so they never reach a browser bundle.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ORGS_DIR = path.resolve(here, "../orgs");
// The original single site. Keeping it the default means a deployment with
// no ORG set carries on exactly as before the repo was split.
export const DEFAULT_ORG = "classes-by-koustav";

export function loadOrg(slug = process.env.ORG || DEFAULT_ORG) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`ORG="${slug}" is not a valid organisation folder name`);
  }
  const file = path.join(ORGS_DIR, slug, "org.json");
  if (!fs.existsSync(file)) {
    throw new Error(`ORG="${slug}" but ${file} does not exist`);
  }
  const org = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of ["slug", "name", "shortName", "logo", "tagline", "support", "colors", "features"]) {
    if (org[key] == null) throw new Error(`${file} is missing "${key}"`);
  }
  if (org.slug !== slug) {
    throw new Error(`${file} has slug "${org.slug}", expected "${slug}"`);
  }
  return org;
}

/** The part of the organisation's settings that is safe to ship to browsers. */
export function publicBranding(org) {
  const { slug, name, shortName, logo, tagline, support, colors, features } = org;
  return { slug, name, shortName, logo, tagline, support, colors, features };
}
