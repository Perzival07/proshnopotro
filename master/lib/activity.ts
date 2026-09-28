import { prisma } from "./prisma";

/**
 * Notes what a super admin did, for /admin/activity. Never fails the action
 * it records: a lost log line is better than a payment not saved.
 */
export async function logActivity(
  actor: string,
  action: string,
  opts: { org?: { id: string; name: string }; detail?: string } = {}
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { actor, action, orgId: opts.org?.id ?? null, orgName: opts.org?.name ?? "", detail: (opts.detail ?? "").slice(0, 1000) },
    });
  } catch (err) {
    console.error("[activity] could not log:", err);
  }
}
