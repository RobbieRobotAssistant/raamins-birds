"use client";

import { clockTime, shortDate } from "@/lib/format";
import type { PeriodBucket, Window } from "@/lib/types";

export default function Histogram({
  buckets,
  window,
}: {
  buckets: PeriodBucket[];
  window: Window;
}) {
  if (buckets.length === 0) {
    return <p className="label py-8 text-center">no activity in this window</p>;
  }
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const perDay = window === "7d" || window === "all";

  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]">
        {buckets.map((b) => (
          <div
            key={b.bucket}
            title={`${perDay ? shortDate(b.bucket) : clockTime(b.bucket)} · ${
              b.count
            }`}
            className="flex-1 bg-accent/70 transition-colors hover:bg-accent"
            style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between">
        <span className="label">
          {perDay
            ? shortDate(buckets[0].bucket)
            : clockTime(buckets[0].bucket)}
        </span>
        <span className="label">
          {perDay
            ? shortDate(buckets[buckets.length - 1].bucket)
            : clockTime(buckets[buckets.length - 1].bucket)}
        </span>
      </div>
    </div>
  );
}
