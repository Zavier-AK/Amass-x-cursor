import type { CoreName } from "./types";

const BASE = "https://api.amass.tech/api/v1";

export class AmassError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AmassError";
  }
}

export async function amassGet<T>(
  path: string,
  apiKey: string,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; error?: { message?: string } };
  if (!res.ok) {
    throw new AmassError(
      json.error?.message ?? `Amass ${res.status}`,
      res.status,
    );
  }
  return json.data as T;
}

export async function searchCore<T extends Record<string, unknown>>(
  core: CoreName,
  query: string,
  apiKey: string,
  extra: Record<string, string> = {},
  limit = 12,
): Promise<T[]> {
  const params = new URLSearchParams({ query, limit: String(limit), ...extra });
  const data = await amassGet<T[]>(
    `/cores/${core}/records?${params.toString()}`,
    apiKey,
  );
  return Array.isArray(data) ? data : [];
}
