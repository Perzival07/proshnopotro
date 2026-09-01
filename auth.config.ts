import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    // Development/Test mock provider to test student & admin logins instantly without Google credentials
    Credentials({
      id: "credentials",
      name: "Dev Quick Login",
      credentials: {
        email: { label: "Email", type: "email" },
        role: { label: "Role", type: "text" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = (credentials.email as string).trim().toLowerCase();
        const role = (credentials.role as string) === "ADMIN" ? "ADMIN" : "STUDENT";
        const name = (credentials.name as string) || email.split("@")[0];

        // Check or create user
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              role,
              profileComplete: role === "ADMIN", // Admin defaults to true
            },
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          profileComplete: user.profileComplete,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const normalizedEmail = user.email.trim().toLowerCase();

      // Check admin email list
      const adminList = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const shouldBeAdmin = adminList.includes(normalizedEmail);

      // Auto-assign admin if email matches
      if (shouldBeAdmin) {
        await prisma.user.upsert({
          where: { email: normalizedEmail },
          update: { role: "ADMIN", profileComplete: true },
          create: {
            email: normalizedEmail,
            name: user.name || "Admin",
            image: user.image,
            role: "ADMIN",
            profileComplete: true,
          },
        });
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email?.toLowerCase();
      }

      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (typeof session.profileComplete === "boolean") {
          token.profileComplete = session.profileComplete;
        }
      }

      // Re-fetch latest DB profile attributes to maintain high-security server trust
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: {
            id: true,
            role: true,
            profileComplete: true,
            phone: true,
            className: true,
            name: true,
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.profileComplete = dbUser.profileComplete;
          token.phone = dbUser.phone;
          token.className = dbUser.className;
          token.name = dbUser.name;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "STUDENT" | "ADMIN") || "STUDENT";
        session.user.profileComplete = Boolean(token.profileComplete);
        session.user.phone = (token.phone as string) || null;
        session.user.className = (token.className as string) || null;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
};
