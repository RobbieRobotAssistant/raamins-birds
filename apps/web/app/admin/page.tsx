"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import type { BirdReport } from "@/lib/types";

type Item = { report: BirdReport; key: string };

export default function AdminPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [authed, setAuthed] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reports", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setItems([]);
      return;
    }
    const data = await res.json();
    setItems(data.reports ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(path: string, body: Record<string, unknown>, key: string) {
    setBusy(key);
    setMsg("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems((cur) => (cur ?? []).filter((i) => i.key !== key));
        setMsgErr(false);
        setMsg(typeof d.note === "string" ? d.note : "");
      } else {
        setMsgErr(true);
        setMsg(d.error ? `${d.error}${d.detail ? " — " + d.detail : ""}` : "action failed");
      }
    } catch {
      setMsgErr(true);
      setMsg("action failed");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="serif text-3xl tracking-tight">moderation</h1>
        <div className="flex gap-4">
          <Link href="/" className="chrome hover:text-ink">
            ← site
          </Link>
          <button onClick={logout} className="chrome hover:text-ink">
            log out
          </button>
        </div>
      </div>

      {!authed ? (
        <p className="mt-8 text-sm text-muted">
          not authorized — open the site and use the gear icon (top-right) to log
          in.
        </p>
      ) : items === null ? (
        <p className="label mt-8">loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">no open reports.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y hairline">
          {items.map(({ report, key }) => (
            <li key={key} className="py-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="serif text-lg leading-tight">
                    {report.com_name}
                  </div>
                  <div className="font-mono text-xs italic text-muted">
                    {report.sci_name}
                  </div>
                </div>
                <span className="label shrink-0">
                  {new Date(report.created).toLocaleString()}
                </span>
              </div>

              <p className="mt-2 text-sm text-ink/90">
                incorrectly identified?{" "}
                <span className="font-semibold">
                  {report.incorrect ? "yes" : "no"}
                </span>
                {report.actual ? (
                  <>
                    {" "}
                    · actually:{" "}
                    <span className="font-semibold">{report.actual}</span>
                  </>
                ) : null}
              </p>

              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                preload="none"
                src={`/api/audio/${report.rowid}`}
                className="mt-3 h-8 w-full"
              />

              <div className="mt-3 flex items-center gap-4">
                <button
                  disabled={busy === key}
                  onClick={() =>
                    act("/api/admin/delete", { rowid: report.rowid, key }, key)
                  }
                  className="rounded-sm bg-ink px-3 py-1 font-mono text-xs lowercase tracking-wider text-paper disabled:opacity-50"
                >
                  {busy === key ? "…" : "delete detection"}
                </button>
                <button
                  disabled={busy === key}
                  onClick={() => act("/api/admin/dismiss", { key }, key)}
                  className="chrome hover:text-ink disabled:opacity-50"
                >
                  dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p className={`label mt-6 ${msgErr ? "!text-accent" : "!text-muted"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
