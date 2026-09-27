import { describe, expect, it } from "vitest";
import { describeDatabase, parseEnvFile, parsePushArgs, schemaUrl } from "./schema-push";

describe("parsePushArgs", () => {
  it("previews every organisation by default", () => {
    expect(parsePushArgs([])).toEqual({ apply: false, acceptDataLoss: false, only: null });
  });
  it("reads --apply, --accept-data-loss and --only in both forms", () => {
    expect(parsePushArgs(["--apply", "--accept-data-loss", "--only", "a, b"])).toEqual({ apply: true, acceptDataLoss: true, only: ["a", "b"] });
    expect(parsePushArgs(["--only=a"])).toMatchObject({ only: ["a"] });
  });
  it("refuses unknown arguments, an empty --only and data loss without --apply", () => {
    expect(parsePushArgs(["--force"])).toHaveProperty("error");
    expect(parsePushArgs(["--only"])).toHaveProperty("error");
    expect(parsePushArgs(["--accept-data-loss"])).toHaveProperty("error");
  });
});

describe("parseEnvFile", () => {
  it("reads quoted, unquoted and exported values and skips comments", () => {
    const env = parseEnvFile(
      ['# a comment', 'DATABASE_URL="postgres://u:p@h:6543/db?pgbouncer=true"', "export DIRECT_URL='postgres://u:p@h:5432/db'", "PLAIN=x # note", "", "junk line"].join("\n")
    );
    expect(env).toEqual({
      DATABASE_URL: "postgres://u:p@h:6543/db?pgbouncer=true",
      DIRECT_URL: "postgres://u:p@h:5432/db",
      PLAIN: "x",
    });
  });
});

describe("schemaUrl and describeDatabase", () => {
  it("prefers the direct connection", () => {
    expect(schemaUrl({ DATABASE_URL: "pooled", DIRECT_URL: "direct" })).toBe("direct");
    expect(schemaUrl({ DATABASE_URL: "pooled" })).toBe("pooled");
    expect(schemaUrl({})).toBeNull();
  });
  it("never shows the password", () => {
    expect(describeDatabase("postgresql://postgres.ref:s3cret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres")).toBe(
      "aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    );
  });
});
