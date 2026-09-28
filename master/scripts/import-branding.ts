/**
 * Copies an organisation's branding from ../orgs/<slug>/org.json into the
 * master, for an organisation that was set up with a folder before branding
 * moved here. The organisation must already exist in /admin.
 *
 *   npm run org:import-branding -- <slug>
 *
 * Needs the master's DATABASE_URL (e.g. `set -a; source .env.local; set +a`
 * first). It does not rebuild the portal: press "Rebuild portal now" or save
 * the branding in /admin afterwards. Icons in the folder are not copied; upload
 * a logo in /admin to replace the atom mark.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Branding } from "../lib/branding";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error("Usage: npm run org:import-branding -- <slug>");
  process.exit(2);
}
const file = path.resolve(__dirname, "../../orgs", slug, "org.json");
if (!fs.existsSync(file)) {
  console.error(`${file} does not exist`);
  process.exit(2);
}
const json = JSON.parse(fs.readFileSync(file, "utf8"));
const legal = json.legal ?? {};
const branding: Branding = {
  shortName: json.shortName,
  logo: json.logo,
  tagline: json.tagline,
  support: json.support,
  colors: json.colors,
  features: json.features,
  legal: {
    entityName: legal.entityName ?? null,
    address: legal.address ?? null,
    city: legal.city ?? null,
    grievanceOfficer: { name: legal.grievanceOfficer?.name ?? null, email: legal.grievanceOfficer?.email ?? null },
    effectiveDate: legal.effectiveDate ?? null,
  },
};

const prisma = new PrismaClient();
prisma.organisation
  .update({ where: { slug }, data: { branding, brandingSavedAt: new Date() } })
  .then((org) => console.log(`Imported the branding of ${org.name} from orgs/${slug}/org.json.`))
  .catch((err) => {
    console.error(err.code === "P2025" ? `No organisation "${slug}" in the master: add it in /admin first.` : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
