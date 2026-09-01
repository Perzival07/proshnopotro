import { describe, it, expect } from "vitest";
import { buildWhatsAppLink, answersMessage } from "./whatsapp";

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
    const link = buildWhatsAppLink("919123924645", answersMessage('Unit "3"', null));
    expect(link).toContain("%22");
    expect(link.startsWith("https://wa.me/919123924645?text=")).toBe(true);
  });
});

describe("answersMessage", () => {
  it("names the test", () => {
    expect(answersMessage("Verbs Test", null)).toBe(
      'Hello Sir, here are my answers for "Verbs Test".');
  });
  it("includes the student when known", () => {
    expect(answersMessage("Verbs Test", "Rahul")).toBe(
      'Hello Sir, here are my answers for "Verbs Test". I am Rahul.');
  });
  it("ignores a blank student name", () => {
    expect(answersMessage("Verbs Test", "   ")).toBe(
      'Hello Sir, here are my answers for "Verbs Test".');
  });
});
