/**
 * RFC 4180 CSV encoding.
 *
 * Every field is quoted and embedded quotes are doubled; without this a student
 * name containing a quote or comma split the row apart. Rows are joined with
 * CRLF, and a BOM is prepended so Excel reads UTF-8 names correctly.
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  return [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ].join("\r\n");
}

export const CSV_BOM = "﻿";
