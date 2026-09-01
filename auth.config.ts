import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

/**
 * The quick-login provider below authenticates on an email address alone and
 * will mint an ADMIN account for whatever address is posted to it. That is
 * fine on a laptop and catastrophic on a public URL, so it is only ever
 * registered outside production. Set ENABLE_DEV_LOGIN=true to opt back in
 * deliberately (e.g. a private preview deployment) -- never on the live site.
 */
const devLoginEnabled =
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_DEV_LOGIN === "true";

/** Names of auth environment variables that are required but absent. */
export const missingAuthEnv = [
  ["AUTH_SECRET", process.env.AUTH_SECRET],
  ["AUTH_GOOGLE_ID", process.env.AUTH_GOOGLE_ID],
  ["AUTH_GOOGLE_SECRET", process.env.AUTH_GOOGLE_SECRET],
]
  .filter(([, value]) => !value)
  .map(([name]) => name as string);

if (missingAuthEnv.length > 0) {
  // Auth.js reports every one of these as a generic "Configuration" error with
  // no indication of which variable is at fault. Name them in the server log so
  // the deployment platform's logs actually say what to set.
  console.error(
    `[auth] Missing required environment variable(s): ${missingAuthEnv.join(
      ", "
    )}. Google sign-in will fail with error=Configuration until these are set ` +
      `on the deployment (they are read from .env.local locally, which is not deployed).`
  );
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
    // Development-only mock provider. See devLoginEnabled above.
    ...(devLoginEnabled ? [Credentials({
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
    })] : []),
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
        try {
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
        } catch (err) {
          console.error(
            "[auth] Admin upsert failed during signIn -- is DATABASE_URL set " +
              "and the database reachable from this deployment?",
            err
          );
          throw err;
        }
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
  // Auth.js wraps anything thrown inside the OAuth callback in a bare
  // CallbackRouteError and reports it to the browser as a generic
  // "Configuration" error, which says nothing about what actually failed.
  // Unwrap and print the underlying cause so the deployment logs name it.
  logger: {
    error(error: Error & { cause?: unknown }) {
      const cause = error.cause as
        | { err?: Error; provider?: string }
        | undefined;
      const underlying = cause?.err ?? cause ?? error;
      console.error(
        `[auth][error] ${error.name}: ${error.message}\n` +
          `  cause: ${
            underlying instanceof Error
              ? `${underlying.name}: ${underlying.message}`
              : JSON.stringify(underlying)
          }\n` +
          `  stack: ${
            underlying instanceof Error ? underlying.stack : error.stack
          }`
      );
    },
    warn(code: string) {
      console.warn(`[auth][warn] ${code}`);
    },
  },
  secret: process.env.AUTH_SECRET,
};
