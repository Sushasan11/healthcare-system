// Server-component fetch helper for PUBLIC catalog endpoints (D-26).
// Do NOT use for authenticated routes — the access token lives in client memory
// and is not available to server components.

const API_BASE =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

export async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`serverFetch ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}
