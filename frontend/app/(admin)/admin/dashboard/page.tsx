"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Application {
  id: number;
  full_name: string;
  email: string;
  role: string;
  account_status: string;
  created_at: string;
}

function roleBadgeClass(role: string): string {
  if (role === "doctor") return "border-blue-400 text-blue-700";
  if (role === "pharmacist") return "border-teal-400 text-teal-700";
  return "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      try {
        const res = await apiFetch("/admin/applications");
        if (res.ok) {
          const data: Application[] = await res.json();
          setApplications(data);
        }
      } catch {
        // Silent fail — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchApplications();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Pending Applications
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0EA5E9]">
                {applications.length}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/admin/applications")}
            >
              Review Applications
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#64748B]">
              View and manage all registered users.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/admin/users")}
            >
              View All Users
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent pending applications list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-base font-semibold text-[#0F172A]">
            No pending applications
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            All doctor and pharmacist applications have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">
                    {app.full_name}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {formatDate(app.created_at)}
                  </p>
                </div>
                <Badge variant="outline" className={roleBadgeClass(app.role)}>
                  {app.role === "doctor" ? "Doctor" : "Pharmacist"}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/admin/applications")}
              >
                Review Application
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
