import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { org } from "@/lib/org";
import { DEMO_SLUG } from "@/lib/demo";
import { enrolInDemo } from "@/lib/demo-reset";
import { masterConfig } from "@/lib/master";
import { SIGNATURE_HEADER, verifyRequest } from "@/lib/master-signature";
import { parsePeopleCommand, type PeopleCommand } from "@/lib/master-people";
import {
  addOwnerRecord,
  addStudentRecord,
  addTutorRecord,
  envOwnerEmails,
  ownerToTutorRecord,
  removeOwnerRecord,
  removePersonRecord,
  removeTutorRecord,
  type PeopleResult,
} from "@/lib/people";

export const dynamic = "force-dynamic";

/**
 * The master's super admin adds, removes and changes the role of this
 * organisation's people: students, tutors and owners. Owners can be made only
 * this way. Only a request signed with MASTER_SYNC_SECRET, over its exact
 * body, is carried out.
 */
export async function POST(request: Request) {
  const config = masterConfig();
  if (!config) return NextResponse.json({ error: "Not connected to a master" }, { status: 503 });
  const path = new URL(request.url).pathname;
  const body = await request.text();
  if (!verifyRequest(config.secret, request.headers.get(SIGNATURE_HEADER), "POST", path, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Not JSON." }, { status: 400 });
  }
  const command = parsePeopleCommand(json);
  if ("error" in command) return NextResponse.json(command, { status: 400 });

  try {
    const result = await carryOut(command);
    // On the demo, whoever is approved finds the sample class and paper waiting.
    if (org.slug === DEMO_SLUG && command.action !== "remove" && "success" in result) await enrolInDemo(command.email);
    return NextResponse.json(result, { status: "error" in result ? 409 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[master] people command failed:", err);
    return NextResponse.json({ error: "The portal could not save that." }, { status: 500 });
  }
}

async function carryOut(command: PeopleCommand): Promise<PeopleResult> {
  // Named in ADMIN_EMAILS: made an owner again at every sign-in, whatever is changed here.
  if (command.action !== "add" && envOwnerEmails().includes(command.email)) {
    return { error: `${command.email} is in the server's ADMIN_EMAILS setting; remove it there first.` };
  }
  if (command.action === "remove") return removePersonRecord({ email: command.email });

  if (command.action === "add") {
    const { role, email, name, phone, className } = command;
    if (role === "STUDENT") return addStudentRecord({ email, name, phone, className });
    return role === "TUTOR" ? addTutorRecord(email, name) : addOwnerRecord(email, name);
  }

  const user = await prisma.user.findUnique({ where: { email: command.email }, select: { role: true } });
  if (!user) return { error: "That person is not in this portal." };
  if (user.role === command.role) return { success: true };
  switch (command.role) {
    case "ADMIN":
      return addOwnerRecord(command.email);
    case "TUTOR":
      return user.role === "ADMIN" ? ownerToTutorRecord(command.email) : addTutorRecord(command.email);
    case "STUDENT":
      return user.role === "ADMIN" ? removeOwnerRecord(command.email) : removeTutorRecord(command.email);
  }
}
