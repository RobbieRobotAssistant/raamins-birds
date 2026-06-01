"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export default function ReportModal({
  rowid,
  comName,
  sciName,
  onClose,
}: {
  rowid: number;
  comName: string;
  sciName: string;
  onClose: () => void;
}) {
  const [incorrect, setIncorrect] = useState(true);
  const [actual, setActual] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rowid,
          sci_name: sciName,
          com_name: comName,
          incorrect,
          actual,
          website,
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <div className="text-center">
            <p className="serif text-lg leading-tight">thanks — flagged for review</p>
            <button
              onClick={onClose}
              className="chrome mt-4 text-ink underline underline-offset-4"
            >
              close
            </button>
          </div>
        ) : (
          <>
            <h3 className="serif text-lg leading-tight">report a misidentification</h3>
            <p className="mt-1 font-mono text-xs italic text-muted">
              {comName} ({sciName})
            </p>

            <div className="mt-5">
              <p className="label mb-2">is this incorrectly identified?</p>
              <div className="flex gap-2">
                {([["yes", true], ["no", false]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    onClick={() => setIncorrect(val)}
                    className={`rounded-sm border hairline px-3 py-1 font-mono text-xs lowercase tracking-wider transition-colors ${
                      incorrect === val
                        ? "bg-ink text-paper"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="label mb-2 block">what is it really? (optional)</label>
              <input
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                maxLength={120}
                placeholder="e.g. Mourning Dove"
                className="w-full rounded-sm border hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            {/* honeypot — hidden from humans */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
            />

            {status === "error" && (
              <p className="label mt-3 !text-accent">couldn’t send — try again</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-4">
              <button onClick={onClose} className="chrome hover:text-ink">
                cancel
              </button>
              <button
                onClick={submit}
                disabled={status === "sending"}
                className="rounded-sm bg-ink px-4 py-1.5 font-mono text-xs lowercase tracking-wider text-paper disabled:opacity-50"
              >
                {status === "sending" ? "sending…" : "submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
