"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isValidClass } from "@/lib/students";

export async function completeProfile(formData: {
  name: string;
  phone: string;
  className: string;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: "You must be signed in to complete your profile." };
  }

  const normalizedEmail = session.user.email.trim().toLowerCase();
  const name = formData.name.trim();
  const phone = formData.phone.trim();
  const className = formData.className.trim();

  if (!name || !phone || !className) {
    return { error: "Please fill in all profile fields." };
  }

  // The form only offers listed classes, but the action is a public endpoint
  // and a stray value here would split the roster into look-alike groups.
  if (!isValidClass(className)) {
    return { error: "Choose a class from the list." };
  }

  try {
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        name,
        phone,
        className,
        profileComplete: true,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to save profile. Please try again." };
  }
}
