/**
 * Sets up a new organisation's portal in one go, all in your one Vercel
 * account:
 *
 *   1. creates the tables in its (new, empty) database
 *   2. registers it in the master, with starting branding
 *   3. creates its Vercel project from this repo (Root Directory portal) with
 *      every environment variable it needs
 *   4. adds its custom domain, if given
 *   5. starts its first deployment
 *   6. writes orgs/<slug>/.env.local so npm run db:push:all reaches it
 *
 * Then it prints the two steps no API can do (the Google redirect URI and the
 * deploy hook). Run from master/, with its .env.local loaded:
 *
 *   set -a; source .env.local; set +a
 *   npm run add-org -- --slug new-org --name "New Org Academy" --phone 9000000002 \
 *     --admins owner@neworg.in --database-url "postgresql://...:6543/postgres?pgbouncer=true" \
 *     --direct-url "postgresql://...:5432/postgres" [--cloudinary-url cloudinary://...] \
 *     [--domain neworg.proshnopotro.in] [--price 40] [--dry-run]
 *
 * Needs, besides the master's own DATABASE_URL and AUTH_GOOGLE_ID/SECRET:
 *   VERCEL_TOKEN        a Vercel access token (Account Settings -> Tokens)
 *   VERCEL_TEAM_ID      if the projects live in a Vercel team
 *   GITHUB_REPO         this repo, as owner/name
 *   MASTER_PUBLIC_URL   the master's live address, e.g. https://proshnopotro.in
 *   SHARED_CLOUDINARY_URL  optional default for --cloudinary-url
 *
 * --dry-run checks everything and prints the plan without changing anything.
 * On a failure it stops and says what was already done.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { defaultBranding, normalisePhone } from "../lib/branding";
import { describeHost, parseAddOrgArgs, portalEnv, portalUrlFor, type AddOrgOptions } from "../lib/provision";

const REPO_ROOT = path.resolve(__dirname, "../..");
const PORTAL = path.join(REPO_ROOT, "portal");

const parsed = parseAddOrgArgs(process.argv.slice(2), process.env);
if ("error" in parsed) {
  console.error(parsed.error);
  process.exit(2);
}
const options: AddOrgOptions = parsed;

const missing = ["DATABASE_URL", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "VERCEL_TOKEN", "GITHUB_REPO", "MASTER_PUBLIC_URL"].filter(
  (k) => !process.env[k]
);
if (missing.length) {
  console.error(`Set these first (in master/.env.local, then \`set -a; source .env.local; set +a\`): ${missing.join(", ")}`);
  process.exit(2);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPO!)) {
  console.error("GITHUB_REPO must be owner/name, e.g. Perzival07/proshnopotro");
  process.exit(2);
}

const token = process.env.VERCEL_TOKEN!;
// Overridable only so the script can be tried against a stand-in server.
const VERCEL_API = process.env.VERCEL_API_URL || "https://api.vercel.com";
const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
const masterUrl = process.env.MASTER_PUBLIC_URL!.replace(/\/+$/, "");
const portalUrl = portalUrlFor(options);
const syncSecret = randomBytes(32).toString("base64url");
const env = portalEnv(options, {
  masterUrl,
  syncSecret,
  authSecret: randomBytes(32).toString("base64"),
  googleId: process.env.AUTH_GOOGLE_ID!,
  googleSecret: process.env.AUTH_GOOGLE_SECRET!,
});

const done: string[] = [];
function step(text: string) {
  console.log(`\n→ ${text}`);
}
function fail(why: string): never {
  console.error(`\n✗ ${why}`);
  if (done.length) {
    console.error("\nAlready done (undo these before trying again, or finish by hand):");
    for (const d of done) console.error(`  - ${d}`);
  }
  process.exit(1);
}

async function vercel(method: string, route: string, body?: unknown): Promise<{ status: number; json: any }> {
  const sep = route.includes("?") ? "&" : "?";
  const res = await fetch(`${VERCEL_API}${route}${team ? sep + team.slice(1) : ""}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`Setting up ${options.name} (${options.slug}) at ${portalUrl}${options.dryRun ? "  [dry run: nothing is changed]" : ""}`);
    console.log(`  database: ${describeHost(options.directUrl)}`);
    console.log(`  owner(s): ${options.admins.join(", ")}`);
    console.log(`  variables: ${env.map((e) => e.key).join(", ")}`);

    step("Checking the slug is free in the master and in Vercel");
    if (await prisma.organisation.findUnique({ where: { slug: options.slug } })) {
      fail(`The master already has an organisation "${options.slug}".`);
    }
    const existing = await vercel("GET", `/v9/projects/${options.slug}`);
    if (existing.status === 200) fail(`Vercel already has a project called "${options.slug}".`);
    if (existing.status === 401 || existing.status === 403) fail("Vercel refused the token: check VERCEL_TOKEN (and VERCEL_TEAM_ID).");
    console.log("  free");

    if (options.dryRun) {
      console.log("\nDry run finished: everything checks out. Run again without --dry-run to set it up.");
      return;
    }

    step("Creating the tables in its database");
    const push = spawnSync(path.join(PORTAL, "node_modules", ".bin", "prisma"), ["db", "push", "--skip-generate"], {
      cwd: PORTAL,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: options.directUrl, DIRECT_URL: options.directUrl },
    });
    if (push.status !== 0) fail(`prisma db push failed:\n${(push.stderr || push.stdout).trim().split("\n").slice(-4).join("\n")}`);
    done.push(`tables created in ${describeHost(options.directUrl)}`);

    step("Registering it in the master");
    const phone = normalisePhone(options.phone)!;
    const branding = defaultBranding(options.name);
    branding.support = { phone: phone.phone, phoneDisplay: phone.phoneDisplay, whatsapp: phone.whatsapp };
    await prisma.organisation.create({
      data: {
        slug: options.slug,
        name: options.name,
        portalUrl,
        pricePerStudentInr: options.pricePerStudentInr,
        syncSecret,
        branding,
        brandingSavedAt: new Date(),
      },
    });
    done.push(`"${options.slug}" added to the master (delete it in /admin)`);

    step("Creating its Vercel project");
    const created = await vercel("POST", "/v11/projects", {
      name: options.slug,
      framework: "nextjs",
      rootDirectory: "portal",
      gitRepository: { type: "github", repo: process.env.GITHUB_REPO },
      environmentVariables: env.map((e) => ({ key: e.key, value: e.value, type: "encrypted", target: ["production", "preview"] })),
    });
    if (created.status >= 300) fail(`Vercel could not create the project (${created.status}): ${created.json?.error?.message ?? "unknown error"}`);
    const projectId: string = created.json.id;
    done.push(`Vercel project "${options.slug}" created (delete it in Vercel → Settings → Advanced)`);

    // The portal reads ../orgs at build time, outside its Root Directory.
    const patched = await vercel("PATCH", `/v9/projects/${projectId}`, { sourceFilesOutsideRootDirectory: true });
    if (patched.status >= 300) {
      fail(`Could not turn on "Include files outside the Root Directory" (${patched.status}); turn it on in the project's Build settings`);
    }

    if (options.domain) {
      step(`Adding the domain ${options.domain}`);
      const d = await vercel("POST", `/v10/projects/${projectId}/domains`, { name: options.domain });
      if (d.status >= 300) fail(`Vercel could not add ${options.domain} (${d.status}): ${d.json?.error?.message ?? "unknown error"}`);
      done.push(`domain ${options.domain} added`);
    }

    step("Starting its first deployment");
    const repoId = created.json.link?.repoId;
    if (!repoId) fail("Vercel did not link the GitHub repo: check the Vercel GitHub app can see it.");
    const deployment = await vercel("POST", "/v13/deployments", {
      name: options.slug,
      project: projectId,
      target: "production",
      gitSource: { type: "github", repoId, ref: "main" },
    });
    if (deployment.status >= 300) fail(`Vercel could not start the deployment (${deployment.status}): ${deployment.json?.error?.message ?? "unknown error"}`);
    done.push("first deployment started");

    step("Saving its database address for npm run db:push:all");
    const orgDir = path.join(REPO_ROOT, "orgs", options.slug);
    fs.mkdirSync(orgDir, { recursive: true });
    fs.writeFileSync(path.join(orgDir, ".env.local"), `DIRECT_URL=${JSON.stringify(options.directUrl)}\n`, { mode: 0o600 });

    console.log(`
✓ ${options.name} is set up. Its first build takes a few minutes: https://vercel.com (project "${options.slug}").

Two steps left, by hand:
  1. Google Cloud Console → APIs & Services → Credentials → the OAuth client →
     Authorised redirect URIs: add ${portalUrl}/api/auth/callback/google
  2. Vercel → project "${options.slug}" → Settings → Git → Deploy Hooks: create one for
     branch main, and paste it into the Deploy hook field on ${masterUrl}/admin/orgs/${options.slug}
${options.domain ? `  3. Point ${options.domain} at Vercel in your DNS (Vercel shows the record under the project's Domains).\n` : ""}
Then set its logo, colours and details in the Branding section there, and
send ${options.admins.join(", ")} to ${portalUrl} to sign in.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
