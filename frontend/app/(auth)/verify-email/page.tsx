"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") || "";
  const token = searchParams?.get("token") || "";

  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setVerificationStatus("verifying");
      apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`)
        .then(async (res) => {
          if (res.ok) {
            setVerificationStatus("success");
            setVerificationMessage(
              "Your email has been verified. You can now sign in."
            );
          } else {
            const data = await res.json().catch(() => null);
            setVerificationStatus("error");
            setVerificationMessage(
              data?.detail || "Verification link is invalid or has expired."
            );
          }
        })
        .catch(() => {
          setVerificationStatus("error");
          setVerificationMessage("Something went wrong. Please try again.");
        });
    }
  }, [token]);

  const handleResend = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      const res = await apiFetch("/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResendStatus("sent");
      } else {
        setResendStatus("error");
      }
    } catch {
      setResendStatus("error");
    } finally {
      setResendLoading(false);
    }
  };

  if (verificationStatus === "verifying") {
    return (
      <div className="w-full max-w-[400px]">
        <Card className="p-8">
          <CardContent className="p-0 text-center">
            <p className="text-[14px] text-[#64748B]">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "success") {
    return (
      <div className="w-full max-w-[400px]">
        <Card className="p-8">
          <CardContent className="p-0 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
              Email verified
            </h1>
            <p className="text-[14px] text-[#64748B]">{verificationMessage}</p>
            <Link href="/login">
              <Button className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white h-9">
                Sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "error") {
    return (
      <div className="w-full max-w-[400px]">
        <Card className="p-8">
          <CardContent className="p-0 text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
              Verification failed
            </h1>
            <p className="text-[14px] text-[#64748B]">{verificationMessage}</p>
            <Link href="/login">
              <Button variant="outline" className="w-full h-9">
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-6">
        <span className="text-xl font-semibold text-[#0F172A]">
          HealthConnect
        </span>
      </div>

      <Card className="p-8">
        <CardContent className="p-0 text-center space-y-4">
          <div className="flex justify-center">
            <Mail className="h-12 w-12 text-[#0EA5E9]" />
          </div>

          <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
            Check your email
          </h1>

          <p className="text-[14px] text-[#64748B]">
            We sent a verification link to{" "}
            {email ? (
              <span className="font-medium text-[#0F172A]">{email}</span>
            ) : (
              "your email address"
            )}
            . Click it to activate your account.
          </p>

          {resendStatus === "sent" && (
            <Alert className="text-left" role="alert">
              <AlertDescription>
                A new verification link has been sent. Please check your inbox.
              </AlertDescription>
            </Alert>
          )}

          {resendStatus === "error" && (
            <Alert variant="destructive" className="text-left" role="alert">
              <AlertDescription>
                Failed to resend. Please try again later.
              </AlertDescription>
            </Alert>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || resendStatus === "sent"}
            className="text-[14px] text-[#0EA5E9] hover:underline disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] rounded"
          >
            {resendLoading ? "Sending..." : "Resend email"}
          </button>

          <div className="pt-2 border-t border-[#E2E8F0]">
            <Link
              href="/login"
              className="text-[14px] text-[#64748B] hover:text-[#0F172A]"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[400px] text-center text-[#64748B]">
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
