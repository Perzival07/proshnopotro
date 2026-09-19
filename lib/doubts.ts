/** Limits and small rules for doubt threads. */

export const MAX_DOUBT_LENGTH = 2000;
export const MAX_MESSAGES_PER_THREAD = 100;

export type DoubtStatusName = "OPEN" | "ANSWERED" | "RESOLVED";

/** A message body, trimmed, or the reason it cannot be sent. */
export function checkDoubtBody(raw: string): { body: string } | { error: string } {
  const body = raw.replace(/\r\n?/g, "\n").trim();
  if (!body) return { error: "Write your question first." };
  if (body.length > MAX_DOUBT_LENGTH) return { error: `Keep it under ${MAX_DOUBT_LENGTH} characters.` };
  return { body };
}

/** Who has to move next, for the labels on a thread. */
export function statusLabel(status: DoubtStatusName, viewer: "student" | "tutor"): string {
  if (status === "RESOLVED") return "Resolved";
  if (status === "OPEN") return viewer === "tutor" ? "Needs a reply" : "Waiting for your tutor";
  return viewer === "tutor" ? "Replied" : "Answered";
}

/**
 * The status after a message: a student's question (or follow-up) reopens the
 * thread, a tutor's reply answers it.
 */
export function statusAfterMessage(fromTutor: boolean): DoubtStatusName {
  return fromTutor ? "ANSWERED" : "OPEN";
}
