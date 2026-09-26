export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store"
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!response.ok) {
    throw new Error(data?.error || "Request failed (" + response.status + ")");
  }

  return data as T;
}
