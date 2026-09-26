import { describe, it, expect } from "vitest";
import { buildWhatsAppLink, workDoneMessage } from "./whatsapp";

describe("buildWhatsAppLink", () => {
  it("strips formatting from the number", () => {
    expect(buildWhatsAppLink("+91 91239 24645", "")).toBe("https://wa.me/919123924645");
  });
  it("percent-encodes the message", () => {
    expect(buildWhatsAppLink("919123924645", "Hi & bye?"))
      .toBe("https://wa.me/919123924645?text=Hi%20%26%20bye%3F");
  });
  it("omits the text param when the message is blank", () => {
    expect(buildWhatsAppLink("919123924645", "   ")).toBe("https://wa.me/919123924645");
  });
  it("encodes quotes in a test title", () => {
    const link = buildWhatsAppLink("919123924645", workDoneMessage('Unit "3"', null));
    expect(link).toContain("%22");
    expect(link.startsWith("https://wa.me/919123924645?text=")).toBe(true);
  });
});

describe("workDoneMessage", () => {
  it("says the work is done and names the test", () => {
    expect(workDoneMessage("Verbs Test", null)).toBe(
      'Work done. I have uploaded my answers for "Verbs Test".');
  });
  it("includes the student when known", () => {
    expect(workDoneMessage("Verbs Test", "Rahul")).toBe(
      'Work done. I have uploaded my answers for "Verbs Test". I am Rahul.');
  });
  it("ignores a blank student name", () => {
    expect(workDoneMessage("Verbs Test", "   ")).toBe(
      'Work done. I have uploaded my answers for "Verbs Test".');
  });
});
