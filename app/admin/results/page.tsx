import React from "react";
import { prisma } from "@/lib/prisma";
import { ResultsClient } from "./ResultsClient";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const tests = await prisma.test.findMany({
    select: {
      id: true,
      title: true,
      subject: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <ResultsClient tests={tests} />;
}
