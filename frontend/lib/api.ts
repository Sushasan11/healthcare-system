import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  clearAuthSessionCookie,
} from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // send cookies (refresh token)
  });

  // If 401, try refresh (even when token is null — cookie may still be valid)
  // Guard: skip retry for the refresh endpoint itself to prevent infinite loop
  if (response.status === 401 && !path.includes("/auth/refresh")) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setAccessToken(data.access_token);
      // Retry original request with new token
      headers.set("Authorization", `Bearer ${data.access_token}`);
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      clearAccessToken();
      clearAuthSessionCookie();
      window.location.href = "/login?reason=session_expired";
    }
  }

  // Redirect suspended users to the suspended page
  if (response.status === 403) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body.detail && typeof body.detail === "string" && body.detail.toLowerCase().includes("suspended")) {
        clearAccessToken();
        clearAuthSessionCookie();
        window.location.href = "/suspended";
      }
    } catch {
      // Not JSON or no detail — ignore, let caller handle
    }
  }

  return response;
}
