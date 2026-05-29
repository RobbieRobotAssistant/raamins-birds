// Server-only data layer. Branches between the live Pi API (cached via the
// Next data cache to shield the Pi) and built-in mocks. Never import this from
// a client component.

import "server-only";

import { BIRD_API_URL, REVALIDATE, USE_MOCKS } from "./config";
import * as mock from "./mock";
import type {
  Detection,
  FirstDetection,
  PeriodBucket,
  SpeciesDetail,
  SpeciesListEntry,
  SpeciesListItem,
  Sort,
  TopSpecies,
  Window,
} from "./types";

async function piFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BIRD_API_URL}${path}`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`Pi API ${path} responded ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getDetections(
  window: Window,
  limit = 120
): Promise<Detection[]> {
  if (USE_MOCKS) return mock.mockDetections(window, limit);
  return piFetch(`/api/detections?window=${window}&limit=${limit}`);
}

export async function getLifeList(sort: Sort): Promise<SpeciesListItem[]> {
  if (USE_MOCKS) return mock.mockLifeList(sort);
  return piFetch(`/api/species?sort=${sort}`);
}

export async function getSpeciesList(): Promise<SpeciesListEntry[]> {
  if (USE_MOCKS) return mock.mockSpeciesList();
  return piFetch(`/api/species-list`);
}

export async function getSpeciesDetail(
  sci: string,
  window: Window
): Promise<SpeciesDetail | null> {
  if (USE_MOCKS) return mock.mockSpeciesDetail(sci, window);
  try {
    return await piFetch(
      `/api/species/${encodeURIComponent(sci)}?window=${window}`
    );
  } catch {
    return null;
  }
}

export async function getTopSpecies(
  window: Window,
  limit = 10
): Promise<TopSpecies[]> {
  if (USE_MOCKS) return mock.mockTopSpecies(window, limit);
  return piFetch(`/api/stats/top-species?window=${window}&limit=${limit}`);
}

export async function getFirstDetections(limit = 20): Promise<FirstDetection[]> {
  if (USE_MOCKS) return mock.mockFirstDetections(limit);
  return piFetch(`/api/stats/first-detections?limit=${limit}`);
}

export async function getByPeriod(window: Window): Promise<PeriodBucket[]> {
  if (USE_MOCKS) return mock.mockByPeriod(window);
  return piFetch(`/api/stats/by-period?window=${window}`);
}
