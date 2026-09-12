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

/**
 * The message a student sends once their answer photos are uploaded. The
 * photos themselves live in the portal; this only tells the tutor to look.
 */
export function workDoneMessage(testTitle: string, studentName?: string | null) {
  const who = studentName?.trim() ? ` I am ${studentName.trim()}.` : "";
  return `Work done. I have uploaded my answers for "${testTitle}".${who}`;
}
