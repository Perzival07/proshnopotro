import { prisma } from "./prisma";
import { paymentInstructions as defaultInstructions } from "./site";

export type Settings = { defaultPricePerStudentInr: number; paymentInstructions: string };

/** The platform settings, with the defaults when none are saved yet. */
export async function getSettings(): Promise<Settings> {
  const row = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  return {
    defaultPricePerStudentInr: row?.defaultPricePerStudentInr ?? 0,
    paymentInstructions: row?.paymentInstructions || defaultInstructions,
  };
}
