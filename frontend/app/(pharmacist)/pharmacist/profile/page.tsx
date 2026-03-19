"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PharmacistProfileData {
  id: number;
  email: string;
  full_name: string;
  role: string;
  pharmacy_license_number?: string | null;
}

export default function PharmacistProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PharmacistProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await apiFetch("/me");
        if (res.ok) {
          const data: PharmacistProfileData = await res.json();
          setProfile(data);
        }
      } catch {
        // Fallback to auth context data
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full max-w-lg rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Your Profile
      </h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F172A]">
            Professional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#64748B]">
              Full Name
            </label>
            <p className="mt-0.5 text-sm text-[#0F172A]">
              {profile?.full_name ?? user?.full_name ?? "—"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[#64748B]">Email</label>
            <p className="mt-0.5 text-sm text-[#0F172A]">
              {profile?.email ?? user?.email ?? "—"}
            </p>
          </div>
          {profile?.pharmacy_license_number && (
            <div>
              <label className="text-sm font-medium text-[#64748B]">
                Pharmacy License Number
              </label>
              <p className="mt-0.5 text-sm text-[#0F172A]">
                {profile.pharmacy_license_number}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
