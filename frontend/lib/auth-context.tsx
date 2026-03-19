"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiFetch } from "./api";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  parseToken,
  setAuthSessionCookie,
  clearAuthSessionCookie,
} from "./auth";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  account_status: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; status?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/me");
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        // Keep auth_session cookie in sync with current user role
        setAuthSessionCookie(userData.role);
      } else {
        setUser(null);
        clearAccessToken();
        clearAuthSessionCookie();
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      // Always try to restore session from HttpOnly refresh cookie first.
      // After browser refresh, in-memory token is null but cookie persists.
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setAccessToken(data.access_token);
          const parsed = parseToken(data.access_token);
          if (parsed) {
            setAuthSessionCookie(parsed.role);
          }
        }
      } catch {
        // Refresh failed (no cookie, expired, network error) — proceed without token
      }
      // Now refreshUser() will find the restored token (or null if refresh failed)
      await refreshUser();
    };
    restoreSession();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.access_token);
      // Parse token to get role and set auth_session cookie for proxy.ts
      const parsed = parseToken(data.access_token);
      if (parsed) {
        setAuthSessionCookie(parsed.role);
      }
      await refreshUser();
      return { success: true };
    }
    const error = await res
      .json()
      .catch(() => ({ detail: "Something went wrong. Please try again." }));
    // Check for pending_approval status
    if (res.status === 403 && error.detail?.includes?.("pending_approval")) {
      return { success: false, error: error.detail, status: "pending_approval" };
    }
    if (res.status === 403) {
      return {
        success: false,
        error: "Email not verified. Please check your inbox.",
      };
    }
    if (res.status === 429) {
      return {
        success: false,
        error:
          "Too many failed attempts. Your account is temporarily locked. Try again in 15 minutes.",
      };
    }
    return {
      success: false,
      error: error.detail || "Incorrect email or password.",
    };
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    clearAccessToken();
    clearAuthSessionCookie();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
