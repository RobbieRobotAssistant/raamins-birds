"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GearAdmin() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");

  async function submit() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setOpen(false);
        setPw("");
        setStatus("idle");
        router.push("/admin");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="admin"
        title="admin"
        className="absolute right-5 top-4 z-20 text-muted/50 transition-colors hover:text-ink sm:right-8"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg bg-paper p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-lg leading-tight">admin</h3>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="password"
              autoFocus
              className="mt-3 w-full rounded-sm border hairline bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {status === "error" && (
              <p className="label mt-2 !text-accent">wrong password</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-4">
              <button
                onClick={() => setOpen(false)}
                className="chrome hover:text-ink"
              >
                cancel
              </button>
              <button
                onClick={submit}
                disabled={status === "checking"}
                className="rounded-sm bg-ink px-4 py-1.5 font-mono text-xs lowercase tracking-wider text-paper disabled:opacity-50"
              >
                {status === "checking" ? "…" : "enter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
