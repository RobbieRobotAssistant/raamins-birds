"use client";

import { useFetch } from "@/lib/useFetch";
import { shortDate } from "@/lib/format";
import type {
  FirstDetection,
  PeriodBucket,
  TopSpecies,
  Window,
} from "@/lib/types";
import Histogram from "./Histogram";
import { ErrorState, LoadingRows } from "./States";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="label mb-3 border-b hairline pb-2">{children}</h2>;
}

export default function StatsView({
  window,
  onSelect,
}: {
  window: Window;
  onSelect: (sci: string) => void;
}) {
  // All species heard in the window, rank-ordered by count (not just top 10).
  const top = useFetch<TopSpecies[]>(
    `/api/stats/top-species?window=${window}&limit=100`
  );
  const first = useFetch<FirstDetection[]>(`/api/stats/first-detections`);
  const period = useFetch<PeriodBucket[]>(
    `/api/stats/by-period?window=${window}`
  );

  if (top.error) return <ErrorState message={top.error} />;

  const maxCount = Math.max(...(top.data ?? []).map((t) => t.count), 1);

  return (
    <div className="space-y-12">
      <section>
        <SectionTitle>Detections over time</SectionTitle>
        {period.loading && !period.data ? (
          <LoadingRows />
        ) : (
          <Histogram buckets={period.data ?? []} window={window} />
        )}
      </section>

      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <SectionTitle>Most heard · this window</SectionTitle>
          {top.loading && !top.data ? (
            <LoadingRows />
          ) : (top.data ?? []).length === 0 ? (
            <p className="label py-6">nothing yet</p>
          ) : (
            <ol className="space-y-2.5">
              {(top.data ?? []).map((t, i) => (
                <li key={t.sci_name}>
                  <button
                    onClick={() => onSelect(t.sci_name)}
                    className="group block w-full text-left"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="serif text-[0.95rem] group-hover:underline group-hover:underline-offset-2">
                        <span className="mr-2 text-muted">{i + 1}.</span>
                        {t.com_name}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {t.count}
                      </span>
                    </div>
                    <div className="mt-1 h-px w-full bg-line">
                      <div
                        className="h-px bg-accent"
                        style={{ width: `${(t.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <SectionTitle>Newest to the list · all-time</SectionTitle>
          {first.loading && !first.data ? (
            <LoadingRows />
          ) : (first.data ?? []).length === 0 ? (
            <p className="label py-6">nothing yet</p>
          ) : (
            <ul className="space-y-2.5">
              {(first.data ?? []).map((f) => (
                <li
                  key={f.sci_name}
                  className="flex items-baseline justify-between gap-3"
                >
                  <button
                    onClick={() => onSelect(f.sci_name)}
                    className="serif text-[0.95rem] hover:underline hover:underline-offset-2"
                  >
                    {f.com_name}
                  </button>
                  <span className="label whitespace-nowrap">
                    {shortDate(f.first_heard)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
