import { describe, expect, it } from "vitest";
import { signRequest, verifyRequest } from "./master-signature";

const now = new Date("2026-09-27T10:00:00Z");

describe("signed requests", () => {
  it("accepts a request signed with the same secret", () => {
    const header = signRequest("s3cret", "POST", "/api/portal/status", '{"a":1}', now);
    expect(verifyRequest("s3cret", header, "post", "/api/portal/status", '{"a":1}', now)).toBe(true);
  });
  it("refuses another secret, path, method or body", () => {
    const header = signRequest("s3cret", "GET", "/api/x", "", now);
    expect(verifyRequest("other", header, "GET", "/api/x", "", now)).toBe(false);
    expect(verifyRequest("s3cret", header, "GET", "/api/y", "", now)).toBe(false);
    expect(verifyRequest("s3cret", header, "POST", "/api/x", "", now)).toBe(false);
    expect(verifyRequest("s3cret", header, "GET", "/api/x", "x", now)).toBe(false);
  });
  it("refuses a replay after five minutes", () => {
    const header = signRequest("s3cret", "GET", "/api/x", "", now);
    expect(verifyRequest("s3cret", header, "GET", "/api/x", "", new Date(now.getTime() + 299_000))).toBe(true);
    expect(verifyRequest("s3cret", header, "GET", "/api/x", "", new Date(now.getTime() + 301_000))).toBe(false);
  });
  it("refuses a missing or malformed header, or an empty secret", () => {
    expect(verifyRequest("s3cret", null, "GET", "/api/x")).toBe(false);
    expect(verifyRequest("s3cret", "t=1,v1=zz", "GET", "/api/x")).toBe(false);
    expect(verifyRequest("", signRequest("", "GET", "/api/x"), "GET", "/api/x")).toBe(false);
  });
});
