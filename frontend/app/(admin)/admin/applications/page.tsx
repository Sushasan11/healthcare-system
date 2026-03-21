"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

interface DoctorProfileSummary {
  specialty: string | null;
  qualifications: string | null;
  bio: string | null;
}

interface Application {
  id: number;
  full_name: string;
  email: string;
  role: string;
  account_status: string;
  created_at: string;
  doctor_profile: DoctorProfileSummary | null;
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

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/applications");
      if (res.ok) {
        const data: Application[] = await res.json();
        setApplications(data);
      }
    } catch {
      setErrorMsg("Failed to load applications. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: number, name: string) {
    setActionLoading((prev) => ({ ...prev, [userId]: "approve" }));
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/admin/applications/${userId}/approve`, {
        method: "POST",
      });
      if (res.ok) {
        setApplications((prev) => prev.filter((a) => a.id !== userId));
        setSuccessMsg(`${name}'s application has been approved.`);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail ?? "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }

  async function handleConfirmReject(userId: number, name: string) {
    setActionLoading(prev => ({ ...prev, [userId]: "reject" }));
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/admin/applications/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejection_reason: rejectionReason.trim() || null,
        }),
      });
      if (res.ok) {
        setApplications(prev => prev.filter(a => a.id !== userId));
        setSuccessMsg(`${name}'s application has been rejected.`);
        setRejectingId(null);
        setRejectionReason("");
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail ?? "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setActionLoading(prev => { const next = { ...prev }; delete next[userId]; return next; });
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Manage Applications
      </h1>

      {successMsg && (
        <Alert className="mb-4 border-green-500 bg-green-50">
          <AlertDescription className="text-green-800">{successMsg}</AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-base font-semibold text-[#0F172A]">
            No pending applications
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            All doctor and pharmacist applications have been reviewed.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_120px_140px_200px] gap-4 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Registered</span>
            <span>Actions</span>
          </div>

          {/* Applications rows */}
          {applications.map((app, index) => {
            const isActing = app.id in actionLoading;
            const isApproving = actionLoading[app.id] === "approve";

            return (
              <div
                key={app.id}
                className={`${index < applications.length - 1 ? "border-b border-[#E2E8F0]" : ""}`}
              >
                {/* Main row */}
                <div className="flex flex-col md:grid md:grid-cols-[1fr_1fr_120px_140px_200px] gap-3 md:gap-4 px-4 py-4 items-start md:items-center">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {app.full_name}
                  </p>
                  <p className="text-sm text-[#64748B] truncate">{app.email}</p>
                  <Badge variant="outline" className={roleBadgeClass(app.role)}>
                    {app.role === "doctor" ? "Doctor" : "Pharmacist"}
                  </Badge>
                  <p className="text-sm text-[#64748B]">
                    {formatDate(app.created_at)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                      disabled={isActing}
                      onClick={() => handleApprove(app.id, app.full_name)}
                    >
                      {isApproving ? "Approving..." : "Approve Application"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isActing}
                      onClick={() => setRejectingId(app.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {/* Profile summary sub-row */}
                {app.doctor_profile && (
                  <div className="bg-[#F8FAFC] px-4 py-3 border-t border-[#E2E8F0]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Specialty</p>
                        <p className="text-sm text-[#0F172A] mt-1">{app.doctor_profile.specialty || "Not specified"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Qualifications</p>
                        <p className="text-sm text-[#0F172A] mt-1">{app.doctor_profile.qualifications || "Not specified"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Bio</p>
                        <p className="text-sm text-[#0F172A] mt-1">{app.doctor_profile.bio || "Not specified"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection reason row */}
                {rejectingId === app.id && (
                  <div className="px-4 py-3 border-t border-[#E2E8F0]">
                    <Textarea
                      placeholder="Optional — provide a reason for the rejection"
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      className="mb-3"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionLoading[app.id] === "reject"}
                        onClick={() => handleConfirmReject(app.id, app.full_name)}
                      >
                        {actionLoading[app.id] === "reject" ? "Rejecting..." : "Confirm Reject"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                      >
                        Cancel Rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
