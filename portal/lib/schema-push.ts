/**
 * The pure parts of scripts/push-schema.ts, which applies prisma/schema.prisma
 * to every organisation's database: reading its arguments and each
 * organisation's orgs/<slug>/.env.local.
 */

export type PushOptions = {
  /** Change the databases; without it the script only shows what would change. */
  apply: boolean;
  /** Passed on to `prisma db push`: allow changes that drop columns or tables. */
  acceptDataLoss: boolean;
  /** Only these organisations (slugs); null for all of them. */
  only: string[] | null;
};

export function parsePushArgs(argv: string[]): PushOptions | { error: string } {
  const options: PushOptions = { apply: false, acceptDataLoss: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--accept-data-loss") options.acceptDataLoss = true;
    else if (arg === "--only" || arg.startsWith("--only=")) {
      const value = arg === "--only" ? argv[++i] : arg.slice("--only=".length);
      const slugs = (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (slugs.length === 0) return { error: "--only needs organisation slugs, e.g. --only classes-by-koustav" };
      options.only = slugs;
    } else return { error: `Unknown argument: ${arg}` };
  }
  if (options.acceptDataLoss && !options.apply) return { error: "--accept-data-loss only makes sense with --apply" };
  return options;
}

/** KEY=value lines, as in a .env file: # comments, optional quotes, optional `export`. */
export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    env[match[1]] = value;
  }
  return env;
}

/**
 * The address to change the schema through: DIRECT_URL, since a pooled
 * DATABASE_URL (Supabase's port 6543) cannot run schema changes; else
 * DATABASE_URL.
 */
export function schemaUrl(env: Record<string, string>): string | null {
  return env.DIRECT_URL || env.DATABASE_URL || null;
}

/** Where a database lives, for the log, without its user name or password. */
export function describeDatabase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(unreadable address)";
  }
}
