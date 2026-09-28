import { redirect } from "next/navigation";

/** Ends a server action by going back to a page with a message in the address, which the page shows (components/admin/ui Flash). */
export function back(path: string, message: { ok: string } | { error: string }): never {
  const key = "ok" in message ? "ok" : "error";
  const text = "ok" in message ? message.ok : message.error;
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${key}=${encodeURIComponent(text)}`);
}
