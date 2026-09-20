/**
 * A short fingerprint of everything on a student's dashboard that a tutor can
 * change from outside: which tests they have, whether each is on, when it
 * opens and closes, and where it stands. An open dashboard asks for it every
 * so often and only redraws when it differs, so a newly assigned test appears
 * by itself without the page flickering the rest of the time.
 */

export interface SignatureRow {
  id: string;
  status: string;
  active: boolean;
  dueAt: Date | string;
  opensAt?: Date | string | null;
  hasResult: boolean;
  returnedAt?: Date | string | null;
  resultsReleasedAt?: Date | string | null;
}

const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

export function dashboardSignature(rows: SignatureRow[], extras: (string | number)[] = []): string {
  const parts = rows
    .map((r) =>
      [r.id, r.status, r.active ? 1 : 0, ms(r.dueAt), ms(r.opensAt), r.hasResult ? 1 : 0, ms(r.returnedAt), ms(r.resultsReleasedAt)].join(":")
    )
    .sort();
  return [...parts, ...extras].join("|");
}
