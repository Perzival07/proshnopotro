import React from "react";
import { prisma } from "@/lib/prisma";
import { SeriesClient } from "./SeriesClient";

export const dynamic = "force-dynamic";

export default async function SeriesPage() {
  const [series, loose] = await Promise.all([
    prisma.testSeries.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        tests: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, subject: true, _count: { select: { assignments: true } } } },
      },
    }),
    prisma.test.findMany({
      where: { bank: false, seriesId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, subject: true },
    }),
  ]);
  return (
    <SeriesClient
      initial={series.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        tests: s.tests.map((t) => ({ id: t.id, title: t.title, subject: t.subject, assigned: t._count.assignments })),
      }))}
      loose={loose}
    />
  );
}
