import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Sign-in for the master app. Anyone with a Google account may sign in -- a
 * student does, to reach the hub -- and the super admin is whoever is listed
 * in SUPER_ADMIN_EMAILS, checked on every request (lib/access.ts), never
 * stored in the session.
 *
 * The email-only "quick login" signs in as any address without a password.
 * It exists for local development only and is never registered in
 * production unless ENABLE_DEV_LOGIN=true -- do not set that on the live site.
 */
export const devLoginEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_LOGIN === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev Quick Login",
            credentials: { email: { label: "Email", type: "email" } },
            authorize(credentials) {
              const email = String(credentials?.email ?? "").trim().toLowerCase();
              return /^[^@\s]+@[^@\s]+$/.test(email) ? { id: email, email, name: email.split("@")[0] } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    signIn: ({ user }) => Boolean(user.email),
    jwt({ token, user }) {
      if (user?.email) token.email = user.email.toLowerCase();
      return token;
    },
  },
  secret: process.env.AUTH_SECRET,
});
