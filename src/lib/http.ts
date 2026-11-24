export class ApiRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiRequestError("Unable to reach the server. Check your connection.", 0);
  }
  if (response.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    // Session expired or was revoked: send the user back to sign in.
    const next = window.location.pathname + window.location.search;
    // Full reload on purpose so the server-rendered header drops the signed-in state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login?next=" + encodeURIComponent(next));
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Request failed (" + response.status + ").";
    throw new ApiRequestError(message, response.status);
  }
  return response.json() as Promise<T>;
}
