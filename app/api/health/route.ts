import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deployment health probe.
 *
 * The auth callbacks all touch the database, and Auth.js reports any throw
 * from them as an opaque CallbackRouteError. This endpoint answers the one
 * question that cannot otherwise be asked from outside: can this deployment
 * actually reach Postgres?
 *
 * It deliberately reports only presence and error codes -- never connection
 * strings, secrets, or their values.
 */
export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
    AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
    ADMIN_EMAILS: Boolean(process.env.ADMIN_EMAILS),
    AUTH_URL: Boolean(process.env.AUTH_URL),
  };

  const started = Date.now();
  try {
    const users = await prisma.user.count();
    const accounts = await prisma.account.count();
    return NextResponse.json({
      db: "ok",
      ms: Date.now() - started,
      users,
      accounts,
      env,
    });
  } catch (err) {
    const e = err as { name?: string; code?: string; message?: string };
    return NextResponse.json(
      {
        db: "error",
        ms: Date.now() - started,
        // Name and code only; the message can embed the connection string.
        name: e.name ?? "Unknown",
        code: e.code ?? null,
        hint: (e.message ?? "").split("\n").find((l) => l.includes("Can't reach"))
          ? "cannot reach database server"
          : "query failed",
        env,
      },
      { status: 503 }
    );
  }
}
