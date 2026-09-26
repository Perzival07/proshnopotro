"use server";

import { randomBytes } from "crypto";
import { requireCompleteStudent } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * The student's read-only progress link for a parent: made on request,
 * replaced on request (which cuts off the old one), or switched off.
 */
export async function setParentLink(action: "create" | "reset" | "remove"): Promise<{ token?: string | null; error?: string }> {
  const user = await requireCompleteStudent();
  const token = action === "remove" ? null : randomBytes(18).toString("base64url");
  await prisma.user.update({ where: { email: user.email }, data: { parentToken: token } });
  return { token };
}
