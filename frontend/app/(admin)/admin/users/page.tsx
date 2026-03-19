"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  role: string;
  account_status: string;
  created_at: string;
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "doctor":
      return "border-blue-400 text-blue-700";
    case "pharmacist":
      return "border-teal-400 text-teal-700";
    case "admin":
      return "border-purple-400 text-purple-700";
    default:
      return "border-slate-400 text-slate-700";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "border-green-400 text-green-700 bg-green-50";
    case "pending_approval":
    case "pending_verification":
      return "border-yellow-400 text-yellow-700 bg-yellow-50";
    case "suspended":
      return "border-red-400 text-red-700 bg-red-50";
    default:
      return "";
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending_approval":
      return "Pending Approval";
    case "pending_verification":
      return "Pending Verification";
    case "suspended":
      return "Suspended";
    default:
      return status;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await apiFetch("/admin/users");
        if (res.ok) {
          const data: UserRecord[] = await res.json();
          setUsers(data);
        } else {
          setError("Failed to load users.");
        }
      } catch {
        setError("Something went wrong. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">All Users</h1>

      {error && (
        <div className="rounded-lg border border-[#E2E8F0] p-6 text-center">
          <p className="text-sm text-[#64748B]">{error}</p>
          <p className="text-xs text-[#64748B] mt-1">
            Full user management available in a later phase.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_120px_160px_140px] gap-4 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Registered</span>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[#64748B]">No users found.</p>
            </div>
          ) : (
            users.map((user, index) => (
              <div
                key={user.id}
                className={`flex flex-col md:grid md:grid-cols-[1fr_1fr_120px_160px_140px] gap-3 md:gap-4 px-4 py-4 items-start md:items-center ${
                  index < users.length - 1 ? "border-b border-[#E2E8F0]" : ""
                }`}
              >
                <p className="text-sm font-semibold text-[#0F172A]">
                  {user.full_name}
                </p>
                <p className="text-sm text-[#64748B] truncate">{user.email}</p>
                <Badge variant="outline" className={roleBadgeClass(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
                <Badge
                  variant="outline"
                  className={statusBadgeClass(user.account_status)}
                >
                  {formatStatus(user.account_status)}
                </Badge>
                <p className="text-sm text-[#64748B]">
                  {formatDate(user.created_at)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
