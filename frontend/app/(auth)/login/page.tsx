"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sessionExpired = searchParams?.get("reason") === "session_expired";

  useEffect(() => {
    if (sessionExpired) {
      setError("Your session expired. Please sign in again.");
    }
  }, [sessionExpired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        // Role-based redirect is handled inside AuthContext after refreshUser
        // We need the user's role to redirect correctly
        // The auth context sets the user — read from the response
        // We'll use the user from context after login
        // Actually, login doesn't return user data directly;
        // we redirect to a generic route that will resolve to the role dashboard
        // The proxy.ts will handle role-based gating
        // For now, navigate to a page that reads user role from context
        // The user role comes from the /me call inside refreshUser
        // We'll handle redirect here by reading the cookie or token
        import("@/lib/auth").then(({ parseToken, getAccessToken }) => {
          const token = getAccessToken();
          if (token) {
            const parsed = parseToken(token);
            if (parsed) {
              if (parsed.role === "patient") {
                router.push("/patient/dashboard");
              } else if (parsed.role === "doctor") {
                router.push("/doctor/dashboard");
              } else if (parsed.role === "pharmacist") {
                router.push("/pharmacist/dashboard");
              } else if (parsed.role === "admin") {
                router.push("/admin/dashboard");
              } else {
                router.push("/login");
              }
            }
          }
        });
      } else if (result.status === "pending_approval") {
        router.push("/pending-approval");
      } else {
        setError(result.error || "Incorrect email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      {/* Logo */}
      <div className="text-center mb-6">
        <span className="text-xl font-semibold text-[#0F172A]">
          HealthConnect
        </span>
      </div>

      <Card className="w-full p-8">
        <CardContent className="p-0">
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
              Welcome back
            </h1>
            <p className="text-[14px] text-[#64748B] mt-1">
              Sign in to your HealthConnect account
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[#0F172A]"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#0F172A]"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10 focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] rounded"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white h-9"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-[14px] text-[#0EA5E9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] rounded"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-4 border-t border-[#E2E8F0] pt-4 text-center">
            <span className="text-[14px] text-[#64748B]">
              Don&apos;t have an account?{" "}
            </span>
            <Link
              href="/register"
              className="text-[14px] text-[#0EA5E9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] rounded"
            >
              Register
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[400px] text-center text-[#64748B]">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
