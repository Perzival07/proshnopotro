/**
 * Applies prisma/schema.prisma to every organisation's database.
 *
 *   npm run db:push:all                      show what would change, per organisation
 *   npm run db:push:all -- --apply           make those changes
 *   npm run db:push:all -- --only a,b        just these organisations
 *   npm run db:push:all -- --apply --accept-data-loss
 *                                            also allow dropping columns or tables
 *
 * Each organisation's database address is read from orgs/<slug>/.env.local
 * (DIRECT_URL, else DATABASE_URL), which git ignores. An organisation without
 * one is skipped and listed. One failure does not stop the others; the exit
 * code is 1 if any failed. Addresses are never printed in full.
 *
 * Run it before deploying a portal change that alters the schema, so every
 * organisation's database is ready when its new code arrives.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ORGS_DIR } from "../org-loader.mjs";
import { describeDatabase, parseEnvFile, parsePushArgs, schemaUrl } from "../lib/schema-push";

const PORTAL = path.resolve(__dirname, "..");
const SCHEMA = path.join(PORTAL, "prisma", "schema.prisma");
const PRISMA = path.join(PORTAL, "node_modules", ".bin", "prisma");
/** A new database's SQL is the whole schema; the start is enough to recognise it. */
const PREVIEW_LINES = 40;

const options = parsePushArgs(process.argv.slice(2));
if ("error" in options) {
  console.error(options.error);
  process.exit(2);
}

const allSlugs = fs
  .readdirSync(ORGS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(ORGS_DIR, d.name, "org.json")))
  .map((d) => d.name)
  .sort();
const unknown = (options.only ?? []).filter((s) => !allSlugs.includes(s));
if (unknown.length) {
  console.error(`No such organisation in orgs/: ${unknown.join(", ")}`);
  process.exit(2);
}
const slugs = options.only ?? allSlugs;

function prisma(args: string[], url: string) {
  return spawnSync(PRISMA, args, {
    cwd: PORTAL,
    encoding: "utf8",
    // Both, so neither the schema's url nor directUrl falls back to portal/.env.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

type Outcome = "up to date" | "changes" | "applied" | "skipped" | "failed";
const results: { slug: string; outcome: Outcome; detail?: string }[] = [];

console.log(options.apply ? "Applying the schema to each organisation's database.\n" : "Preview only: nothing is changed. Add --apply to make these changes.\n");

for (const slug of slugs) {
  const envFile = path.join(ORGS_DIR, slug, ".env.local");
  const url = fs.existsSync(envFile) ? schemaUrl(parseEnvFile(fs.readFileSync(envFile, "utf8"))) : null;
  if (!url) {
    results.push({ slug, outcome: "skipped", detail: `no DIRECT_URL in orgs/${slug}/.env.local` });
    console.log(`── ${slug}: skipped (no DIRECT_URL in orgs/${slug}/.env.local)\n`);
    continue;
  }
  console.log(`── ${slug} (${describeDatabase(url)})`);

  // What the database lacks, as SQL. --exit-code: 0 = nothing, 2 = changes, 1 = error.
  const diff = prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", SCHEMA, "--script", "--exit-code"], url);
  if (diff.status === 0) {
    results.push({ slug, outcome: "up to date" });
    console.log("   up to date\n");
    continue;
  }
  if (diff.status !== 2) {
    const detail = (diff.stderr || diff.stdout || String(diff.error ?? "")).trim().split("\n").slice(-3).join(" ");
    results.push({ slug, outcome: "failed", detail });
    console.log(`   could not compare: ${detail}\n`);
    continue;
  }
  const sql = diff.stdout.trim().split("\n");
  console.log(sql.slice(0, PREVIEW_LINES).map((l) => `   ${l}`).join("\n"));
  if (sql.length > PREVIEW_LINES) console.log(`   … ${sql.length - PREVIEW_LINES} more lines`);

  if (!options.apply) {
    results.push({ slug, outcome: "changes" });
    console.log("");
    continue;
  }
  const push = prisma(["db", "push", "--skip-generate", "--schema", SCHEMA, ...(options.acceptDataLoss ? ["--accept-data-loss"] : [])], url);
  if (push.status === 0) {
    results.push({ slug, outcome: "applied" });
    console.log("   applied\n");
  } else {
    const out = `${push.stdout}\n${push.stderr}`;
    const detail = /data loss/i.test(out)
      ? "would lose data; check the SQL above, then re-run with --accept-data-loss"
      : out.trim().split("\n").slice(-3).join(" ");
    results.push({ slug, outcome: "failed", detail });
    console.log(`   failed: ${detail}\n`);
  }
}

console.log("Summary");
for (const r of results) console.log(`  ${r.slug.padEnd(28)} ${r.outcome}${r.detail ? ` (${r.detail})` : ""}`);
process.exit(results.some((r) => r.outcome === "failed") ? 1 : 0);
