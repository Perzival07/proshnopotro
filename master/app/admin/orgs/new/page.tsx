import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createOrg } from "../../actions";
import { OrgFields } from "@/components/admin/OrgFields";
import { Card, Flash, buttonClass } from "@/components/admin/ui";

export default async function NewOrgPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> Organisations
      </Link>
      <h1 className="text-2xl font-bold text-brand-900">Add an organisation</h1>
      <Flash {...flash} />
      <Card>
        <form action={createOrg} className="space-y-5">
          <OrgFields />
          <button type="submit" className={buttonClass}>
            Add organisation
          </button>
        </form>
      </Card>
    </>
  );
}
