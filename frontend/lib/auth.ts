// In-memory access token storage (not localStorage — XSS protection)
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}

export interface TokenPayload {
  sub: string;
  role: string;
  exp: number;
  type: string;
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Set the auth_session cookie (non-HttpOnly) for proxy.ts route guarding.
 * Contains role only — NOT the access token itself.
 * The actual access token stays in memory (XSS protection).
 */
export function setAuthSessionCookie(role: string): void {
  document.cookie = `auth_session=${role}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
}

export function clearAuthSessionCookie(): void {
  document.cookie = "auth_session=; path=/; max-age=0";
}
