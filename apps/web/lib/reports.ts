import "server-only";

import { del, list, put } from "@vercel/blob";

import type { BirdReport } from "./types";

// Viewer reports are stored as one small JSON object per report in Vercel Blob
// (one object each, so simultaneous reports can't clobber a shared file).

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const PREFIX = "reports/";

export function reportsEnabled(): boolean {
  return TOKEN.length > 0;
}

export async function saveReport(
  data: Omit<BirdReport, "id" | "created">
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const report: BirdReport = { ...data, id, created: new Date().toISOString() };
  await put(`${PREFIX}${id}.json`, JSON.stringify(report), {
    access: "public",
    token: TOKEN,
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export async function listReports(): Promise<
  { report: BirdReport; key: string }[]
> {
  const { blobs } = await list({ prefix: PREFIX, token: TOKEN });
  const out: { report: BirdReport; key: string }[] = [];
  for (const b of blobs) {
    try {
      const res = await fetch(`${b.url}?t=${Date.now()}`);
      if (!res.ok) continue;
      const report = (await res.json()) as BirdReport;
      out.push({ report, key: b.url });
    } catch {
      /* skip unreadable */
    }
  }
  out.sort((a, b) => b.report.created.localeCompare(a.report.created));
  return out;
}

export async function deleteReport(key: string): Promise<void> {
  await del(key, { token: TOKEN });
}
