import { getVerifiedSession } from "@/lib/auth-utils";
import { homeFor } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getVerifiedSession();

  if (!user) {
    redirect("/login");
  }

  redirect(homeFor(user.role));
}
