import { describe, expect, it } from "vitest";
import { describeHost, parseAddOrgArgs, portalEnv, portalUrlFor } from "./provision";

const base = [
  "--slug", "new-org", "--name", "New Org Academy", "--phone", "9000000002", "--admins", "Owner@x.in",
  "--database-url", "postgresql://u:p@h:6543/postgres", "--direct-url", "postgresql://u:p@h:5432/postgres",
  "--cloudinary-url", "cloudinary://key:secret@cloud1",
];

describe("parseAddOrgArgs", () => {
  it("reads a full command, in both --key value and --key=value forms", () => {
    const r = parseAddOrgArgs([...base, "--price=40", "--dry-run"], {});
    expect(r).toMatchObject({ slug: "new-org", admins: ["owner@x.in"], pricePerStudentInr: 40, dryRun: true, domain: null });
  });
  it("falls back on SHARED_CLOUDINARY_URL", () => {
    const noCloud = base.slice(0, -2);
    expect(parseAddOrgArgs(noCloud, {})).toHaveProperty("error");
    expect(parseAddOrgArgs(noCloud, { SHARED_CLOUDINARY_URL: "cloudinary://k:s@shared" })).toMatchObject({ cloudinaryUrl: "cloudinary://k:s@shared" });
  });
  it("refuses a bad slug, email, database address, domain or unknown option", () => {
    const withValue = (key: string, value: string) => {
      const args = [...base];
      args[args.indexOf(key) + 1] = value;
      return parseAddOrgArgs(args, {});
    };
    expect(withValue("--slug", "New Org")).toHaveProperty("error");
    expect(withValue("--admins", "nope")).toHaveProperty("error");
    expect(withValue("--database-url", "mysql://x")).toHaveProperty("error");
    expect(parseAddOrgArgs([...base, "--domain", "not a domain"], {})).toHaveProperty("error");
    expect(parseAddOrgArgs([...base, "--colour", "red"], {})).toHaveProperty("error");
    expect(parseAddOrgArgs([...base, "--domain"], {})).toHaveProperty("error");
  });
});

describe("portal address and variables", () => {
  const options = parseAddOrgArgs(base, {}) as Exclude<ReturnType<typeof parseAddOrgArgs>, { error: string }>;
  it("uses the custom domain when given, else <slug>.vercel.app", () => {
    expect(portalUrlFor(options)).toBe("https://new-org.vercel.app");
    expect(portalUrlFor({ slug: "x", domain: "x.proshnopotro.in" })).toBe("https://x.proshnopotro.in");
  });
  it("sets everything the portal needs, secrets marked", () => {
    const env = portalEnv(options, { masterUrl: "https://m.in", syncSecret: "s", authSecret: "a", googleId: "g", googleSecret: "gs" });
    expect(Object.fromEntries(env.map((e) => [e.key, e.value]))).toMatchObject({
      ORG: "new-org",
      AUTH_URL: "https://new-org.vercel.app",
      ADMIN_EMAILS: "owner@x.in",
      MASTER_URL: "https://m.in",
      MASTER_SYNC_SECRET: "s",
    });
    expect(env.filter((e) => e.secret).map((e) => e.key)).toEqual([
      "DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "AUTH_GOOGLE_SECRET", "CLOUDINARY_URL", "MASTER_SYNC_SECRET",
    ]);
  });
});

describe("describeHost", () => {
  it("never shows the password", () => {
    expect(describeHost("postgresql://postgres.ref:s3cret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres")).toBe(
      "aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    );
  });
});
