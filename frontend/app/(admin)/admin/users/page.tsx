"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const limit = 20;

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(page * limit),
        });
        if (roleFilter !== "all") {
          params.set("role", roleFilter);
        }
        const res = await apiFetch(`/admin/users?${params}`);
        if (res.ok) {
          const data: { users: UserRecord[]; total: number } = await res.json();
          setUsers(data.users);
          setTotal(data.total);
        } else {
          setError("Failed to load users. Please refresh.");
        }
      } catch {
        setError("Failed to load users. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [roleFilter, page]);

  async function handleSuspend(userId: number, fullName: string) {
    setActionLoading((prev) => ({ ...prev, [userId]: "suspend" }));
    try {
      const res = await apiFetch(`/admin/users/${userId}/suspend`, {
        method: "POST",
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, account_status: "suspended" } : u
          )
        );
        toast.success(`${fullName} has been suspended.`);
      } else {
        toast.error("Failed to update user status. Please try again.");
      }
    } catch {
      toast.error("Failed to update user status. Please try again.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }

  async function handleActivate(userId: number, fullName: string) {
    setActionLoading((prev) => ({ ...prev, [userId]: "activate" }));
    try {
      const res = await apiFetch(`/admin/users/${userId}/activate`, {
        method: "POST",
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, account_status: "active" } : u
          )
        );
        toast.success(`${fullName} has been reactivated.`);
      } else {
        toast.error("Failed to update user status. Please try again.");
      }
    } catch {
      toast.error("Failed to update user status. Please try again.");
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }

  const totalPages = Math.ceil(total / limit);

  function getPageNumbers(): number[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages: number[] = [];
    const start = Math.max(0, Math.min(page - 2, totalPages - 5));
    for (let i = start; i < Math.min(start + 5, totalPages); i++) {
      pages.push(i);
    }
    return pages;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">All Users</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#64748B]">
            {total}{" "}
            {roleFilter === "all"
              ? "users"
              : roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1) + "s"}
          </span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm bg-white"
          >
            <option value="all">All</option>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_120px_160px_140px_140px] gap-4 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span>Registered</span>
              <span>Actions</span>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base font-semibold text-[#0F172A]">
                  No users found
                </p>
                <p className="text-sm text-[#64748B] mt-1">
                  No users match the selected filter. Try selecting a different
                  role.
                </p>
              </div>
            ) : (
              users.map((user, index) => {
                const isActing = user.id in actionLoading;
                const isSuspending = actionLoading[user.id] === "suspend";
                const isActivating = actionLoading[user.id] === "activate";
                const isAdmin = user.role === "admin";

                return (
                  <div
                    key={user.id}
                    className={`flex flex-col md:grid md:grid-cols-[1fr_1fr_120px_160px_140px_140px] gap-3 md:gap-4 px-4 py-4 items-start md:items-center ${
                      index < users.length - 1 ? "border-b border-[#E2E8F0]" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {user.full_name}
                    </p>
                    <p className="text-sm text-[#64748B] truncate">
                      {user.email}
                    </p>
                    <Badge
                      variant="outline"
                      className={roleBadgeClass(user.role)}
                    >
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
                    <div>
                      {isAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-50 cursor-not-allowed"
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Suspend User
                        </Button>
                      ) : user.account_status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing}
                          onClick={() =>
                            handleSuspend(user.id, user.full_name)
                          }
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          {isSuspending ? "Suspending..." : "Suspend User"}
                        </Button>
                      ) : user.account_status === "suspended" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing}
                          onClick={() =>
                            handleActivate(user.id, user.full_name)
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isActivating ? "Activating..." : "Activate User"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              {getPageNumbers().map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
