import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "ADMIN";
      profileComplete: boolean;
      phone?: string | null;
      className?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "STUDENT" | "ADMIN";
    profileComplete?: boolean;
    phone?: string | null;
    className?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "STUDENT" | "ADMIN";
    profileComplete?: boolean;
    phone?: string | null;
    className?: string | null;
  }
}
