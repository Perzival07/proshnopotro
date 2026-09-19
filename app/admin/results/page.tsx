import React from "react";
import { prisma } from "@/lib/prisma";
import { ResultsClient } from "./ResultsClient";
import { requireAdmin } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  // Owner only: the layout lets tutors in, so every page says who may see it.
  await requireAdmin();
  const tests = await prisma.test.findMany({
    where: { bank: false },
    select: {
      id: true,
      title: true,
      subject: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <ResultsClient tests={tests} />;
}
