import React from "react";
import { prisma } from "@/lib/prisma";
import { BankClient, type BankPaper } from "./BankClient";

export const dynamic = "force-dynamic";

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: { board?: string; class?: string; subject?: string; year?: string };
}) {
  const filters = {
    board: searchParams.board || undefined,
    classLevel: searchParams.class || undefined,
    subject: searchParams.subject || undefined,
    year: searchParams.year ? Number(searchParams.year) || undefined : undefined,
  };
  const [papers, years] = await Promise.all([
    prisma.test.findMany({
      where: { bank: true, ...filters },
      orderBy: [{ year: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        examName: true,
        board: true,
        classLevel: true,
        subject: true,
        year: true,
        sections: { select: { _count: { select: { questions: true } } } },
      },
    }),
    prisma.test.findMany({ where: { bank: true }, distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
  ]);

  const rows: BankPaper[] = papers.map((p) => ({
    id: p.id,
    title: p.title,
    examName: p.examName,
    board: p.board ?? "",
    classLevel: p.classLevel ?? "",
    subject: p.subject,
    year: p.year ?? 0,
    questions: p.sections.reduce((n, s) => n + s._count.questions, 0),
  }));

  return (
    <BankClient
      papers={rows}
      years={years.map((y) => y.year).filter((y): y is number => !!y)}
      filters={{
        board: searchParams.board ?? "",
        classLevel: searchParams.class ?? "",
        subject: searchParams.subject ?? "",
        year: searchParams.year ?? "",
      }}
    />
  );
}
