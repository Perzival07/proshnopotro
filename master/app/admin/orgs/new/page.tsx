import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createOrg } from "../../actions";
import { OrgFields } from "@/components/admin/OrgFields";
import { Card, Flash, buttonClass } from "@/components/admin/ui";
import { getSettings } from "@/lib/settings";

export default async function NewOrgPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const flash = await searchParams;
  const { defaultPricePerStudentInr } = await getSettings();
  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900">
        <ArrowLeft className="h-4 w-4" /> Organisations
      </Link>
      <h1 className="text-2xl font-bold text-brand-900">Add an organisation</h1>
      <Flash {...flash} />
      <Card>
        <form action={createOrg} className="space-y-5">
          <OrgFields defaultPrice={defaultPricePerStudentInr} />
          <p className="text-xs text-zinc-500">
            Only a super admin can add an organisation. Once its portal is connected, add its owners from its People page; owners then
            add their own students and tutors.
          </p>
          <button type="submit" className={buttonClass}>
            Add organisation
          </button>
        </form>
      </Card>
    </>
  );
}
