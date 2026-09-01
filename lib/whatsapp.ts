/** The tutor's WhatsApp number, digits only, including country code. */
export const TUTOR_WHATSAPP = process.env.NEXT_PUBLIC_TUTOR_WHATSAPP || "919123924645";

/**
 * Builds a wa.me link with a prefilled message.
 *
 * wa.me requires the number as digits only -- no +, spaces or dashes -- and
 * the text percent-encoded.
 */
export function buildWhatsAppLink(
  phone: string,
  message: string
): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message.trim()
    ? `${base}?text=${encodeURIComponent(message.trim())}`
    : base;
}

/** The message a student sends when submitting a written paper's answers. */
export function answersMessage(testTitle: string, studentName?: string | null) {
  const who = studentName?.trim() ? ` I am ${studentName.trim()}.` : "";
  return `Hello Sir, here are my answers for "${testTitle}".${who}`;
}
