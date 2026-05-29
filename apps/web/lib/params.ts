import type { Sort, Window } from "./types";

export const WINDOWS: readonly Window[] = ["1h", "12h", "24h", "7d", "all"];
export const SORTS: readonly Sort[] = ["count", "recent", "alpha"];

export function parseWindow(v: string | null): Window {
  return (WINDOWS as readonly string[]).includes(v ?? "")
    ? (v as Window)
    : "24h";
}

export function parseSort(v: string | null): Sort {
  return (SORTS as readonly string[]).includes(v ?? "") ? (v as Sort) : "count";
}
