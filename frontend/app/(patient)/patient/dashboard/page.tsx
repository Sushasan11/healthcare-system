"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Video,
  FileText,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MeProfile {
  allergies?: string | null;
  current_medications?: string | null;
  chronic_conditions?: string | null;
  blood_type?: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PLACEHOLDER_CARDS = [
  {
    icon: Calendar,
    title: "Appointments",
    description: "Available in a later phase",
  },
  {
    icon: Video,
    title: "Consultations",
    description: "Available in a later phase",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    description: "Available in a later phase",
  },
  {
    icon: MessageSquare,
    title: "Messages",
    description: "Available in a later phase",
  },
];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await apiFetch("/me");
        if (res.ok) {
          const data: MeProfile = await res.json();
          const incomplete =
            !data.allergies && !data.current_medications && !data.chronic_conditions;
          setShowPrompt(incomplete);
        }
      } catch {
        // Silent — don't show prompt on error
      } finally {
        setProfileLoading(false);
      }
    }
    checkProfile();
  }, []);

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Greeting */}
      <h1 className="text-xl font-semibold text-[#0F172A]">
        {getGreeting()}, {firstName}
      </h1>

      {/* Profile completion prompt */}
      {!profileLoading && showPrompt && (
        <Alert className="mt-4 border-[#0EA5E9] bg-sky-50">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-[#0F172A]">
              Complete your profile to get the most out of HealthConnect.
            </span>
            <Link
              href="/patient/profile"
              className="shrink-0 text-sm font-semibold text-[#0EA5E9] hover:underline"
            >
              Complete profile
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Placeholder card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {profileLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-5 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))
          : PLACEHOLDER_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title}>
                  <CardHeader>
                    <Icon className="size-5 text-[#64748B]" />
                    <CardTitle className="text-base font-semibold text-[#0F172A]">
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-[#64748B]">
                      {card.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
