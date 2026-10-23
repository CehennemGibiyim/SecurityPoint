import { withBasePath } from "@/lib/asset-path";

export async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withBasePath(url), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `İstek başarısız (${res.status})`,
    );
  }
  return data as T;
}
