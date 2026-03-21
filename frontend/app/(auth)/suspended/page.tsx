"use client";

import { Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function SuspendedPage() {
  const { logout } = useAuth();

  return (
    <div className="w-full max-w-[480px]">
      <div className="text-center mb-6">
        <span className="text-xl font-semibold text-[#0F172A]">
          HealthConnect
        </span>
      </div>

      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          onClick={logout}
          className="text-[14px] text-[#64748B] hover:text-[#0F172A] h-8"
        >
          Sign out
        </Button>
      </div>

      <Card className="p-8">
        <CardContent className="p-0 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
              <Ban className="h-8 w-8 text-[#EF4444]" />
            </div>
          </div>

          <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
            Account suspended
          </h1>

          <p className="text-[14px] text-[#64748B]">
            Your account has been suspended. Please contact support if you
            believe this is an error.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
